import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { createOpportunityFromWhatsApp } from '@/lib/sales-runtime';
import { recordBusinessEvent } from '@/lib/business-events';
import { notifyOwner } from '@/lib/owner-notifications';

type RecordValue = Record<string, unknown>;
const asObject = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const asText = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export function verifyWhatsAppSignature(raw: string, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signature?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function credentials(integrationId: string) {
  const admin = createAdminClient() as any;
  const { data, error } = await admin.rpc('service_read_integration_credentials', { target_integration: integrationId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const values = asObject(row?.credentials ?? row);
  const accessToken = asText(values.access_token);
  if (!accessToken) throw new Error('whatsapp_credentials_missing');
  return accessToken;
}

async function sendText(input: { integrationId: string; phoneNumberId: string; to: string; body: string }) {
  const token = await credentials(input.integrationId);
  const version = process.env.WHATSAPP_GRAPH_API_VERSION ?? 'v21.0';
  const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(input.phoneNumberId)}/messages`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: input.to, type: 'text', text: { body: input.body.slice(0, 4096) } }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`whatsapp_send_${response.status}`);
  const payload = await response.json() as RecordValue;
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  return asText(asObject(messages[0]).id) || `local:${crypto.randomUUID()}`;
}

function intention(text: string) {
  const normal = text.toLocaleLowerCase('es-ES');
  if (/presupuesto|precio|tarifa|cotiz/.test(normal)) return 'quote';
  if (/llamada|llamadme|hablar por tel[eé]fono|cita|reuni[oó]n/.test(normal)) return 'call';
  if (/informaci[oó]n|cat[aá]logo|documentaci[oó]n|enviame|env[ií]ame/.test(normal)) return 'information';
  if (/no soy cliente|primera vez|nuevo cliente/.test(normal)) return 'lead';
  if (/persona|humano|queja|reclamaci[oó]n|urgente/.test(normal)) return 'escalate';
  return 'answer';
}

function reply(intent: string, companyName: string) {
  if (intent === 'quote') return `Gracias por tu interés en ${companyName}. He pedido que preparen tu presupuesto y te contactarán enseguida.`;
  if (intent === 'call') return `Perfecto. He avisado al equipo de ${companyName} para organizar una llamada contigo.`;
  if (intent === 'information') return `Claro. He pedido que te envíen la información de ${companyName} por email.`;
  if (intent === 'lead') return `¡Encantados de conocerte! En ${companyName} revisaremos cómo podemos ayudarte.`;
  if (intent === 'escalate') return `He avisado a una persona del equipo de ${companyName} para que pueda ayudarte personalmente.`;
  return `Gracias por escribir a ${companyName}. Hemos recibido tu mensaje y te ayudaremos enseguida.`;
}

export async function processWhatsAppMessage(input: { phoneNumberId: string; providerMessageId: string; from: string; name?: string; body: string; type: string; raw: RecordValue }) {
  const admin = createAdminClient() as any;
  const { data: integration, error } = await admin.from('company_integrations').select('id,company_id,public_config,status,enabled').eq('provider_key', 'whatsapp_meta').eq('status', 'connected').eq('enabled', true).filter('public_config->>phone_number_id', 'eq', input.phoneNumberId).maybeSingle();
  if (error) throw error;
  if (!integration) return { ignored: true as const };
  const { data: employee } = await admin.from('employees').select('id,name').eq('company_id', integration.company_id).eq('employee_type', 'whatsapp').eq('status', 'active').maybeSingle();
  if (!employee) return { ignored: true as const };
  const { data: company } = await admin.from('companies').select('name').eq('id', integration.company_id).single();
  const existing = await admin.from('whatsapp_messages').select('id').eq('provider_message_id', input.providerMessageId).maybeSingle();
  if (existing.data) return { duplicate: true as const };
  const { data: conversation, error: conversationError } = await admin.from('whatsapp_conversations').upsert({ company_id: integration.company_id, integration_id: integration.id, employee_id: employee.id, customer_phone: input.from, customer_name: input.name || null, status: 'open' }, { onConflict: 'company_id,integration_id,customer_phone' }).select('id').single();
  if (conversationError || !conversation) throw conversationError ?? new Error('whatsapp_conversation_failed');
  const incoming = await admin.from('whatsapp_messages').insert({ company_id: integration.company_id, conversation_id: conversation.id, direction: 'inbound', provider_message_id: input.providerMessageId, message_type: ['text','image','document','audio','video','interactive'].includes(input.type) ? input.type : 'unknown', body: input.body || null, payload: input.raw });
  if (incoming.error?.code === '23505') return { duplicate: true as const };
  if (incoming.error) throw incoming.error;

  const intent = intention(input.body);
  const response = reply(intent, company?.name ?? 'nuestra empresa');
  const outgoingId = await sendText({ integrationId: integration.id, phoneNumberId: input.phoneNumberId, to: input.from, body: response });
  await admin.from('whatsapp_messages').upsert({ company_id: integration.company_id, conversation_id: conversation.id, direction: 'outbound', provider_message_id: outgoingId, message_type: 'text', body: response, payload: { intent, automated: true } }, { onConflict: 'provider_message_id', ignoreDuplicates: true });
  const eventName = intent === 'quote' ? 'whatsapp_quote_requested' : intent === 'call' ? 'whatsapp_call_requested' : intent === 'lead' ? 'whatsapp_lead_created' : intent === 'escalate' ? 'whatsapp_escalated' : 'whatsapp_message_received';
  if (intent === 'escalate') await admin.from('whatsapp_conversations').update({ status: 'escalated', updated_at: new Date().toISOString() }).eq('id', conversation.id);
  if (intent === 'quote' || intent === 'lead') await createOpportunityFromWhatsApp({ companyId: integration.company_id, conversationId: conversation.id, name: input.name, phone: input.from, notes: input.body, hot: intent === 'quote' });
  await Promise.all([
    recordBusinessEvent({ eventName, companyId: integration.company_id, metadata: { conversation_id: conversation.id, provider_message_id: input.providerMessageId, intent }, idempotencyKey: `whatsapp:${input.providerMessageId}` }),
    notifyOwner({ subject: 'WhatsApp IA', message: `${input.name || input.from} ha escrito a ${company?.name ?? 'una empresa'}.`, companyId: integration.company_id, event: `whatsapp.${intent === 'quote' ? 'quote.requested' : intent === 'call' ? 'call.requested' : intent === 'escalate' ? 'escalated' : 'message.received'}` }),
  ]);
  return { processed: true as const, conversationId: conversation.id, intent };
}
