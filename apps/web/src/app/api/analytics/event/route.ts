import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { guardRateLimit } from '@/lib/api-guard';

const allowed = new Set([
  'landing_view',
  'page_view',
  'pricing_view',
  'signup_started',
  'signup_completed',
  'registration_started',
  'email_verified',
  'email_confirmed',
  'login',
  'company_created',
  'trial_started',
  'trial_finished',
  'employee_hired',
  'phone_connected',
  'calendar_connected',
  'checkout_started',
  'payment_completed',
  'checkout_completed',
  'subscription_active',
  'minutes_purchased',
  'first_login',
  'first_call',
  'call_completed',
  'email_sent',
  'meeting_booked',
  'sale_won',
  'sale_lost',
  'cancellation_requested',
  'subscription_cancelled',
  'subscription_reactivated',
  'support_chat_opened',
  'critical_error',
  'sales_lead_created',
  'sales_lead_hot',
  'sales_meeting_scheduled',
  'sales_quote_sent',
  'sales_won',
  'sales_lost',
  'whatsapp_message_received',
  'whatsapp_quote_requested',
  'whatsapp_call_requested',
  'whatsapp_meeting_scheduled',
  'whatsapp_converted',
  'whatsapp_escalated',
  'whatsapp_lead_created',
  'onboarding_step_viewed',
  'onboarding_step_completed',
]);

function optionalText(value: unknown, maximum = 300) {
  return typeof value === 'string' ? value.slice(0, maximum) || null : null;
}

function croMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const text = (key: string, maximum = 80) => optionalText(input[key], maximum);
  const integer = (key: string, minimum: number, maximum: number) => {
    const candidate = input[key];
    return typeof candidate === 'number' &&
      Number.isInteger(candidate) &&
      candidate >= minimum &&
      candidate <= maximum
      ? candidate
      : undefined;
  };
  return {
    action: text('action'),
    label: text('label', 120),
    zone: text('zone'),
    scroll_depth: integer('scrollDepth', 0, 100),
    x_bucket: integer('xBucket', 0, 9),
    y_bucket: integer('yBucket', 0, 9),
    duration_seconds: integer('durationSeconds', 0, 86_400),
    gclid: text('gclid', 300),
    ad: text('ad', 200),
    device: ['desktop', 'mobile', 'tablet'].includes(String(input.device)) ? input.device : undefined,
    browser: text('browser', 40),
    language: text('language', 20),
  };
}

export async function POST(request: Request) {
  const limited = await guardRateLimit(request, {
    action: 'analytics.event',
    maxRequests: 120,
    windowSeconds: 60,
    dimensions: [
      {
        kind: 'identity',
        value: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown',
      },
    ],
  });
  if (limited) return limited;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const eventName =
    typeof body.eventName === 'string' && allowed.has(body.eventName) ? body.eventName : null;
  if (!eventName) return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
  const path = typeof body.path === 'string' ? body.path.slice(0, 200) : null;
  const anonymousId = typeof body.anonymousId === 'string' ? body.anonymousId.slice(0, 120) : null;
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 120) : null;
  const eventId = typeof body.eventId === 'string' ? body.eventId.slice(0, 80) : null;
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey.slice(0, 240) : null;
  const visitorId = optionalText(body.visitorId, 120) ?? anonymousId;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const ipHash = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 24) : null;
  const proxyCountry = optionalText(
    request.headers.get('cf-ipcountry') ?? request.headers.get('x-vercel-ip-country'),
    8,
  );
  const referrer =
    optionalText(body.referrer) ?? request.headers.get('referer')?.slice(0, 300) ?? null;
  const result = await (createAdminClient() as any).from('business_events').upsert(
    {
      event_id: eventId ?? crypto.randomUUID(),
      event_name: eventName,
      path,
      anonymous_id: anonymousId,
      visitor_id: visitorId,
      session_id: sessionId,
      source: optionalText(body.source, 40) ?? 'app',
      idempotency_key:
        idempotencyKey ??
        `${eventName}:${visitorId ?? 'anonymous'}:${sessionId ?? 'session'}:${path ?? ''}`,
      utm_source: optionalText(body.utmSource, 120),
      utm_medium: optionalText(body.utmMedium, 120),
      utm_campaign: optionalText(body.utmCampaign, 200),
      utm_content: optionalText(body.utmContent, 200),
      utm_term: optionalText(body.utmTerm, 200),
      fbclid: optionalText(body.fbclid, 300),
      referrer,
      landing: optionalText(body.landing, 300) ?? path,
      metadata: { ip_hash: ipHash, country: proxyCountry, city: null, ...croMetadata(body.metadata) },
    },
    { onConflict: 'idempotency_key', ignoreDuplicates: true },
  );
  if (result.error) {
    return NextResponse.json({ error: 'event_unavailable' }, { status: 503 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
