import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { createOpportunityFromWhatsApp } from '@/lib/sales-runtime';
import { recordBusinessEvent } from '@/lib/business-events';
import { notifyOwner } from '@/lib/owner-notifications';
import { customerContext, getCustomer, publishEvent, saveMemory } from '@/lib/empleado24-brain';

type RecordValue = Record<string, unknown>;
type WhatsAppIntent = 'answer' | 'quote' | 'callback' | 'appointment' | 'email' | 'lead' | 'existing_customer' | 'urgent' | 'complaint';
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

function intention(text: string): WhatsAppIntent {
  const normal = text.toLocaleLowerCase('es-ES');
  if (/queja|reclamaci[oó]n|enfadad|molest|denuncia/.test(normal)) return 'complaint';
  if (/urgente|emergencia|ahora mismo|inmediatamente/.test(normal)) return 'urgent';
  if (/presupuesto|cotiz|cu[aá]nto cuesta|precio|tarifa/.test(normal)) return 'quote';
  if (/ll[aá]mame|llamadme|quiero que me llam|hablar por tel[eé]fono/.test(normal)) return 'callback';
  if (/cita|reuni[oó]n|agenda|reservar.*hora/.test(normal)) return 'appointment';
  if (/email|correo|m[aá]ndamelo|env[ií]amelo/.test(normal)) return 'email';
  if (/ya soy cliente|soy cliente|mi pedido|mi factura|mi contrato/.test(normal)) return 'existing_customer';
  if (/quiero contratar|me interesa|quiero comprar|necesito.*servicio|informaci[oó]n.*servicio/.test(normal)) return 'lead';
  return 'answer';
}

function reply(intent: WhatsAppIntent, companyName: string, hasHistory: boolean, context?: { events: Array<{ event_name: string }> }) {
  const hasQuote = context?.events.some((event) => event.event_name === 'BudgetSent') ?? false;
  const hasMeeting = context?.events.some((event) => event.event_name === 'MeetingBooked') ?? false;
  const greeting = hasHistory ? 'Gracias por volver a escribirnos. ' : '';
  if (intent === 'existing_customer' && hasMeeting) return `${greeting}Veo que tienes una cita pendiente con ${companyName}. Si quieres cambiarla, dime qué horario te viene mejor.`;
  if (intent === 'existing_customer' && hasQuote) return `${greeting}Veo que ya recibiste información de ${companyName}. Voy a avisar al equipo para que te ayude con tu consulta.`;
  if (intent === 'quote') return `Gracias por tu interés en ${companyName}. He pedido que preparen tu presupuesto y te contactarán enseguida.`;
  if (intent === 'callback') return `${greeting}He avisado al equipo de ${companyName} para organizar una llamada contigo.`;
  if (intent === 'appointment') return `${greeting}Podemos prepararte una cita. Dime qué día y a qué hora te viene mejor.`;
  if (intent === 'email') return `${greeting}Claro. Indícame el correo al que quieres que te enviemos la información.`;
  if (intent === 'existing_customer') return `${greeting}Voy a revisar tu solicitud con el equipo de ${companyName} para ayudarte con tu servicio.`;
  if (intent === 'lead') return `${greeting}¡Encantados de conocerte! En ${companyName} revisaremos cómo podemos ayudarte.`;
  if (intent === 'complaint' || intent === 'urgent') return `${greeting}He marcado tu mensaje como prioritario para que una persona del equipo de ${companyName} pueda ayudarte cuanto antes.`;
  return `${greeting}Gracias por escribir a ${companyName}. Estoy aquí para ayudarte. ¿Qué necesitas?`;
}

