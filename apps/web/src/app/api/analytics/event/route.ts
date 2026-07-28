import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { guardRateLimit } from '@/lib/api-guard';

const allowed = new Set(['landing_view','page_view','pricing_view','signup_started','signup_completed','registration_started','email_verified','login','trial_started','trial_finished','employee_hired','phone_connected','calendar_connected','checkout_started','payment_completed','checkout_completed','subscription_active','minutes_purchased','first_login','first_call','call_completed','cancellation_requested','subscription_cancelled','subscription_reactivated','support_chat_opened','critical_error','sales_lead_created','sales_lead_hot','sales_meeting_scheduled','sales_quote_sent','sales_won','sales_lost']);

export async function POST(request: Request) {
  const limited = await guardRateLimit(request, { action: 'analytics.event', maxRequests: 120, windowSeconds: 60, dimensions: [{ kind: 'identity', value: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown' }] });
  if (limited) return limited;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const eventName = typeof body.eventName === 'string' && allowed.has(body.eventName) ? body.eventName : null;
  if (!eventName) return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
  const path = typeof body.path === 'string' ? body.path.slice(0, 200) : null;
  const anonymousId = typeof body.anonymousId === 'string' ? body.anonymousId.slice(0, 120) : null;
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 120) : null;
  const eventId = typeof body.eventId === 'string' ? body.eventId.slice(0, 80) : null;
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.slice(0, 240) : null;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const ipHash = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 24) : null;
  const result = await (createAdminClient() as any).from('business_events').upsert({ event_id: eventId ?? crypto.randomUUID(), event_name: eventName, path, anonymous_id: anonymousId, session_id: sessionId, source: typeof body.source === 'string' ? body.source.slice(0, 40) : 'app', idempotency_key: idempotencyKey ?? `${eventName}:${anonymousId ?? 'anonymous'}:${sessionId ?? 'session'}:${path ?? ''}`, metadata: { ip_hash: ipHash, referrer: request.headers.get('referer')?.slice(0, 300) ?? null } }, { onConflict: 'idempotency_key', ignoreDuplicates: true });
  if (result.error) {
    const code = String(result.error.code ?? '');
    if (code !== 'PGRST204' && code !== '42703') return NextResponse.json({ error: 'event_unavailable' }, { status: 503 });
    const legacy = await (createAdminClient() as any).from('business_events').insert({ event_name: eventName, path, anonymous_id: anonymousId, metadata: { ip_hash: ipHash, referrer: request.headers.get('referer')?.slice(0, 300) ?? null } });
    if (legacy.error) return NextResponse.json({ error: 'event_unavailable' }, { status: 503 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
