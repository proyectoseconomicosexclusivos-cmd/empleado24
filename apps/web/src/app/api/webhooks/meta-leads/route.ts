import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordBusinessEvent } from '@/lib/business-events';

export const runtime = 'nodejs';

type Obj = Record<string, unknown>;

const object = (value: unknown): Obj => value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {};
const text = (value: unknown, maximum = 300) => typeof value === 'string' ? value.trim().slice(0, maximum) : '';
const email = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value.toLowerCase() : '';

function verified(raw: string, signature: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function fields(payload: Obj) {
  const data = Array.isArray(payload.field_data) ? payload.field_data : [];
  const result: Record<string, string> = {};
  for (const entry of data) {
    const item = object(entry); const name = text(item.name, 80).toLowerCase();
    const values = Array.isArray(item.values) ? item.values : [];
    if (name && typeof values[0] === 'string') result[name] = text(values[0]);
  }
  return result;
}

function first(input: Record<string, string>, names: string[]) {
  return names.map((name) => input[name]).find((value) => Boolean(value)) ?? '';
}

async function fetchLead(leadId: string) {
  const accessToken = process.env.META_LEAD_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  if (!accessToken) throw new Error('meta_lead_access_token_missing');
  const params = new URLSearchParams({
    fields: 'field_data,created_time,ad_id,adset_id,campaign_id,form_id', access_token: accessToken,
  });
  const response = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(leadId)}?${params}`, {
    cache: 'no-store', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`meta_lead_fetch_${response.status}`);
  return object(await response.json());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = process.env.META_LEAD_VERIFY_TOKEN;
  if (url.searchParams.get('hub.mode') === 'subscribe' && token && url.searchParams.get('hub.verify_token') === token)
    return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 });
  return new Response('forbidden', { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verified(raw, request.headers.get('x-hub-signature-256')))
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  let payload: Obj;
  try { payload = object(JSON.parse(raw)); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const accepted: string[] = [];
  for (const entry of (Array.isArray(payload.entry) ? payload.entry : [])) {
    const changes = object(entry).changes;
    for (const change of (Array.isArray(changes) ? changes : [])) {
      const value = object(object(change).value);
      const leadId = text(value.leadgen_id, 120);
      if (!leadId) continue;
      try {
        const provider = await fetchLead(leadId);
        const data = fields(provider);
        const leadEmail = email(first(data, ['email', 'email_address']));
        const name = first(data, ['full_name', 'nombre', 'name']);
        const companyName = first(data, ['company_name', 'empresa', 'company']) || 'Empresa pendiente de confirmar';
        // A lead form lacking a name or email cannot be safely associated with a
        // person, so Meta receives 200 but no commercial outreach is initiated.
        if (!leadEmail || name.length < 2) continue;
        const optedIn = ['true', 'yes', 'si', 'sí', '1'].includes(first(data, ['consent', 'marketing_consent', 'consentimiento']).toLowerCase());
        const admin = createAdminClient() as any;
        const { data: stored, error } = await admin.from('sales_assistant_leads').upsert({
          lead_token: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16),
          idempotency_key: `meta:${leadId}`, meta_lead_id: leadId, lead_source: 'meta_lead_form',
          name, email: leadEmail, phone: first(data, ['phone_number', 'telefono', 'teléfono']) || null,
          company_name: companyName, sector: first(data, ['sector', 'industry']) || null,
          meta_campaign_id: text(provider.campaign_id, 120) || null, meta_adset_id: text(provider.adset_id, 120) || null,
          meta_ad_id: text(provider.ad_id, 120) || null, meta_form_id: text(provider.form_id, 120) || null,
          // Meta supplied enough data to begin qualification, but we do not
          // claim a contact attempt until the opted-in channel is available.
          commercial_state: 'QUALIFYING', contact_consent_at: optedIn ? new Date().toISOString() : null,
          contact_consent_source: optedIn ? 'meta_lead_form' : null, consent_status: optedIn ? 'opted_in' : 'unknown',
          consent_timestamp: optedIn ? new Date().toISOString() : null, consent_source: optedIn ? 'meta_lead_form' : null,
        }, { onConflict: 'idempotency_key', ignoreDuplicates: true }).select('id,lead_token').maybeSingle();
        if (error) throw error;
        await recordBusinessEvent({
          eventName: 'lead_received', source: 'meta_lead_form', idempotencyKey: `meta:lead-received:${leadId}`,
          metadata: { lead_id: stored?.id ?? null, meta_lead_id: leadId, campaign_id: provider.campaign_id ?? null, adset_id: provider.adset_id ?? null, ad_id: provider.ad_id ?? null, form_id: provider.form_id ?? null, consent: optedIn },
        });
        accepted.push(leadId);
      } catch (error) {
        console.error(JSON.stringify({ event: 'meta_lead_failed', lead_id: leadId, message: error instanceof Error ? error.message : 'unknown' }));
        return NextResponse.json({ error: 'meta_lead_unavailable' }, { status: 503 });
      }
    }
  }
  return NextResponse.json({ received: true, accepted });
}
