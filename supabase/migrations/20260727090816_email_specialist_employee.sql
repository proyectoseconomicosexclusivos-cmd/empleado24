-- The Email Specialist is an Empleado24 employee, never a second application.
-- Every business record belongs to one company and is protected by the existing
-- membership predicates used throughout the platform.

create type public.email_campaign_status as enum ('draft', 'scheduled', 'sending', 'paused', 'completed', 'failed', 'canceled');
create type public.email_delivery_status as enum ('pending', 'sending', 'sent', 'failed', 'skipped');
create unique index employees_id_company_uidx on public.employees(id, company_id);

create table public.email_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  company_name text,
  tags text[] not null default '{}',
  consent_status text not null default 'unknown' check (consent_status in ('unknown', 'granted', 'withdrawn')),
  unsubscribed_at timestamptz,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  subject text not null check (length(trim(subject)) between 1 and 255),
  html_content text not null check (length(html_content) between 1 and 100000),
  preview_text text,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(employee_id, company_id) references public.employees(id, company_id) on delete cascade
);

create table public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  template_id uuid references public.email_templates(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 160),
  subject text not null check (length(trim(subject)) between 1 and 255),
  html_content text not null check (length(html_content) between 1 and 100000),
  preview_text text,
  status public.email_campaign_status not null default 'draft',
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  total_recipients integer not null default 0 check (total_recipients >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  last_error_code text,
  last_error_message text,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(employee_id, company_id) references public.employees(id, company_id) on delete cascade,
  check(sent_count + failed_count <= total_recipients)
);

create unique index email_campaigns_id_company_uidx on public.email_campaigns(id, company_id);

create table public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  contact_id uuid references public.email_contacts(id) on delete set null,
  email text not null,
  first_name text,
  delivery_status public.email_delivery_status not null default 'pending',
  provider_message_id text,
  attempts integer not null default 0 check (attempts >= 0),
  last_error_code text,
  last_error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id, email),
  foreign key(campaign_id, company_id) references public.email_campaigns(id, company_id) on delete cascade
);

create unique index email_contacts_company_email_lower_uidx on public.email_contacts(company_id, lower(email));
create index email_contacts_company_created_idx on public.email_contacts(company_id, created_at desc);
create index email_campaigns_company_status_idx on public.email_campaigns(company_id, status, created_at desc);
create index email_campaign_recipients_campaign_status_idx on public.email_campaign_recipients(campaign_id, delivery_status, created_at);

create or replace function public.enforce_email_specialist_scope() returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  employee_company uuid;
  employee_kind text;
  template_company uuid;
  contact_company uuid;
begin
  if tg_table_name in ('email_templates', 'email_campaigns') then
    select company_id, employee_type into employee_company, employee_kind from public.employees where id = new.employee_id;
    if employee_company is distinct from new.company_id or employee_kind <> 'email_specialist' then
      raise exception 'Email records must belong to the company Email Specialist' using errcode = '23514';
    end if;
  end if;

  if tg_table_name = 'email_campaigns' and new.template_id is not null then
    select company_id into template_company from public.email_templates where id = new.template_id;
    if template_company is distinct from new.company_id then
      raise exception 'Template belongs to another company' using errcode = '23514';
    end if;
  end if;

  if tg_table_name = 'email_campaign_recipients' then
    if new.contact_id is not null then
      select company_id into contact_company from public.email_contacts where id = new.contact_id;
      if contact_company is distinct from new.company_id then
        raise exception 'Contact belongs to another company' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end
$$;

create trigger email_templates_scope_guard before insert or update on public.email_templates for each row execute procedure public.enforce_email_specialist_scope();
create trigger email_campaigns_scope_guard before insert or update on public.email_campaigns for each row execute procedure public.enforce_email_specialist_scope();
create trigger email_campaign_recipients_scope_guard before insert or update on public.email_campaign_recipients for each row execute procedure public.enforce_email_specialist_scope();

alter table public.email_contacts enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;

create policy "members read email contacts" on public.email_contacts for select to authenticated using (public.is_company_member(company_id));
create policy "admins manage email contacts" on public.email_contacts for all to authenticated using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));
create policy "members read email templates" on public.email_templates for select to authenticated using (public.is_company_member(company_id));
create policy "admins manage email templates" on public.email_templates for all to authenticated using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));
create policy "members read email campaigns" on public.email_campaigns for select to authenticated using (public.is_company_member(company_id));
create policy "admins manage email campaigns" on public.email_campaigns for all to authenticated using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));
create policy "members read email campaign recipients" on public.email_campaign_recipients for select to authenticated using (public.is_company_member(company_id));
create policy "admins manage email campaign recipients" on public.email_campaign_recipients for all to authenticated using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));

grant select, insert, update, delete on public.email_contacts, public.email_templates, public.email_campaigns, public.email_campaign_recipients to authenticated;
grant all on public.email_contacts, public.email_templates, public.email_campaigns, public.email_campaign_recipients to service_role;
revoke all on public.email_contacts, public.email_templates, public.email_campaigns, public.email_campaign_recipients from anon;
