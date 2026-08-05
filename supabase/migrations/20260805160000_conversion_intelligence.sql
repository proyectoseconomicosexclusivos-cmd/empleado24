-- Conversion intelligence stays private. Browser clients interact only through
-- server routes; no visitor timeline, lead identity or experiment assignment is
-- exposed through the Data API.

alter table public.sales_assistant_leads
  add column if not exists contact_consent_at timestamptz,
  add column if not exists contact_consent_source text;

alter table public.sales_assistant_leads
  add constraint sales_assistant_leads_contact_consent_source_check
  check (contact_consent_source is null or contact_consent_source in ('laura_lead_form'));

create index if not exists sales_assistant_leads_contactable_idx
  on public.sales_assistant_leads (contact_consent_at desc, commercial_state, updated_at desc)
  where contact_consent_at is not null;

create table if not exists public.conversion_experiments (
  experiment_key text primary key check (experiment_key ~ '^[a-z0-9_]{3,80}$'),
  display_name text not null check (char_length(trim(display_name)) between 3 and 120),
  target text not null check (target in ('laura_opening')),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  variants jsonb not null check (jsonb_typeof(variants) = 'array' and jsonb_array_length(variants) >= 2),
  started_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversion_experiment_assignments (
  experiment_key text not null references public.conversion_experiments(experiment_key) on delete cascade,
  anonymous_id text not null check (char_length(anonymous_id) between 16 and 120),
  variant_key text not null check (char_length(variant_key) between 1 and 80),
  assigned_at timestamptz not null default now(),
  primary key (experiment_key, anonymous_id)
);

create index if not exists conversion_experiment_assignments_variant_idx
  on public.conversion_experiment_assignments (experiment_key, variant_key, assigned_at desc);

alter table public.conversion_experiments enable row level security;
alter table public.conversion_experiment_assignments enable row level security;
revoke all on public.conversion_experiments from anon, authenticated;
revoke all on public.conversion_experiment_assignments from anon, authenticated;
grant all on public.conversion_experiments to service_role;
grant all on public.conversion_experiment_assignments to service_role;

insert into public.conversion_experiments (experiment_key, display_name, target, status, variants, started_at)
values (
  'laura_opening',
  'Apertura de Laura',
  'laura_opening',
  'active',
  '[
    {"key":"control","message":"Hola 👋 Soy Laura. Trabajo como recepcionista virtual. ¿A qué se dedica tu empresa?"},
    {"key":"value_first","message":"Hola 👋 Soy Laura. En dos minutos te diré qué empleados pueden quitarte más trabajo. ¿A qué se dedica tu empresa?"}
  ]'::jsonb,
  now()
)
on conflict (experiment_key) do nothing;
