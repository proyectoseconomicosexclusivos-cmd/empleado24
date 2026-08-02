import 'server-only';
import { createHash } from 'node:crypto';
import { structuredLog } from '@/lib/structured-logger';
import { createAdminClient } from '@/lib/supabase/admin';

type OwnerNotification = {
  subject: string;
  message: string;
  companyId?: string;
  event?: string;
  idempotencyKey?: string;
  cooldownSeconds?: number;
};

function commercialNotification(input: OwnerNotification) {
  const event = (input.event ?? '').toLowerCase();
  const message = input.message.replace(/https?:\/\/\S+/g, '').trim();
  const company = input.companyId ? `\nEmpresa: ${input.companyId}` : '';

  if (event === 'sales.lead.created') {
    return { subject: '📞 Nuevo lead recibido', text: `📞 Nuevo lead recibido${company}\n\n${message}` };
  }
  if (event === 'sales.lead.hot') {
    return { subject: '🔥 Cliente muy interesado', text: `🔥 Cliente muy interesado${company}\n\n${message}` };
  }
  if (event === 'sales.meeting.scheduled') {
    return { subject: '📅 Reunión agendada', text: `📅 Reunión agendada${company}\n\n${message}` };
  }
  if (event === 'sales.quote.sent') {
    return { subject: '📝 Presupuesto enviado', text: `📝 Presupuesto enviado${company}\n\n${message}` };
  }
  if (event === 'sales.won') {
    return { subject: '🎉 Venta conseguida', text: `🎉 Venta conseguida${company}\n\n${message}` };
  }
  if (event === 'sales.lost') {
    return { subject: 'Cliente perdido', text: `Cliente perdido${company}\n\n${message}` };
  }
  if (event === 'whatsapp.message.received') return { subject: '💬 Nuevo WhatsApp recibido', text: `💬 Nuevo WhatsApp recibido${company}\n\n${message}` };
  if (event === 'whatsapp.quote.requested') return { subject: '💬 Cliente solicita presupuesto', text: `💬 Cliente solicita presupuesto${company}\n\n${message}` };
  if (event === 'whatsapp.call.requested') return { subject: '💬 Cliente quiere llamada', text: `💬 Cliente quiere llamada${company}\n\n${message}` };
  if (event === 'whatsapp.meeting.requested') return { subject: '💬 Cliente solicita una cita', text: `💬 Cliente solicita una cita${company}\n\n${message}` };
  if (event === 'whatsapp.email.requested') return { subject: '💬 Cliente pide información por email', text: `💬 Cliente pide información por email${company}\n\n${message}` };
  if (event === 'whatsapp.lead.created') return { subject: '💬 Nuevo cliente interesado', text: `💬 Nuevo cliente interesado${company}\n\n${message}` };
  if (event === 'whatsapp.converted') return { subject: '💬 Cliente convertido desde WhatsApp', text: `💬 Cliente convertido desde WhatsApp${company}\n\n${message}` };
  if (event === 'whatsapp.escalated') return { subject: '💬 Conversación escalada', text: `💬 Conversación escalada${company}\n\n${message}` };
  if (event === 'user.registered') {
    return { subject: '🟢 Nuevo cliente registrado', text: `🟢 Nuevo cliente registrado\n\n${message}` };
  }
  if (event === 'company.created') {
    return { subject: '🟢 Nueva empresa creada', text: `🟢 Nueva empresa creada${company}\n\n${message}` };
  }
  if (event.includes('trial.started') || event === 'customer.subscription.created') {
    return { subject: '🟢 Trial iniciado', text: `🟢 Trial iniciado${company}\n\n${message}` };
  }
  if (event.includes('first_login')) {
    return { subject: '👋 Primer acceso', text: `👋 Primer acceso${company}\n\n${message}` };
  }
  if (event.includes('employee.hired') || event.includes('subscription.updated')) {
    return { subject: '💼 Nuevo empleado contratado', text: `💼 Nuevo empleado contratado${company}\n\n${message}` };
  }
  if (event.includes('subscription.reactivated')) {
    return { subject: '🟢 Cliente reactivado', text: `🟢 Cliente reactivado${company}\n\n${message}` };
  }
  if (event.includes('invoice.paid') || event.includes('payment') || event === 'checkout.session.completed') {
    return { subject: '💳 Pago recibido', text: `💳 Pago recibido${company}\n\n${message}` };
  }
  if (event.includes('subscription.deleted') || event.includes('cancel')) {
    return { subject: '🚨 Cliente cancelado', text: `🚨 Cliente cancelado${company}\n\n${message}` };
  }
  if (event.includes('guardian.') || event.includes('critical') || event.includes('failed') || event.includes('error') || event.includes('blocked')) {
    return { subject: '⚠ Cliente o servicio requiere atención', text: `⚠ Atención necesaria${company}\n\nEl equipo debe revisar el servicio para mantener la atención al cliente.` };
  }
  if (event.includes('report.')) {
    return { subject: '📊 Resumen operativo', text: `📊 Resumen operativo de Empleado24\n\n${message && !message.startsWith('{') ? message : 'La actividad del servicio ha sido revisada.'}` };
  }
  if (event.includes('prepaid') || event.includes('topup') || event.includes('recharge')) {
    return { subject: '💰 Recarga realizada', text: `💰 Recarga realizada${company}\n\n${message}` };
  }
  if (event.includes('call') || event.includes('first_use')) {
    return { subject: '📞 Primera llamada realizada', text: `📞 Primera llamada realizada${company}\n\n${message}` };
  }
  return { subject: input.subject.replace(/Empleado24\s*[·:-]\s*/i, '').trim() || 'Empleado24', text: `${message}${company}`.trim() };
}

