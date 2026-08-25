import { createAdminClient } from '@/lib/supabase/admin';

export type BusinessEventName = 'landing_view' | 'page_view' | 'pricing_view' | 'signup_started' | 'signup_completed' | 'registration_started' | 'email_verified' | 'email_confirmed' | 'login' | 'company_created' | 'trial_started' | 'trial_finished' | 'employee_hired' | 'phone_connected' | 'calendar_connected' | 'checkout_started' | 'checkout_abandoned' | 'payment_completed' | 'checkout_completed' | 'subscription_active' | 'minutes_purchased' | 'first_login' | 'first_call' | 'call_completed' | 'email_sent' | 'meeting_booked' | 'sale_won' | 'sale_lost' | 'cancellation_requested' | 'subscription_cancelled' | 'subscription_reactivated' | 'support_chat_opened' | 'critical_error' | 'sales_lead_created' | 'sales_lead_hot' | 'sales_meeting_scheduled' | 'sales_quote_sent' | 'sales_won' | 'sales_lost' | 'whatsapp_message_received' | 'whatsapp_quote_requested' | 'whatsapp_call_requested' | 'whatsapp_meeting_scheduled' | 'whatsapp_converted' | 'whatsapp_escalated' | 'whatsapp_lead_created' | 'department_activated' | 'quote_created' | 'quote_sent' | 'quote_accepted' | 'quote_rejected' | 'technical_project_analyzed' | 'lead_received' | 'conversation_started' | 'need_detected' | 'employee_recommended' | 'demo_offered' | 'demo_started' | 'demo_completed' | 'objection_detected' | 'offer_presented' | 'lead_contacted';

export function recordBusinessEvent(input: {
  eventName: BusinessEventName;
  path?: string | null;
  anonymousId?: string | null;
  userId?: string | null;
  companyId?: string | null;
  metadata?: Record<string, unknown>;
  eventId?: string;
  sessionId?: string | null;
  source?: string;
  idempotencyKey?: string;
  visitorId?: string | null;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null; content?: string | null; term?: string | null; fbclid?: string | null; referrer?: string | null; landing?: string | null };
}) {
  return (async () => {
    const admin = createAdminClient() as any;
    const eventId = input.eventId ?? crypto.randomUUID();
    const stableProviderId = input.metadata?.provider_event_id ?? input.metadata?.session_id ?? input.metadata?.checkout_session_id ?? input.metadata?.payment_id;
    const idempotencyKey = input.idempotencyKey ?? `${input.eventName}:${input.companyId ?? input.userId ?? input.anonymousId ?? 'anonymous'}:${String(stableProviderId ?? eventId)}`;
    const { error } = await admin.from('business_events').upsert({
      event_id: eventId,
      event_name: input.eventName,
      path: input.path ?? null,
      anonymous_id: input.anonymousId ?? null,
      user_id: input.userId ?? null,
      company_id: input.companyId ?? null,
      metadata: input.metadata ?? {},
      session_id: input.sessionId ?? null,
      source: input.source ?? 'app',
      idempotency_key: idempotencyKey,
      visitor_id: input.visitorId ?? input.anonymousId ?? null,
      utm_source: input.utm?.source ?? null,
      utm_medium: input.utm?.medium ?? null,
      utm_campaign: input.utm?.campaign ?? null,
      utm_content: input.utm?.content ?? null,
      utm_term: input.utm?.term ?? null,
      fbclid: input.utm?.fbclid ?? null,
      referrer: input.utm?.referrer ?? null,
      landing: input.utm?.landing ?? input.path ?? null,
    }, { onConflict: 'idempotency_key', ignoreDuplicates: true });
    if (error) throw error;
  })();
}
