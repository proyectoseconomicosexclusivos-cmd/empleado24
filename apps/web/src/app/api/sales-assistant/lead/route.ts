import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { guardRateLimit } from '@/lib/api-guard';
import { recordBusinessEvent } from '@/lib/business-events';
import { createAdminClient } from '@/lib/supabase/admin';

type LeadBody = Record<string, unknown>;

function text(value: unknown, maximum: number) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function email(value: unknown) {
  const candidate = text(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : null;
}

function token() {
  return randomBytes(24).toString('base64url');
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LeadBody | null;
  const name = text(body?.name, 120);
  const targetEmail = email(body?.email);
  // A commercial lead is useful as soon as we can identify and contact the
  // person. Company details are progressively enriched by Laura instead of
  // withholding the lead until every field is known.
  const companyName = text(body?.companyName, 160) || 'Empresa pendiente de confirmar';
  const phone = text(body?.phone, 40) || null;
  const anonymousId = text(body?.anonymousId, 120) || null;
  const sessionId = text(body?.sessionId, 120) || null;
  const idempotencyKey = text(body?.idempotencyKey, 240);
  const recommendation = Array.isArray(body?.recommendation)
    ? body.recommendation.filter((value): value is string => typeof value === 'string').slice(0, 4)
    : [];
  const roiSnapshot = body?.roiSnapshot && typeof body.roiSnapshot === 'object' && !Array.isArray(body.roiSnapshot)
    ? body.roiSnapshot as Record<string, unknown>
    : {};
  const contactConsent = body?.contactConsent === true;
  const gclid = text(body?.gclid, 300) || null;

  if (name.length < 2 || !targetEmail || !idempotencyKey)
    return NextResponse.json({ error: 'invalid_lead' }, { status: 400 });

  const limited = await guardRateLimit(request, {
    action: 'sales_assistant.lead',
    maxRequests: 5,
    windowSeconds: 60 * 60,
    dimensions: [
      { kind: 'identity', value: targetEmail },
      { kind: 'identity', value: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown' },
    ],
  });
  if (limited) return limited;

  const admin = createAdminClient() as any;
  const leadToken = token();
  const lead = {
    lead_token: leadToken,
    idempotency_key: idempotencyKey,
    name,
    email: targetEmail,
    company_name: companyName,
    phone,
    sector: text(body?.sector, 80) || null,
    company_size: text(body?.companySize, 40) || null,
    primary_problem: text(body?.primaryProblem, 80) || null,
    recommended_employees: recommendation,
    anonymous_id: anonymousId,
    session_id: sessionId,
    landing: text(body?.landing, 300) || null,
    referrer: text(body?.referrer, 300) || null,
    utm_source: text(body?.utmSource, 120) || null,
    utm_medium: text(body?.utmMedium, 120) || null,
    utm_campaign: text(body?.utmCampaign, 200) || null,
    utm_content: text(body?.utmContent, 200) || null,
    utm_term: text(body?.utmTerm, 200) || null,
    fbclid: text(body?.fbclid, 300) || null,
    gclid,
    lead_source: 'web',
    commercial_state: 'QUALIFIED',
    roi_snapshot: roiSnapshot,
    contact_consent_at: contactConsent ? new Date().toISOString() : null,
    contact_consent_source: contactConsent ? 'laura_lead_form' : null,
    consent_status: contactConsent ? 'opted_in' : 'unknown',
    consent_timestamp: contactConsent ? new Date().toISOString() : null,
    consent_source: contactConsent ? 'laura_lead_form' : null,
  };
  const { data, error } = await admin
    .from('sales_assistant_leads')
    .upsert(lead, { onConflict: 'idempotency_key' })
    .select('lead_token')
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'lead_unavailable' }, { status: 503 });

  let persistedToken = data?.lead_token ?? null;
  if (!persistedToken) {
    const { data: existing } = await admin
      .from('sales_assistant_leads')
      .select('lead_token')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    persistedToken = existing?.lead_token ?? null;
  }
  if (!persistedToken) return NextResponse.json({ error: 'lead_unavailable' }, { status: 503 });
  if (anonymousId) {
    await admin.from('sales_assistant_conversations').update({
      commercial_state: 'QUALIFIED',
      conversation_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('anonymous_id', anonymousId);
  }
  await Promise.all(['lead_received', 'sales_lead_created', 'offer_presented'].map((eventName) => recordBusinessEvent({
    eventName: eventName as 'lead_received' | 'sales_lead_created' | 'offer_presented',
    path: '/',
    anonymousId,
    visitorId: anonymousId,
    sessionId,
    source: 'laura_sales_assistant',
    idempotencyKey: `laura:lead:${eventName}:${idempotencyKey}`,
    metadata: { assistant: 'laura', lead_token: persistedToken, recommendation, sector: lead.sector, primary_problem: lead.primary_problem, contact_consent: contactConsent, phone_captured: Boolean(phone) },
    utm: {
      source: lead.utm_source,
      medium: lead.utm_medium,
      campaign: lead.utm_campaign,
      content: lead.utm_content,
      term: lead.utm_term,
      fbclid: lead.fbclid,
      referrer: lead.referrer,
      landing: lead.landing,
    },
  }).catch(() => undefined)));

  return NextResponse.json({ ok: true, leadToken: persistedToken }, { status: 201 });
}

/**
 * The token is only ever present in the visitor's own continuation URL. It
 * lets registration reuse Laura's captured details without putting email or
 * company name into URL parameters.
 */
export async function GET(request: Request) {
  const leadToken = text(new URL(request.url).searchParams.get('token'), 128);
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(leadToken)) return NextResponse.json({ error: 'invalid_lead' }, { status: 400 });
  const { data, error } = await (createAdminClient() as any)
    .from('sales_assistant_leads')
    .select('name,email,company_name,recommended_employees')
    .eq('lead_token', leadToken)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 });
  return NextResponse.json({ lead: data });
}