function conversationDetails(intent: WhatsAppIntent) {
  if (intent === 'quote') return { status: 'open', priority: 'high', label: 'Presupuesto solicitado', action: 'quote' as const };
  if (intent === 'callback') return { status: 'waiting', priority: 'high', label: 'Llamada solicitada', action: 'call' as const };
  if (intent === 'appointment') return { status: 'waiting', priority: 'high', label: 'Cita pendiente de fecha', action: 'meeting' as const };
  if (intent === 'email') return { status: 'waiting', priority: 'normal', label: 'Información por email', action: 'email' as const };
  if (intent === 'lead') return { status: 'open', priority: 'high', label: 'Cliente interesado', action: 'task' as const };
  if (intent === 'complaint' || intent === 'urgent') return { status: 'escalated', priority: 'urgent', label: intent === 'complaint' ? 'Cliente necesita atención' : 'Mensaje urgente', action: 'task' as const };
  return { status: 'open', priority: 'normal', label: 'En conversación', action: 'task' as const };
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
  const previous = await admin.from('whatsapp_conversations').select('id,message_count').eq('company_id', integration.company_id).eq('integration_id', integration.id).eq('customer_phone', input.from).maybeSingle();
  if (previous.error) throw previous.error;
  const intent = intention(input.body);
  const details = conversationDetails(intent);
  const customer = await getCustomer({
    companyId: integration.company_id,
    name: input.name,
    phone: input.from,
    whatsapp: input.from,
    source: 'whatsapp',
  });
  const context = await customerContext(integration.company_id, customer.id);
  const { data: conversation, error: conversationError } = await admin.from('whatsapp_conversations').upsert({
    company_id: integration.company_id,
    integration_id: integration.id,
    employee_id: employee.id,
    customer_phone: input.from,
    customer_name: input.name || null,
    status: details.status,
    metadata: { priority: details.priority, label: details.label, last_intent: intent, tags: [details.label] },
  }, { onConflict: 'company_id,integration_id,customer_phone' }).select('id').single();
  if (conversationError || !conversation) throw conversationError ?? new Error('whatsapp_conversation_failed');
  const incoming = await admin.from('whatsapp_messages').insert({ company_id: integration.company_id, conversation_id: conversation.id, direction: 'inbound', provider_message_id: input.providerMessageId, message_type: ['text','image','document','audio','video','interactive'].includes(input.type) ? input.type : 'unknown', body: input.body || null, payload: input.raw });
  if (incoming.error?.code === '23505') return { duplicate: true as const };
  if (incoming.error) throw incoming.error;

  const response = reply(intent, company?.name ?? 'nuestra empresa', Number(previous.data?.message_count ?? 0) > 0, context);
  const outgoingId = await sendText({ integrationId: integration.id, phoneNumberId: input.phoneNumberId, to: input.from, body: response });
  await admin.from('whatsapp_messages').upsert({ company_id: integration.company_id, conversation_id: conversation.id, direction: 'outbound', provider_message_id: outgoingId, message_type: 'text', body: response, payload: { intent, automated: true } }, { onConflict: 'provider_message_id', ignoreDuplicates: true });
  // A calendar appointment is only created after the client has supplied a
  // concrete date and time. Until then this is an explicit request, not a
  // misleading confirmation that a meeting exists.
  const eventName = intent === 'quote' ? 'whatsapp_quote_requested' : intent === 'callback' ? 'whatsapp_call_requested' : intent === 'appointment' ? 'whatsapp_meeting_scheduled' : intent === 'lead' ? 'whatsapp_lead_created' : ['urgent', 'complaint'].includes(intent) ? 'whatsapp_escalated' : 'whatsapp_message_received';
  if (['quote', 'callback', 'appointment', 'email', 'lead', 'urgent', 'complaint'].includes(intent)) {
    await createOpportunityFromWhatsApp({
      companyId: integration.company_id,
      conversationId: conversation.id,
      name: input.name,
      phone: input.from,
      notes: input.body,
      hot: intent === 'quote' || intent === 'lead',
      nextAction: details.action,
    });
  }
  await Promise.all([
    saveMemory({ companyId: integration.company_id, customerId: customer.id, employeeId: employee.id, type: intent === 'complaint' || intent === 'urgent' ? 'incident' : 'summary', content: `WhatsApp: ${input.body}`, metadata: { conversation_id: conversation.id, intent } }),
    publishEvent({
      companyId: integration.company_id, customerId: customer.id, employeeId: employee.id,
      name: intent === 'quote' || intent === 'lead' ? 'LeadCreated' : 'WhatsAppMessage', source: 'whatsapp',
      idempotencyKey: `brain:whatsapp:${input.providerMessageId}`,
      payload: { conversation_id: conversation.id, intent, phone: input.from },
    }),
  ]);
  await Promise.all([
    recordBusinessEvent({ eventName, companyId: integration.company_id, metadata: { conversation_id: conversation.id, provider_message_id: input.providerMessageId, intent }, idempotencyKey: `whatsapp:${input.providerMessageId}` }),
    notifyOwner({ subject: 'WhatsApp IA', message: `${input.name || input.from}: ${details.label}.`, companyId: integration.company_id, event: `whatsapp.${intent === 'quote' ? 'quote.requested' : intent === 'callback' ? 'call.requested' : intent === 'appointment' ? 'meeting.requested' : intent === 'email' ? 'email.requested' : intent === 'lead' ? 'lead.created' : ['urgent', 'complaint'].includes(intent) ? 'escalated' : 'message.received'}` }),
  ]);
  return { processed: true as const, conversationId: conversation.id, intent };
}
