-- WhatsApp IA is a tenant-scoped employee. Credentials remain in the existing
-- company_integrations/Vault layer; these tables store only operational data.
create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  integration_id uuid not null references public.company_integrations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  customer_phone text not null,
  customer_name text,
  status text not null default 'open' check (status in ('open','closed','waiting','escalated')),
  last_message_at timestamptz,
  last_customer_message_at timestamptz,
  last_employee_message_at timestamptz,
  first_response_at timestamptz,
  message_count integer not null default 0 check (message_count >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, integration_id, customer_phone)
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  provider_message_id text not null unique,
  message_type text not null default 'text' check (message_type in ('text','image','document','audio','video','interactive','unknown')),
  body text,
  media_url text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_conversations_company_status_idx on public.whatsapp_conversations(company_id, status, updated_at desc);
create index if not exists whatsapp_messages_conversation_sent_idx on public.whatsapp_messages(conversation_id, sent_at);
create index if not exists whatsapp_messages_company_sent_idx on public.whatsapp_messages(company_id, sent_at desc);

create or replace function public.whatsapp_conversation_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.whatsapp_conversations
  set message_count = message_count + 1,
      last_message_at = new.sent_at,
      last_customer_message_at = case when new.direction = 'inbound' then new.sent_at else last_customer_message_at end,
      last_employee_message_at = case when new.direction = 'outbound' then new.sent_at else last_employee_message_at end,
      first_response_at = case when new.direction = 'outbound' then coalesce(first_response_at, new.sent_at) else first_response_at end,
      status = case when new.direction = 'inbound' and status = 'closed' then 'open' else status end,
      updated_at = now()
  where id = new.conversation_id and company_id = new.company_id;
  return new;
end;
$$;

drop trigger if exists whatsapp_messages_touch_conversation on public.whatsapp_messages;
create trigger whatsapp_messages_touch_conversation
after insert on public.whatsapp_messages for each row execute function public.whatsapp_conversation_touch();

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
create policy "members read whatsapp conversations" on public.whatsapp_conversations for select to authenticated using ((select public.is_company_member(company_id)));
create policy "members read whatsapp messages" on public.whatsapp_messages for select to authenticated using ((select public.is_company_member(company_id)));
grant select on public.whatsapp_conversations, public.whatsapp_messages to authenticated;
grant all on public.whatsapp_conversations, public.whatsapp_messages to service_role;
revoke all on public.whatsapp_conversations, public.whatsapp_messages from anon;

insert into public.billing_plans (plan_key,name,description,monthly_price_cents,currency,trial_days,active,self_serve_enabled,sort_order,employee_limit,member_limit,knowledge_item_limit,retention_days)
values ('employee_whatsapp','WhatsApp IA','Atiende conversaciones de WhatsApp, responde dudas y abre oportunidades.',9700,'EUR',3,true,true,15,1,2,50,30)
on conflict (plan_key) do update set
  name = excluded.name, description = excluded.description, monthly_price_cents = excluded.monthly_price_cents,
  currency = excluded.currency, trial_days = excluded.trial_days, active = true, self_serve_enabled = true, updated_at = now();

alter table public.business_events drop constraint if exists business_events_event_name_check;
alter table public.business_events add constraint business_events_event_name_check check (event_name in (
  'landing_view','page_view','pricing_view','signup_started','signup_completed','registration_started','email_verified','login','trial_started','trial_finished','employee_hired','phone_connected','calendar_connected','checkout_started','payment_completed','checkout_completed','subscription_active','minutes_purchased','first_login','first_call','call_completed','cancellation_requested','subscription_cancelled','subscription_reactivated','support_chat_opened','critical_error','sales_lead_created','sales_lead_hot','sales_meeting_scheduled','sales_quote_sent','sales_won','sales_lost',
  'whatsapp_message_received','whatsapp_quote_requested','whatsapp_call_requested','whatsapp_meeting_scheduled','whatsapp_converted','whatsapp_escalated','whatsapp_lead_created'
));
