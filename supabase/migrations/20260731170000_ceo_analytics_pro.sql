-- CEO Analytics Pro: auditable, idempotent commercial measurements.
-- Historical rows are preserved. Rows that pre-date idempotency receive a
-- deterministic legacy key instead of being removed.

alter table public.business_events
  add column if not exists event_id uuid,
  add column if not exists session_id text,
  add column if not exists visitor_id text,
  add column if not exists source text,
  add column if not exists idempotency_key text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists fbclid text,
  add column if not exists referrer text,
  add column if not exists landing text;

update public.business_events
set event_id = coalesce(event_id, gen_random_uuid()),
    visitor_id = coalesce(visitor_id, anonymous_id),
    source = coalesce(nullif(source, ''), 'app'),
    idempotency_key = coalesce(nullif(idempotency_key, ''), 'legacy:' || id::text)
where event_id is null
   or visitor_id is null
   or source is null
   or idempotency_key is null
   or idempotency_key = '';

-- Preserve every historic row while making any old collision unique.
with duplicates as (
  select id, row_number() over (partition by idempotency_key order by created_at, id) as position
  from public.business_events
)
update public.business_events event
set idempotency_key = event.idempotency_key || ':legacy:' || event.id::text
from duplicates
where event.id = duplicates.id and duplicates.position > 1;

alter table public.business_events
  alter column event_id set default gen_random_uuid(),
  alter column event_id set not null,
  alter column source set default 'app',
  alter column source set not null,
  alter column idempotency_key set not null;

alter table public.business_events drop constraint if exists business_events_event_name_check;
alter table public.business_events add constraint business_events_event_name_check check (event_name in (
  'landing_view', 'page_view', 'pricing_view', 'signup_started', 'signup_completed',
  'registration_started', 'email_verified', 'email_confirmed', 'login', 'company_created',
  'trial_started', 'trial_finished', 'employee_hired', 'phone_connected', 'calendar_connected',
  'checkout_started', 'checkout_completed', 'payment_completed', 'subscription_active',
  'subscription_cancelled', 'subscription_reactivated', 'minutes_purchased', 'first_login',
  'first_call', 'call_completed', 'email_sent', 'meeting_booked', 'sale_won', 'sale_lost',
  'cancellation_requested', 'support_chat_opened', 'critical_error', 'sales_lead_created',
  'sales_lead_hot', 'sales_meeting_scheduled', 'sales_quote_sent', 'sales_won', 'sales_lost',
  'whatsapp_message_received', 'whatsapp_quote_requested', 'whatsapp_call_requested',
  'whatsapp_meeting_scheduled', 'whatsapp_converted', 'whatsapp_escalated',
  'whatsapp_lead_created'
));

create unique index if not exists business_events_event_id_uidx
  on public.business_events(event_id);
create unique index if not exists business_events_idempotency_key_uidx
  on public.business_events(idempotency_key);
create index if not exists business_events_session_created_idx
  on public.business_events(session_id, created_at desc);
create index if not exists business_events_visitor_created_idx
  on public.business_events(visitor_id, created_at desc);
create index if not exists business_events_funnel_idx
  on public.business_events(event_name, created_at desc);

create table if not exists public.analytics_daily (
  date date primary key,
  visitors integer not null default 0 check (visitors >= 0),
  registered_users integer not null default 0 check (registered_users >= 0),
  emails_confirmed integer not null default 0 check (emails_confirmed >= 0),
  companies_created integer not null default 0 check (companies_created >= 0),
  trials_started integer not null default 0 check (trials_started >= 0),
  trials_active integer not null default 0 check (trials_active >= 0),
  employees_hired integer not null default 0 check (employees_hired >= 0),
  calls_completed integer not null default 0 check (calls_completed >= 0),
  emails_sent integer not null default 0 check (emails_sent >= 0),
  sales_won integer not null default 0 check (sales_won >= 0),
  revenue_cents bigint not null default 0 check (revenue_cents >= 0),
  mrr_cents bigint not null default 0 check (mrr_cents >= 0),
  cancellations integer not null default 0 check (cancellations >= 0),
  past_due integer not null default 0 check (past_due >= 0),
  refreshed_at timestamptz not null default now()
);

alter table public.analytics_daily enable row level security;
revoke all on public.analytics_daily from anon, authenticated;
grant all on public.analytics_daily to service_role;

create table if not exists public.notification_history (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  channel text not null check (channel in ('owner')),
  sent_at timestamptz not null default now(),
  cooldown_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_key, channel)
);

alter table public.notification_history enable row level security;
revoke all on public.notification_history from anon, authenticated, public;
grant all on public.notification_history to service_role;
create index if not exists notification_history_cooldown_idx
  on public.notification_history(cooldown_until);

create or replace function public.service_claim_owner_notification(
  target_event_key text,
  target_cooldown_seconds integer default 900
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare claimed boolean := false;
begin
  if target_event_key is null or length(target_event_key) = 0 then
    raise exception 'event key is required';
  end if;
  if target_cooldown_seconds < 1 or target_cooldown_seconds > 604800 then
    raise exception 'invalid cooldown';
  end if;

  insert into public.notification_history (event_key, channel, sent_at, cooldown_until, updated_at)
  values (target_event_key, 'owner', now(), now() + make_interval(secs => target_cooldown_seconds), now())
  on conflict (event_key, channel) do update
    set sent_at = excluded.sent_at,
        cooldown_until = excluded.cooldown_until,
        updated_at = excluded.updated_at
    where public.notification_history.cooldown_until <= now()
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

revoke all on function public.service_claim_owner_notification(text, integer) from public, anon, authenticated;
grant execute on function public.service_claim_owner_notification(text, integer) to service_role;
