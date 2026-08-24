-- Phase 1 of the Technical Department: private project files and traceable analysis.
-- The original files remain private and every record is scoped to one company.

create table if not exists public.technical_projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  title text not null check (length(trim(title)) between 2 and 180),
  status text not null default 'draft' check (status in ('draft','processing','ready','failed','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists technical_projects_company_updated_idx on public.technical_projects(company_id, updated_at desc);
create index if not exists technical_projects_customer_idx on public.technical_projects(company_id, customer_id, updated_at desc);

create table if not exists public.technical_project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.technical_projects(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  version integer not null check (version > 0),
  source text not null default 'upload' check (source in ('upload','revision')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(project_id, version)
);
create index if not exists technical_project_versions_project_idx on public.technical_project_versions(company_id, project_id, version desc);

create table if not exists public.technical_project_files (
  id uuid primary key default gen_random_uuid(),
  project_version_id uuid not null references public.technical_project_versions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null check (length(trim(original_name)) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 20971520),
  sha256 text not null check (length(sha256) = 64),
  created_at timestamptz not null default now(),
  unique(project_version_id, sha256)
);
create index if not exists technical_project_files_version_idx on public.technical_project_files(company_id, project_version_id);

create table if not exists public.technical_project_analyses (
  id uuid primary key default gen_random_uuid(),
  project_version_id uuid not null references public.technical_project_versions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null default 'gemini',
  model text not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  result jsonb not null default '{}'::jsonb check (jsonb_typeof(result) = 'object'),
  confidence numeric(4,3),
  error_code text,
  idempotency_key text not null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, idempotency_key)
);
create index if not exists technical_project_analyses_version_idx on public.technical_project_analyses(company_id, project_version_id, created_at desc);

alter table public.technical_projects enable row level security;
alter table public.technical_project_versions enable row level security;
alter table public.technical_project_files enable row level security;
alter table public.technical_project_analyses enable row level security;

create policy "members read technical projects" on public.technical_projects for select to authenticated using ((select public.is_company_member(company_id)));
create policy "admins manage technical projects" on public.technical_projects for all to authenticated using ((select public.is_company_admin(company_id))) with check ((select public.is_company_admin(company_id)));
create policy "members read technical versions" on public.technical_project_versions for select to authenticated using ((select public.is_company_member(company_id)));
create policy "admins manage technical versions" on public.technical_project_versions for all to authenticated using ((select public.is_company_admin(company_id))) with check ((select public.is_company_admin(company_id)));
create policy "members read technical files" on public.technical_project_files for select to authenticated using ((select public.is_company_member(company_id)));
create policy "admins manage technical files" on public.technical_project_files for all to authenticated using ((select public.is_company_admin(company_id))) with check ((select public.is_company_admin(company_id)));
create policy "members read technical analyses" on public.technical_project_analyses for select to authenticated using ((select public.is_company_member(company_id)));
create policy "admins manage technical analyses" on public.technical_project_analyses for all to authenticated using ((select public.is_company_admin(company_id))) with check ((select public.is_company_admin(company_id)));

grant select, insert, update, delete on public.technical_projects, public.technical_project_versions, public.technical_project_files, public.technical_project_analyses to authenticated;
grant all on public.technical_projects, public.technical_project_versions, public.technical_project_files, public.technical_project_analyses to service_role;
revoke all on public.technical_projects, public.technical_project_versions, public.technical_project_files, public.technical_project_analyses from anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('technical-projects', 'technical-projects', false, 20971520, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "members read their technical project objects" on storage.objects for select to authenticated using (
  bucket_id = 'technical-projects' and exists (
    select 1 from public.members m
    where m.user_id = (select auth.uid()) and m.company_id::text = (storage.foldername(name))[1]
  )
);
create policy "admins upload their technical project objects" on storage.objects for insert to authenticated with check (
  bucket_id = 'technical-projects' and exists (
    select 1 from public.members m
    where m.user_id = (select auth.uid()) and m.role in ('owner','admin') and m.company_id::text = (storage.foldername(name))[1]
  )
);
create policy "admins update their technical project objects" on storage.objects for update to authenticated using (
  bucket_id = 'technical-projects' and exists (
    select 1 from public.members m
    where m.user_id = (select auth.uid()) and m.role in ('owner','admin') and m.company_id::text = (storage.foldername(name))[1]
  )
) with check (
  bucket_id = 'technical-projects' and exists (
    select 1 from public.members m
    where m.user_id = (select auth.uid()) and m.role in ('owner','admin') and m.company_id::text = (storage.foldername(name))[1]
  )
);
create policy "admins delete their technical project objects" on storage.objects for delete to authenticated using (
  bucket_id = 'technical-projects' and exists (
    select 1 from public.members m
    where m.user_id = (select auth.uid()) and m.role in ('owner','admin') and m.company_id::text = (storage.foldername(name))[1]
  )
);

insert into public.departments(department_key,name,description,employee_types,active,coming_soon)
values ('technical','Departamento Técnico IA','Arquitecto Técnico y Presupuestos IA: planos PDF e imágenes convertidos en una preparación técnica revisable.',array['technical_architect','budget_specialist'],true,false)
on conflict (department_key) do update set name=excluded.name, description=excluded.description, employee_types=excluded.employee_types, active=true, coming_soon=false, updated_at=now();

insert into public.billing_plans (plan_key,name,description,monthly_price_cents,currency,trial_days,active,self_serve_enabled,customer_portal_enabled,sort_order,employee_limit,member_limit,knowledge_item_limit,retention_days)
values
  ('employee_technical_architect','Arquitecto Técnico IA','Analiza planos PDF e imágenes, prepara memoria técnica y mediciones preliminares revisables.',19700,'EUR',3,true,true,true,21,1,5,250,180),
  ('department_technical','Departamento Técnico IA','Arquitecto Técnico y Especialista Presupuestos IA coordinados en cada proyecto.',39700,'EUR',3,true,true,true,22,2,5,250,180)
on conflict (plan_key) do update set name=excluded.name, description=excluded.description, monthly_price_cents=excluded.monthly_price_cents, trial_days=excluded.trial_days, active=true, self_serve_enabled=true, customer_portal_enabled=true, sort_order=excluded.sort_order, employee_limit=excluded.employee_limit, member_limit=excluded.member_limit, knowledge_item_limit=excluded.knowledge_item_limit, retention_days=excluded.retention_days, updated_at=now();

alter table public.business_events drop constraint if exists business_events_event_name_check;
alter table public.business_events add constraint business_events_event_name_check check (event_name in (
  'landing_view','page_view','pricing_view','signup_started','signup_completed','registration_started','email_verified','email_confirmed','login','company_created','trial_started','trial_finished','employee_hired','phone_connected','calendar_connected','checkout_started','payment_completed','checkout_completed','subscription_active','minutes_purchased','first_login','first_call','call_completed','email_sent','meeting_booked','sale_won','sale_lost','cancellation_requested','subscription_cancelled','subscription_reactivated','support_chat_opened','critical_error','sales_lead_created','sales_lead_hot','sales_meeting_scheduled','sales_quote_sent','sales_won','sales_lost','whatsapp_message_received','whatsapp_quote_requested','whatsapp_call_requested','whatsapp_meeting_scheduled','whatsapp_converted','whatsapp_escalated','whatsapp_lead_created','department_activated','quote_created','quote_sent','quote_accepted','quote_rejected','technical_project_analyzed'
));
