-- Closer IA reuses the existing employee, billing, activity and integration
-- engines. These are the only two domain tables required by the sellable MVP:
-- an opportunity and its ordered commercial actions.

create unique index if not exists employees_id_company_uidx
  on public.employees(id, company_id);

create table public.sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  closer_employee_id uuid not null references public.employees(id) on delete cascade,
  source text not null default 'manual'
    check (source in ('manual', 'receptionist', 'email', 'website', 'referral', 'other')),
  source_call_id uuid references public.voice_calls(id) on delete set null,
  name text not null check (length(trim(name)) between 2 and 160),
  company_name text,
  email text,
  phone text,
  stage text not null default 'new'
    check (stage in ('new', 'contacted', 'interested', 'quote_sent', 'negotiation', 'won', 'lost')),
  heat text not null default 'cold'
    check (heat in ('very_hot', 'interested', 'cold', 'lost')),
  value_cents integer not null default 0 check (value_cents >= 0),
  currency char(3) not null default 'EUR',
  notes text,
  next_action_at timestamptz,
  last_contact_at timestamptz,
  won_at timestamptz,
  lost_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (closer_employee_id, company_id)
    references public.employees(id, company_id) on delete cascade
);

create unique index sales_opportunities_id_company_uidx
  on public.sales_opportunities(id, company_id);
create unique index sales_opportunities_source_call_uidx
  on public.sales_opportunities(source_call_id)
  where source_call_id is not null;
create index sales_opportunities_company_stage_idx
  on public.sales_opportunities(company_id, stage, updated_at desc);
create index sales_opportunities_company_heat_idx
  on public.sales_opportunities(company_id, heat, updated_at desc);

create table public.sales_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  opportunity_id uuid not null references public.sales_opportunities(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  activity_type text not null
    check (activity_type in ('task', 'call', 'email', 'meeting', 'quote', 'note', 'stage_change')),
  status text not null default 'planned'
    check (status in ('planned', 'completed', 'canceled', 'failed')),
  title text not null check (length(trim(title)) between 2 and 180),
  scheduled_at timestamptz,
  completed_at timestamptz,
  outcome text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (opportunity_id, company_id)
    references public.sales_opportunities(id, company_id) on delete cascade,
  foreign key (employee_id, company_id)
    references public.employees(id, company_id) on delete cascade
);

create index sales_activities_company_schedule_idx
  on public.sales_activities(company_id, status, scheduled_at);
create index sales_activities_opportunity_created_idx
  on public.sales_activities(opportunity_id, created_at desc);

create or replace function public.score_sales_opportunity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  new.heat := case
    when new.stage = 'lost' then 'lost'
    when new.stage in ('won', 'negotiation') then 'very_hot'
    when new.stage in ('interested', 'quote_sent') then 'interested'
    when new.next_action_at is not null
      and new.next_action_at <= now() + interval '48 hours'
      and new.stage = 'contacted' then 'interested'
    else 'cold'
  end;
  new.won_at := case when new.stage = 'won' then coalesce(new.won_at, now()) else null end;
  new.lost_at := case when new.stage = 'lost' then coalesce(new.lost_at, now()) else null end;
  return new;
end
$$;

create trigger sales_opportunity_score
before insert or update on public.sales_opportunities
for each row execute procedure public.score_sales_opportunity();

create or replace function public.enforce_closer_employee_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  employee_company uuid;
  employee_kind text;
begin
  select company_id, employee_type
    into employee_company, employee_kind
  from public.employees
  where id = case
    when tg_table_name = 'sales_opportunities' then new.closer_employee_id
    else new.employee_id
  end;

  if employee_company is distinct from new.company_id or employee_kind <> 'closer' then
    raise exception 'Sales records must belong to the company Closer'
      using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger sales_opportunities_scope_guard
before insert or update on public.sales_opportunities
for each row execute procedure public.enforce_closer_employee_scope();

create trigger sales_activities_scope_guard
before insert or update on public.sales_activities
for each row execute procedure public.enforce_closer_employee_scope();

alter table public.sales_opportunities enable row level security;
alter table public.sales_activities enable row level security;

create policy "members read sales opportunities"
on public.sales_opportunities for select to authenticated
using (public.is_company_member(company_id));

create policy "admins manage sales opportunities"
on public.sales_opportunities for all to authenticated
using (public.is_company_admin(company_id))
with check (public.is_company_admin(company_id));

create policy "members read sales activities"
on public.sales_activities for select to authenticated
using (public.is_company_member(company_id));

create policy "admins manage sales activities"
on public.sales_activities for all to authenticated
using (public.is_company_admin(company_id))
with check (public.is_company_admin(company_id));

grant select, insert, update, delete
  on public.sales_opportunities, public.sales_activities
  to authenticated;
grant all
  on public.sales_opportunities, public.sales_activities
  to service_role;
revoke all
  on public.sales_opportunities, public.sales_activities
  from anon;

insert into public.billing_plans (
  plan_key,
  name,
  description,
  monthly_price_cents,
  currency,
  trial_days,
  active,
  self_serve_enabled,
  customer_portal_enabled,
  sort_order,
  employee_limit,
  member_limit,
  knowledge_item_limit,
  retention_days
)
values (
  'employee_closer',
  'Closer IA',
  'Hace seguimiento, llama, prepara emails, agenda reuniones y analiza oportunidades.',
  19700,
  'EUR',
  3,
  true,
  true,
  true,
  6,
  1,
  2,
  100,
  90
)
on conflict (plan_key) do update set
  name = excluded.name,
  description = excluded.description,
  monthly_price_cents = excluded.monthly_price_cents,
  currency = excluded.currency,
  trial_days = excluded.trial_days,
  active = excluded.active,
  self_serve_enabled = excluded.self_serve_enabled,
  customer_portal_enabled = excluded.customer_portal_enabled,
  sort_order = excluded.sort_order,
  employee_limit = excluded.employee_limit,
  member_limit = excluded.member_limit,
  knowledge_item_limit = excluded.knowledge_item_limit,
  retention_days = excluded.retention_days,
  updated_at = now();

alter table public.business_events
  drop constraint if exists business_events_event_name_check;
alter table public.business_events
  add constraint business_events_event_name_check check (event_name in (
    'landing_view','page_view','pricing_view','signup_started','signup_completed','registration_started',
    'email_verified','login','trial_started','trial_finished','employee_hired','phone_connected',
    'calendar_connected','checkout_started','payment_completed','checkout_completed','subscription_active',
    'minutes_purchased','first_login','first_call','call_completed','cancellation_requested',
    'subscription_cancelled','subscription_reactivated','support_chat_opened','critical_error',
    'sales_lead_created','sales_lead_hot','sales_meeting_scheduled','sales_quote_sent',
    'sales_won','sales_lost'
  ));