const timeoutMs = 5_000;

async function postJson(url: string, body: Record<string, unknown>, headers: Record<string, string>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function notifyOwner(input: OwnerNotification) {
  const ownerEmail = process.env.OWNER_EMAIL;
  const brevoKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL ?? ownerEmail;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  const commercial = commercialNotification(input);
  const text = commercial.text;
  const deliveries: string[] = [];
  const eventKey = input.idempotencyKey ?? createHash('sha256')
    .update(`${input.event ?? commercial.subject}:${input.companyId ?? 'platform'}`)
    .digest('hex');
  const cooldownSeconds = Math.max(1, Math.min(604800, input.cooldownSeconds ?? (input.event?.startsWith('guardian.') ? 3600 : 900)));
  const claim = await (createAdminClient() as any).rpc('service_claim_owner_notification', {
    target_event_key: eventKey,
    target_cooldown_seconds: cooldownSeconds,
  });
  if (claim.error) {
    structuredLog('warn', 'owner_notification_claim_failed', { event: input.event, error: claim.error.message });
    return { delivered: false, channels: [], reason: 'claim_failed' as const };
  }
  if (claim.data !== true) {
    structuredLog('info', 'owner_notification_deduplicated', { event: input.event, company_id: input.companyId, event_key: eventKey });
    return { delivered: false, channels: [], reason: 'cooldown' as const };
  }

  if (ownerEmail && brevoKey && senderEmail) {
    try {
      const response = await postJson('https://api.brevo.com/v3/smtp/email', {
        sender: { email: senderEmail, name: 'Empleado24' },
        to: [{ email: ownerEmail }],
        subject: commercial.subject,
        textContent: text,
      }, { accept: 'application/json', 'api-key': brevoKey });
      if (response.ok) deliveries.push('email');
      else structuredLog('warn', 'owner_email_notification_failed', { status: response.status, event: input.event });
    } catch (error) {
      structuredLog('warn', 'owner_email_notification_failed', { error: error instanceof Error ? error.message : String(error), event: input.event });
    }
  }

  if (telegramToken && telegramChatId) {
    try {
      const response = await postJson(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        chat_id: telegramChatId,
        text,
        disable_web_page_preview: true,
      }, {});
      if (response.ok) deliveries.push('telegram');
      else structuredLog('warn', 'owner_telegram_notification_failed', { status: response.status, event: input.event });
    } catch (error) {
      structuredLog('warn', 'owner_telegram_notification_failed', { error: error instanceof Error ? error.message : String(error), event: input.event });
    }
  }

  structuredLog(deliveries.length ? 'info' : 'warn', 'owner_notification_dispatched', {
    event: input.event,
    company_id: input.companyId,
    channels: deliveries.join(','),
    configured_email: Boolean(ownerEmail && brevoKey && senderEmail),
    configured_telegram: Boolean(telegramToken && telegramChatId),
  });
  return { delivered: deliveries.length > 0, channels: deliveries };
}
