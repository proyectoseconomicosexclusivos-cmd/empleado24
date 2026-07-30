-- Empleado24 Brain: a tenant-isolated customer graph and internal event bus.
-- This migration is additive: existing employees and their current tables remain untouched.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  display_name text,
  company_name text,
  email text,
  phone text,
  whatsapp text,
  status text not null default 'active' check (status in ('lead','active','customer','blocked','lost')),
  source text not null default 'unknown',
  estimated_value_cents integer not null default 0 check (estimated_value_cents >= 0),
  last_contact_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customers_company_email_uidx
  on public.customers(company_id, lower(email)) where email is not null;
create unique index if not exists customers_company_phone_uidx
  on public.customers(company_id, phone) where phone is not null;
create index if not exists customers_company_contact_idx
  on public.customers(company_id, last_contact_at desc nulls last);

create table if not exists public.customer_identities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  identity_type text not null check (identity_type in ('email','phone','whatsapp','external')),
  normalized_value text not null,
  created_at timestamptz not null default now(),
  unique(company_id, identity_type, normalized_value)
);
create index if not exists customer_identities_customer_idx on public.customer_identities(customer_id);

create table if not exists public.brain_memories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  memory_type text not null check (memory_type in ('note','preference','fact','incident','summary','commercial')),
  content text not null check (length(trim(content)) > 0),
  source_employee_id uuid references public.employees(id) on delete set null,
  source_event_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists brain_memories_customer_created_idx on public.brain_memories(company_id, customer_id, created_at desc);

create table if not exists public.brain_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  event_name text not null,
  source text not null default 'employee',
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  idempotency_key text not null,
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(company_id, idempotency_key)
);
create index if not exists brain_events_company_customer_idx on public.brain_events(company_id, customer_id, occurred_at desc);
create index if not exists brain_events_pending_idx on public.brain_events(company_id, processed_at, occurred_at) where processed_at is null;

create table if not exists public.brain_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  assigned_employee_id uuid references public.employees(id) on delete set null,
  source_event_id uuid references public.brain_events(id) on delete set null,
  task_type text not null check (task_type in ('follow_up','call','email','quote','meeting','review')),
  title text not null check (length(trim(title)) between 2 and 180),
  status text not null default 'open' check (status in ('open','in_progress','completed','canceled')),
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists brain_tasks_source_event_type_uidx
  on public.brain_tasks(source_event_id, task_type) where source_event_id is not null;
create index if not exists brain_tasks_company_status_idx on public.brain_tasks(company_id, status, due_at);

create table if not exists public.brain_team_packs (
  pack_key text primary key,
  name text not null,
  description text not null,
  employee_types text[] not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.brain_team_packs(pack_key,name,description,employee_types,active)
values
  ('individual','Pack Individual','Un empleado conectado al conocimiento compartido.',array['receptionist'],false),
  ('commercial','Pack Comercial','Recepcionista, WhatsApp, Closer y Email trabajando como un equipo.',array['receptionist','whatsapp','closer','email'],false),
  ('company','Pack Empresa','Todos los empleados conectados al Brain.',array['receptionist','whatsapp','closer','email'],false)
on conflict (pack_key) do update set name = excluded.name, description = excluded.description, employee_types = excluded.employee_types, updated_at = now();

alter table public.customers enable row level security;
alter table public.customer_identities enable row level security;
alter table public.brain_memories enable row level security;
alter table public.brain_events enable row level security;
alter table public.brain_tasks enable row level security;
alter table public.brain_team_packs enable row level security;

create policy "members read brain customers" on public.customers for select to authenticated using ((select public.is_company_member(company_id)));
create policy "admins manage brain customers" on public.customers for all to authenticated using ((select public.is_company_admin(company_id))) with check ((select public.is_company_admin(company_id)));
create policy "members read customer identities" on public.customer_identities for select to authenticated using ((select public.is_company_member(company_id)));
create policy "admins manage customer identities" on public.customer_identities for all to authenticated using ((select public.is_company_admin(company_id))) with check ((select public.is_company_admin(company_id)));
create policy "members read brain memories" on public.brain_memories for select to authenticated using ((select public.is_company_member(company_id)));
create policy "admins manage brain memories" on public.brain_memories for all to authenticated using ((select public.is_company_admin(company_id))) with check ((select public.is_company_admin(company_id)));
create policy "members read brain events" on public.brain_events for select to authenticated using ((select public.is_company_member(company_id)));
create policy "members read brain tasks" on public.brain_tasks for select to authenticated using ((select public.is_company_member(company_id)));
create policy "admins manage brain tasks" on public.brain_tasks for all to authenticated using ((select public.is_company_admin(company_id))) with check ((select public.is_company_admin(company_id)));
create policy "authenticated read brain packs" on public.brain_team_packs for select to authenticated using (true);

grant select, insert, update, delete on public.customers, public.customer_identities, public.brain_memories, public.brain_tasks to authenticated;
grant select on public.brain_events, public.brain_team_packs to authenticated;
grant all on public.customers, public.customer_identities, public.brain_memories, public.brain_events, public.brain_tasks, public.brain_team_packs to service_role;
revoke all on public.customers, public.customer_identities, public.brain_memories, public.brain_events, public.brain_tasks, public.brain_team_packs from anon;
