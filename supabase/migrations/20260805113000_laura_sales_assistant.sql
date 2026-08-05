-- Public commercial conversations are stored separately from customer data.
-- The browser never receives direct access to this table; the server-side lead
-- endpoint writes through the service role and subsequent conversion events
-- are linked by the authenticated registration flow.

create table if not exists public.sales_assistant_leads (
  id uuid primary key default gen_random_uuid(),
  lead_token text not null unique check (char_length(lead_token) between 24 and 128),
  idempotency_key text not null unique,
  name text not null check (char_length(trim(name)) between 2 and 120),
  email text not null check (char_length(trim(email)) between 3 and 254),
  company_name text not null check (char_length(trim(company_name)) between 2 and 160),
  sector text,
  company_size text,
  primary_problem text,
  recommended_employees text[] not null default '{}',
  anonymous_id text,
  session_id text,
  landing text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  registered_user_id uuid references auth.users(id) on delete set null,
  registered_company_id uuid references public.companies(id) on delete set null,
  checkout_started_at timestamptz,
  payment_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_assistant_leads_created_idx
  on public.sales_assistant_leads(created_at desc);
create index if not exists sales_assistant_leads_conversion_idx
  on public.sales_assistant_leads(registered_company_id, checkout_started_at, payment_completed_at);

alter table public.sales_assistant_leads enable row level security;
revoke all on public.sales_assistant_leads from anon, authenticated;
grant all on public.sales_assistant_leads to service_role;

create or replace function public.sync_sales_assistant_conversion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id is null then
    return new;
  end if;

  if new.event_name = 'checkout_started' then
    update public.sales_assistant_leads
      set checkout_started_at = coalesce(checkout_started_at, new.created_at), updated_at = now()
      where registered_company_id = new.company_id;
  elsif new.event_name in ('payment_completed', 'checkout_completed', 'subscription_active') then
    update public.sales_assistant_leads
      set payment_completed_at = coalesce(payment_completed_at, new.created_at), updated_at = now()
      where registered_company_id = new.company_id;
  end if;
  return new;
end;
$$;

drop trigger if exists business_events_sync_sales_assistant_conversion on public.business_events;
create trigger business_events_sync_sales_assistant_conversion
after insert on public.business_events
for each row execute procedure public.sync_sales_assistant_conversion();

revoke execute on function public.sync_sales_assistant_conversion() from public, anon, authenticated;
