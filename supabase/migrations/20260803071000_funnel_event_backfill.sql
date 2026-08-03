-- Backfill the verified lifecycle facts that existed before Auth-level events.

insert into public.business_events(event_name, user_id, company_id, source, idempotency_key, metadata, created_at)
select
  'company_created',
  m.user_id,
  c.id,
  'analytics.backfill',
  'company-created:' || c.id::text,
  jsonb_build_object('source', 'company_backfill'),
  c.created_at
from public.companies c
join public.members m on m.company_id = c.id and m.role = 'owner'
on conflict (idempotency_key) do nothing;

insert into public.business_events(event_name, user_id, company_id, source, idempotency_key, metadata, created_at)
select
  'email_confirmed',
  u.id,
  m.company_id,
  'analytics.backfill',
  'email-confirmed:' || u.id::text || ':' || u.email_confirmed_at::text,
  jsonb_build_object('source', 'auth_confirmation_backfill'),
  u.email_confirmed_at
from auth.users u
left join public.members m on m.user_id = u.id
where u.email_confirmed_at is not null
on conflict (idempotency_key) do nothing;

insert into public.business_events(event_name, user_id, company_id, source, idempotency_key, metadata, created_at)
select
  'signup_started',
  completed.user_id,
  completed.company_id,
  'analytics.backfill',
  replace(completed.idempotency_key, ':completed', ':started'),
  jsonb_build_object('source', 'signup_completed_backfill'),
  completed.created_at
from public.business_events completed
where completed.event_name = 'signup_completed'
  and completed.idempotency_key like '%:completed'
on conflict (idempotency_key) do nothing;
