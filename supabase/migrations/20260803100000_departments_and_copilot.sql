-- Departments are a commercial layer over the existing employee and Brain model.
-- They never bypass company isolation: each activation remains company scoped.

create table if not exists public.departments (
  department_key text primary key,
  name text not null,
  description text not null,
  employee_types text[] not null check (cardinality(employee_types) > 0),
  active boolean not null default false,
  coming_soon boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  department_key text not null references public.departments(department_key) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  status text not null default 'active' check (status in ('active','canceling','canceled','paused')),
  activated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, department_key)
);
create index if not exists company_departments_company_status_idx on public.company_departments(company_id,status);

insert into public.departments(department_key,name,description,employee_types,active,coming_soon)
values
  ('commercial','Departamento Comercial IA','Convierte cada conversación en una oportunidad con un equipo coordinado.',array['receptionist','whatsapp','closer','booking','budget_specialist'],true,false),
  ('marketing','Departamento Marketing IA','Email, contenido, posicionamiento y campañas trabajando juntos.',array['email_specialist','social_media','youtube','seo','ads'],false,true),
  ('company','Departamento Empresa IA','Operaciones, clientes y administración conectados al mismo conocimiento.',array['crm','finance','hr','customer_success','ceo_advisor'],false,true)
on conflict (department_key) do update set
  name=excluded.name, description=excluded.description, employee_types=excluded.employee_types,
  active=excluded.active, coming_soon=excluded.coming_soon, updated_at=now();

insert into public.billing_plans (
  plan_key,name,description,monthly_price_cents,currency,trial_days,active,self_serve_enabled,
  customer_portal_enabled,sort_order,employee_limit,member_limit,knowledge_item_limit,retention_days
) values (
  'department_commercial','Departamento Comercial IA',
  'Recepcionista, WhatsApp, Closer, Booking y Presupuestos compartiendo Empleado24 Brain.',
  29700,'EUR',3,true,true,true,20,5,5,250,180
) on conflict (plan_key) do update set
  name=excluded.name, description=excluded.description, monthly_price_cents=excluded.monthly_price_cents,
  currency=excluded.currency, trial_days=excluded.trial_days, active=true, self_serve_enabled=true,
  customer_portal_enabled=true, sort_order=excluded.sort_order, employee_limit=excluded.employee_limit,
  member_limit=excluded.member_limit, knowledge_item_limit=excluded.knowledge_item_limit,
  retention_days=excluded.retention_days, updated_at=now();

alter table public.departments enable row level security;
alter table public.company_departments enable row level security;
create policy "authenticated read departments" on public.departments for select to authenticated using (true);
create policy "members read company departments" on public.company_departments for select to authenticated using ((select public.is_company_member(company_id)));
create policy "admins manage company departments" on public.company_departments for all to authenticated using ((select public.is_company_admin(company_id))) with check ((select public.is_company_admin(company_id)));
grant select on public.departments, public.company_departments to authenticated;
grant all on public.departments, public.company_departments to service_role;
revoke all on public.departments, public.company_departments from anon;
