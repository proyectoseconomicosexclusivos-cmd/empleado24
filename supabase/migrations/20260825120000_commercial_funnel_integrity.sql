-- One commercial identity from first visit through payment.  This extends the
-- existing Laura lead record instead of introducing a second sales CRM.

alter table public.sales_assistant_leads
  add column if not exists phone text,
  add column if not exists gclid text,
  add column if not exists meta_lead_id text,
  add column if not exists meta_campaign_id text,
  add column if not exists meta_adset_id text,
  add column if not exists meta_ad_id text,
  add column if not exists meta_form_id text,
  add column if not exists lead_source text not null default 'web'
    check (lead_source in ('web', 'meta_lead_form', 'whatsapp', 'retell')),
  add column if not exists consent_status text not null default 'unknown'
    check (consent_status in ('unknown', 'opted_in', 'opted_out')),
  add column if not exists consent_timestamp timestamptz,
  add column if not exists consent_source text,
  add column if not exists consent_version text,
  add column if not exists do_not_contact_at timestamptz,
  add column if not exists checkout_session_id text,
  add column if not exists provider_payment_id text;

create unique index if not exists sales_assistant_leads_meta_lead_unique
  on public.sales_assistant_leads(meta_lead_id)
  where meta_lead_id is not null;

create index if not exists sales_assistant_leads_attribution_idx
  on public.sales_assistant_leads(lead_source, meta_campaign_id, created_at desc);

-- Existing rows with an explicit Laura consent preserve that legal state.
update public.sales_assistant_leads
set consent_status = 'opted_in', consent_timestamp = coalesce(consent_timestamp, contact_consent_at),
    consent_source = coalesce(consent_source, contact_consent_source)
where contact_consent_at is not null and consent_status = 'unknown';

alter table public.business_events
  drop constraint if exists business_events_event_name_check;

alter table public.business_events
  add constraint business_events_event_name_check check (event_name = any (array[
    'landing_view','page_view','pricing_view','signup_started','signup_completed','registration_started','email_verified','email_confirmed','login','company_created','trial_started','trial_finished','employee_hired','phone_connected','calendar_connected','checkout_started','checkout_abandoned','payment_completed','checkout_completed','subscription_active','minutes_purchased','first_login','first_call','call_completed','email_sent','meeting_booked','sale_won','sale_lost','cancellation_requested','subscription_cancelled','subscription_reactivated','support_chat_opened','critical_error','sales_lead_created','sales_lead_hot','sales_meeting_scheduled','sales_quote_sent','sales_won','sales_lost','whatsapp_message_received','whatsapp_quote_requested','whatsapp_call_requested','whatsapp_meeting_scheduled','whatsapp_converted','whatsapp_escalated','whatsapp_lead_created','department_activated','quote_created','quote_sent','quote_accepted','quote_rejected','technical_project_analyzed',
    'lead_received','conversation_started','need_detected','employee_recommended','demo_offered','demo_started','demo_completed','objection_detected','offer_presented','lead_contacted'
  ]));
