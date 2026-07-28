import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processWhatsAppMessage, verifyWhatsAppSignature } from '@/lib/whatsapp-runtime';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const text = (v: unknown) => typeof v === 'string' ? v : '';

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 });
  return new Response('forbidden', { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWhatsAppSignature(raw, request.headers.get('x-hub-signature-256'))) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  let payload: Obj;
  try { payload = obj(JSON.parse(raw)); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  const results: unknown[] = [];
  for (const entry of entries) {
    const changes = obj(entry).changes;
    for (const change of (Array.isArray(changes) ? changes : [])) {
    const value = obj(obj(change).value); const metadata = obj(value.metadata); const phoneNumberId = text(metadata.phone_number_id);
    const contacts = Array.isArray(value.contacts) ? value.contacts : [];
    const contact = obj(contacts[0]); const profile = obj(contact.profile); const names = new Map(contacts.map((c) => [text(obj(c).wa_id), text(obj(obj(c).profile).name)]));
    for (const message of (Array.isArray(value.messages) ? value.messages : [])) {
      const m = obj(message); const id = text(m.id); const from = text(m.from); const type = text(m.type) || 'unknown'; const body = text(obj(m.text).body) || text(obj(m.button).text) || text(obj(m.interactive).button_reply && obj(obj(m.interactive).button_reply).title);
      if (!phoneNumberId || !id || !from) continue;
      results.push(await processWhatsAppMessage({ phoneNumberId, providerMessageId: id, from, name: names.get(from) || text(profile.name), body, type, raw: m }));
    }
  }
  }
  return NextResponse.json({ received: true, results });
}
