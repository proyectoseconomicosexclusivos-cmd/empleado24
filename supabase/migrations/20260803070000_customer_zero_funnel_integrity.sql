-- Ensure the events owned by Supabase Auth are persisted in the same transaction.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  company_uuid uuid;
  default_name text := coalesce(nullif(trim(new.raw_user_meta_data->>'company_name'), ''), 'Mi empresa');
begin
  insert into public.users(id, full_name, avatar_url)
  values(new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');

  insert into public.companies(name, sector, country, currency, locale, timezone, created_by)
  values(default_name, nullif(trim(new.raw_user_meta_data->>'sector'), ''), nullif(trim(new.raw_user_meta_data->>'country'), ''), 'EUR', 'es', 'Europe/Madrid', new.id)
  returning id into company_uuid;

  insert into public.members(company_id, user_id, role) values(company_uuid, new.id, 'owner');
  insert into public.settings(company_id, data) values(company_uuid, jsonb_build_object('onboarding_completed', false));
  insert into public.employees(company_id, name, employee_type, status, runtime_status, primary_locale, description, knowledge_score)
  values(company_uuid, 'Recepcionista', 'receptionist', 'draft', 'unconfigured', 'es', 'Se está preparando para conocer tu empresa y atender a tus clientes.', 0);
  insert into public.activity_logs(company_id, event_type, payload) values(company_uuid, 'company.created', jsonb_build_object('source', 'auth_signup'));
  insert into public.notifications(company_id, user_id, type, title, body)
  values(company_uuid, new.id, 'welcome', 'Tu Recepcionista te está esperando', 'Cuéntale cómo funciona tu empresa antes de conectar su línea.');
  insert into public.business_events(event_name, user_id, company_id, source, idempotency_key, metadata)
  values('company_created', new.id, company_uuid, 'auth.trigger', 'company-created:' || company_uuid::text, jsonb_build_object('source', 'auth_signup'))
  on conflict (idempotency_key) do nothing;
  return new;
end;
$$;

create or replace function public.handle_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  company_uuid uuid;
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    select company_id into company_uuid from public.members where user_id = new.id limit 1;
    insert into public.business_events(event_name, user_id, company_id, source, idempotency_key, metadata)
    values('email_confirmed', new.id, company_uuid, 'auth.trigger', 'email-confirmed:' || new.id::text || ':' || new.email_confirmed_at::text, jsonb_build_object('source', 'auth_email_confirmation'))
    on conflict (idempotency_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute procedure public.handle_email_confirmed();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_email_confirmed() from public, anon, authenticated;
