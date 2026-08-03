-- Universal quote engine. All commercial data remains isolated by company_id.
create table if not exists public.quote_catalog_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category text not null check (length(trim(category)) between 1 and 120),
  subcategory text,
  name text not null check (length(trim(name)) between 1 and 180),
  description text,
  unit text not null default 'unidad' check (length(trim(unit)) between 1 and 30),
  unit_cost_cents integer not null default 0 check (unit_cost_cents >= 0),
  default_margin_bps integer not null default 3500 check (default_margin_bps between 0 and 9900),
  supplier_name text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, category, name)
);
create index if not exists quote_catalog_items_company_category_idx on public.quote_catalog_items(company_id, category, active);

create table if not exists public.quote_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  description text,
  default_margin_bps integer not null default 3500 check (default_margin_bps between 0 and 9900),
  default_tax_bps integer not null default 2100 check (default_tax_bps between 0 and 9900),
  terms text,
  payment_milestones jsonb not null default '[]'::jsonb check (jsonb_typeof(payment_milestones) = 'array'),
  brand jsonb not null default '{}'::jsonb check (jsonb_typeof(brand) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, name)
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  opportunity_id uuid references public.sales_opportunities(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  template_id uuid references public.quote_templates(id) on delete set null,
  title text not null check (length(trim(title)) between 2 and 180),
  brief text,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired','archived')),
  currency text not null default 'EUR' check (length(currency) = 3),
  current_version integer not null default 1 check (current_version > 0),
  cost_cents integer not null default 0 check (cost_cents >= 0),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  profit_cents integer not null default 0,
  margin_bps integer not null default 0 check (margin_bps between -10000 and 10000),
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quotes_company_status_idx on public.quotes(company_id, status, updated_at desc);
create index if not exists quotes_customer_idx on public.quotes(company_id, customer_id, updated_at desc);

create table if not exists public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  version integer not null check (version > 0),
  source text not null default 'manual' check (source in ('manual','assistant','whatsapp','duplicate','restore')),
  change_note text,
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(quote_id, version)
);
create index if not exists quote_versions_quote_idx on public.quote_versions(company_id, quote_id, version desc);

create table if not exists public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references public.quote_versions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  chapter text not null check (length(trim(chapter)) between 1 and 120),
  concept text not null check (length(trim(concept)) between 1 and 180),
  unit text not null default 'unidad' check (length(trim(unit)) between 1 and 30),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost_cents integer not null check (unit_cost_cents >= 0),
  planned_days integer not null default 0 check (planned_days >= 0),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists quote_lines_version_idx on public.quote_lines(company_id, quote_version_id, sort_order);

create table if not exists public.quote_deliveries (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp','pdf')),
  status text not null default 'prepared' check (status in ('prepared','sent','opened','failed')),
  idempotency_key text not null,
  delivered_at timestamptz,
  opened_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique(company_id, idempotency_key)
);

alter table public.quote_catalog_items enable row level security;
alter table public.quote_templates enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_versions enable row level security;
alter table public.quote_lines enable row level security;
alter table public.quote_deliveries enable row level security;

create policy "members read quote catalogue" on public.quote_catalog_items for select to authenticated using ((select public.is_company_member(company_id)));
create policy "admins manage quote catalogue" on public.quote_catalog_items for all to authenticated using ((select public.is_company_admin(company_id))) with check ((select public.is_company_admin(company_id)));
create policy "members read quote templates" on public.quote_templates for select to authenticated using ((select public.is_company_member(company_id)));
create policy "admins manage quote templates" on public.quote_templates for all to authenticated using ((select public.is_company_admin(company_id))) with check ((select public.is_company_admin(company_id)));
create policy "members read quotes" on public.quotes for select to authenticated using ((select public.is_company_member(company_id)));
create policy "admins manage quotes" on public.quotes for all to authenticated using ((select public.is_company_admin(company_id))) with check ((select public.is_company_admin(company_id)));
create policy "members read quote versions" on public.quote_versions for select to authenticated using ((select public.is_company_member(company_id)));
create policy "admins manage quote versions" on public.quote_versions for all to authenticated using ((select public.is_company_admin(company_id))) with check ((select public.is_company_admin(company_id)));
create policy "members read quote lines" on public.quote_lines for select to authenticated using ((select public.is_company_member(company_id)));
create policy "admins manage quote lines" on public.quote_lines for all to authenticated using ((select public.is_company_admin(company_id))) with check ((select public.is_company_admin(company_id)));
create policy "members read quote deliveries" on public.quote_deliveries for select to authenticated using ((select public.is_company_member(company_id)));
create policy "admins manage quote deliveries" on public.quote_deliveries for all to authenticated using ((select public.is_company_admin(company_id))) with check ((select public.is_company_admin(company_id)));

grant select, insert, update, delete on public.quote_catalog_items, public.quote_templates, public.quotes, public.quote_versions, public.quote_lines, public.quote_deliveries to authenticated;
grant all on public.quote_catalog_items, public.quote_templates, public.quotes, public.quote_versions, public.quote_lines, public.quote_deliveries to service_role;
revoke all on public.quote_catalog_items, public.quote_templates, public.quotes, public.quote_versions, public.quote_lines, public.quote_deliveries from anon;

insert into public.billing_plans (plan_key,name,description,monthly_price_cents,currency,trial_days,active,self_serve_enabled,customer_portal_enabled,sort_order,employee_limit,member_limit,knowledge_item_limit,retention_days)
values ('employee_budget','Especialista Presupuestos IA','Prepara presupuestos claros, controlados y listos para enviar.',19700,'EUR',3,true,true,true,19,1,5,250,180)
on conflict (plan_key) do update set name=excluded.name, description=excluded.description, monthly_price_cents=excluded.monthly_price_cents, trial_days=excluded.trial_days, active=true, self_serve_enabled=true, customer_portal_enabled=true, sort_order=excluded.sort_order, updated_at=now();

alter table public.business_events drop constraint if exists business_events_event_name_check;
alter table public.business_events add constraint business_events_event_name_check check (event_name in (
  'landing_view','page_view','pricing_view','signup_started','signup_completed','registration_started','email_verified','email_confirmed','login','company_created','trial_started','trial_finished','employee_hired','phone_connected','calendar_connected','checkout_started','payment_completed','checkout_completed','subscription_active','minutes_purchased','first_login','first_call','call_completed','email_sent','meeting_booked','sale_won','sale_lost','cancellation_requested','subscription_cancelled','subscription_reactivated','support_chat_opened','critical_error','sales_lead_created','sales_lead_hot','sales_meeting_scheduled','sales_quote_sent','sales_won','sales_lost','whatsapp_message_received','whatsapp_quote_requested','whatsapp_call_requested','whatsapp_meeting_scheduled','whatsapp_converted','whatsapp_escalated','whatsapp_lead_created','department_activated','quote_created','quote_sent','quote_accepted','quote_rejected'
));
