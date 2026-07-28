import { createAdminClient } from '@/lib/supabase/admin';

export type BusinessEventName = 'landing_view' | 'page_view' | 'pricing_view' | 'signup_started' | 'signup_completed' | 'registration_started' | 'email_verified' | 'login' | 'trial_started' | 'trial_finished' | 'employee_hired' | 'phone_connected' | 'calendar_connected' | 'checkout_started' | 'payment_completed' | 'checkout_completed' | 'subscription_active' | 'minutes_purchased' | 'first_login' | 'first_call' | 'call_completed' | 'cancellation_requested' | 'subscription_cancelled' | 'subscription_reactivated' | 'support_chat_opened' | 'critical_error' | 'sales_lead_created' | 'sales_lead_hot' | 'sales_meeting_scheduled' | 'sales_quote_sent' | 'sales_won' | 'sales_lost';

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
    }, { onConflict: 'idempotency_key', ignoreDuplicates: true });
    if (error) {
      const code = String(error.code ?? '');
      if (code !== 'PGRST204' && code !== '42703') throw error;
      const legacy = await admin.from('business_events').insert({ event_name: input.eventName, path: input.path ?? null, anonymous_id: input.anonymousId ?? null, user_id: input.userId ?? null, company_id: input.companyId ?? null, metadata: input.metadata ?? {} });
      if (legacy.error) throw legacy.error;
    }
  })();
}
