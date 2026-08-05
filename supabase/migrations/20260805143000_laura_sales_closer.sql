-- Laura's anonymous commercial memory stays outside a customer company until
-- the visitor chooses to register. Once a company exists, the existing Brain
-- receives an attributed lead/sale event through the onboarding bridge.

create table if not exists public.sales_assistant_conversations (
  anonymous_id text primary key check (char_length(anonymous_id) between 16 and 120),
  session_id text,
  commercial_state text not null default 'COLD'
    check (commercial_state in ('COLD', 'INTERESTED', 'VERY_INTERESTED', 'READY_TO_BUY', 'CLIENT')),
  sector text,
  company_size text,
  primary_problem text,
  objection text,
  recommended_employees text[] not null default '{}',
  roi_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(roi_snapshot) = 'object'),
  answer_history jsonb not null default '[]'::jsonb check (jsonb_typeof(answer_history) = 'array'),
  visit_count integer not null default 0 check (visit_count >= 0),
  conversation_started_at timestamptz,
  conversation_completed_at timestamptz,
  roi_shown_at timestamptz,
  demo_opened_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_assistant_conversations_state_idx
  on public.sales_assistant_conversations(commercial_state, last_seen_at desc);
create index if not exists sales_assistant_conversations_problem_idx
  on public.sales_assistant_conversations(primary_problem, updated_at desc);

alter table public.sales_assistant_conversations enable row level security;
revoke all on public.sales_assistant_conversations from anon, authenticated;
grant all on public.sales_assistant_conversations to service_role;

alter table public.sales_assistant_leads
  add column if not exists commercial_state text not null default 'INTERESTED'
    check (commercial_state in ('COLD', 'INTERESTED', 'VERY_INTERESTED', 'READY_TO_BUY', 'CLIENT')),
  add column if not exists objections jsonb not null default '[]'::jsonb
    check (jsonb_typeof(objections) = 'array'),
  add column if not exists roi_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(roi_snapshot) = 'object'),
  add column if not exists demo_opened_at timestamptz;

create index if not exists sales_assistant_leads_state_idx
  on public.sales_assistant_leads(commercial_state, created_at desc);

create or replace function public.sync_sales_assistant_conversion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  matched_lead record;
  next_state text;
begin
  if new.company_id is null then
    return new;
  end if;

  if new.event_name = 'checkout_started' then
    next_state := 'READY_TO_BUY';
    update public.sales_assistant_leads
      set checkout_started_at = coalesce(checkout_started_at, new.created_at),
          commercial_state = next_state,
          updated_at = now()
      where registered_company_id = new.company_id;
  elsif new.event_name in ('payment_completed', 'checkout_completed', 'subscription_active') then
    next_state := 'CLIENT';
    update public.sales_assistant_leads
      set payment_completed_at = coalesce(payment_completed_at, new.created_at),
          commercial_state = next_state,
          updated_at = now()
      where registered_company_id = new.company_id;

    -- The current Brain is not changed: it simply receives a normal,
    -- idempotent PaymentCompleted event for a sale attributed to Laura.
    for matched_lead in
      select id, anonymous_id from public.sales_assistant_leads
      where registered_company_id = new.company_id
    loop
      update public.sales_assistant_conversations
        set commercial_state = 'CLIENT', updated_at = now()
        where anonymous_id = matched_lead.anonymous_id;
      insert into public.brain_events(company_id, event_name, source, payload, idempotency_key, occurred_at, processed_at)
        values (
          new.company_id,
          'PaymentCompleted',
          'laura_sales_assistant',
          jsonb_build_object('lead_id', matched_lead.id, 'attribution', 'laura'),
          'brain:laura:sale:' || matched_lead.id::text || ':' || new.event_name,
          new.created_at,
          now()
        )
      on conflict (company_id, idempotency_key) do nothing;
    end loop;
  end if;
  return new;
end;
$$;

revoke execute on function public.sync_sales_assistant_conversion() from public, anon, authenticated;
