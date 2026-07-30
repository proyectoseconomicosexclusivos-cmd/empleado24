import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyOwner } from '@/lib/owner-notifications';
import { recordBusinessEvent } from '@/lib/business-events';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function string(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function createOpportunityFromReceptionistCall(input: {
  companyId: string;
  callId: string;
  summary?: string | null;
  analysis: Record<string, unknown>;
  fromNumber?: string | null;
}) {
  const custom = record(input.analysis.custom_analysis_data);
  const interest = string(custom.sales_interest_level)?.toLowerCase();
  const potential = custom.potential_customer === true
    || custom.potential_customer === 'true'
    || ['interested', 'hot', 'very_hot', 'muy_interesado'].includes(interest ?? '');
  if (!potential) return null;

  const admin = createAdminClient() as any;
  const { data: closer, error: closerError } = await admin
    .from('employees')
    .select('id')
    .eq('company_id', input.companyId)
    .eq('employee_type', 'closer')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (closerError) throw closerError;
  if (!closer) return null;

  const valueEuros = typeof custom.estimated_value_eur === 'number'
    ? custom.estimated_value_eur
    : Number(custom.estimated_value_eur ?? 0);
  const stage = ['hot', 'very_hot', 'muy_interesado'].includes(interest ?? '')
    ? 'interested'
    : 'contacted';
  const name = string(custom.customer_name) ?? 'Nuevo posible cliente';
  const { data: opportunity, error } = await admin
    .from('sales_opportunities')
    .insert({
      company_id: input.companyId,
      closer_employee_id: closer.id,
      source: 'receptionist',
      source_call_id: input.callId,
      name,
      email: string(custom.customer_email),
      phone: input.fromNumber,
      stage,
      value_cents: Number.isFinite(valueEuros) ? Math.max(0, Math.round(valueEuros * 100)) : 0,
      notes: input.summary ?? string(custom.next_sales_action),
    })
    .select('id')
    .single();
  if (error?.code === '23505') return null;
  if (error || !opportunity) throw error ?? new Error('sales_opportunity_creation_failed');

  await admin.from('sales_activities').insert({
    company_id: input.companyId,
    opportunity_id: opportunity.id,
    employee_id: closer.id,
    activity_type: 'call',
    status: 'completed',
    title: 'Posible cliente detectado por la Recepcionista',
    completed_at: new Date().toISOString(),
    outcome: input.summary,
    metadata: { call_id: input.callId, interest },
  });
  await Promise.all([
    recordBusinessEvent({
      eventName: stage === 'interested' ? 'sales_lead_hot' : 'sales_lead_created',
      companyId: input.companyId,
      metadata: { opportunity_id: opportunity.id, call_id: input.callId },
      idempotencyKey: `sales_lead:${input.callId}`,
    }),
    notifyOwner({
      subject: 'Nuevo posible cliente',
      message: `${name} ha mostrado interés durante una llamada.`,
      companyId: input.companyId,
      event: stage === 'interested' ? 'sales.lead.hot' : 'sales.lead.created',
    }),
  ]);
  return opportunity.id as string;
}

/** Shared commercial handoff used by employees; it never crosses company boundaries. */
export async function createOpportunityFromWhatsApp(input: {
  companyId: string;
  conversationId: string;
  name?: string;
  phone: string;
  notes?: string;
  hot: boolean;
  nextAction?: 'call' | 'meeting' | 'email' | 'quote' | 'task';
}) {
  const admin = createAdminClient() as any;
  const { data: closer } = await admin.from('employees').select('id').eq('company_id', input.companyId).eq('employee_type', 'closer').eq('status', 'active').maybeSingle();
  if (!closer) return null;
  // A WhatsApp conversation can mention its need more than once. Reuse the
  // commercial record already created for that conversation instead of
  // assigning the same client to the Closer repeatedly.
  const whatsappReference = `[whatsapp:${input.conversationId}]`;
  const { data: existing, error: existingError } = await admin
    .from('sales_opportunities')
    .select('id')
    .eq('company_id', input.companyId)
    .ilike('notes', `%${whatsappReference}%`)
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return existing.id as string;
  const { data, error } = await admin.from('sales_opportunities').insert({
    // The stable commercial source enum intentionally stays unchanged; the
    // WhatsApp conversation reference is retained in notes for idempotency.
    company_id: input.companyId, closer_employee_id: closer.id, source: 'other',
    name: input.name || 'Nuevo contacto de WhatsApp', phone: input.phone,
    stage: input.hot ? 'interested' : 'new',
    notes: `${whatsappReference}\n${input.notes ?? ''}`.trim(),
  }).select('id').single();
  if (error?.code === '23505') return null;
  if (error) throw error;
  const activityType = input.nextAction ?? 'task';
  const title = activityType === 'quote'
    ? 'Preparar presupuesto solicitado por WhatsApp'
    : activityType === 'meeting'
      ? 'Concretar cita solicitada por WhatsApp'
      : activityType === 'email'
        ? 'Enviar información solicitada por WhatsApp'
        : activityType === 'call'
          ? 'Llamar al cliente que lo solicitó por WhatsApp'
          : 'Revisar lead recibido por WhatsApp IA';
  await admin.from('sales_activities').insert({
    company_id: input.companyId,
    opportunity_id: data.id,
    employee_id: closer.id,
    activity_type: activityType,
    status: 'planned',
    title,
    scheduled_at: new Date().toISOString(),
    outcome: input.notes ?? null,
    metadata: { whatsapp_conversation_id: input.conversationId, source: 'whatsapp' },
  });
  return data.id as string;
}
