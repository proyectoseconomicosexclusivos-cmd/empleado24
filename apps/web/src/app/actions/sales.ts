'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { notifyOwner } from '@/lib/owner-notifications';
import { recordBusinessEvent, type BusinessEventName } from '@/lib/business-events';
import { getCustomer, publishEvent, saveMemory } from '@/lib/empleado24-brain';

const stages = new Set(['new', 'contacted', 'interested', 'quote_sent', 'negotiation', 'won', 'lost']);
const activityTypes = new Set(['task', 'call', 'email', 'meeting', 'quote', 'note']);

async function salesContext() {
  const supabase = await createClient() as any;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Debes iniciar sesión.');
  const { data: membership } = await supabase
    .from('members')
    .select('company_id,role')
    .eq('user_id', auth.user.id)
    .in('role', ['owner', 'admin'])
    .limit(1)
    .maybeSingle();
  if (!membership) throw new Error('No tienes permiso para gestionar las ventas.');
  const { data: closer } = await supabase
    .from('employees')
    .select('id')
    .eq('company_id', membership.company_id)
    .eq('employee_type', 'closer')
    .limit(1)
    .maybeSingle();
  if (!closer) throw new Error('Incorpora primero a tu Closer IA.');
  return { supabase, user: auth.user, companyId: membership.company_id as string, closerId: closer.id as string };
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

async function businessNotification(input: {
  eventName: BusinessEventName;
  event: string;
  companyId: string;
  message: string;
  opportunityId: string;
}) {
  await Promise.all([
    recordBusinessEvent({
      eventName: input.eventName,
      companyId: input.companyId,
      metadata: { opportunity_id: input.opportunityId },
      idempotencyKey: `${input.eventName}:${input.opportunityId}`,
    }),
    notifyOwner({
      subject: 'Actividad comercial',
      message: input.message,
      companyId: input.companyId,
      event: input.event,
    }),
  ]);
}

export async function createOpportunity(formData: FormData) {
  const context = await salesContext();
  const name = text(formData, 'name');
  if (name.length < 2) throw new Error('Escribe el nombre del posible cliente.');
  const valueEuros = Number(text(formData, 'value_euros') || 0);
  const { data, error } = await context.supabase.from('sales_opportunities').insert({
    company_id: context.companyId,
    closer_employee_id: context.closerId,
    source: 'manual',
    name,
    company_name: text(formData, 'company_name') || null,
    email: text(formData, 'email') || null,
    phone: text(formData, 'phone') || null,
    notes: text(formData, 'notes') || null,
    value_cents: Number.isFinite(valueEuros) ? Math.max(0, Math.round(valueEuros * 100)) : 0,
    created_by: context.user.id,
  }).select('id').single();
  if (error) throw error;
  const customer = await getCustomer({
    companyId: context.companyId, name, companyName: text(formData, 'company_name'),
    email: text(formData, 'email'), phone: text(formData, 'phone'), source: 'closer',
  });
  await Promise.all([
    saveMemory({ companyId: context.companyId, customerId: customer.id, employeeId: context.closerId, type: 'commercial', content: `Nuevo lead: ${name}.`, metadata: { opportunity_id: data.id } }),
    publishEvent({ companyId: context.companyId, customerId: customer.id, employeeId: context.closerId, name: 'LeadCreated', source: 'closer', idempotencyKey: `brain:lead:${data.id}`, payload: { opportunity_id: data.id } }),
  ]);
  await businessNotification({
    eventName: 'sales_lead_created',
    event: 'sales.lead.created',
    companyId: context.companyId,
    message: `Nuevo posible cliente: ${name}.`,
    opportunityId: data.id,
  });
  revalidatePath('/app/centro-ventas');
}

export async function updateOpportunityStage(formData: FormData) {
  const context = await salesContext();
  const opportunityId = text(formData, 'opportunity_id');
  const stage = text(formData, 'stage');
  if (!stages.has(stage)) throw new Error('El estado elegido no es válido.');
  const { data: previous } = await context.supabase
    .from('sales_opportunities')
    .select('name,stage,email,phone,company_name')
    .eq('company_id', context.companyId)
    .eq('id', opportunityId)
    .single();
  const { error } = await context.supabase
    .from('sales_opportunities')
    .update({ stage })
    .eq('company_id', context.companyId)
    .eq('id', opportunityId);
  if (error) throw error;
  await context.supabase.from('sales_activities').insert({
    company_id: context.companyId,
    opportunity_id: opportunityId,
    employee_id: context.closerId,
    activity_type: 'stage_change',
    status: 'completed',
    title: `Estado actualizado a ${stage}`,
    completed_at: new Date().toISOString(),
    metadata: { previous_stage: previous?.stage, stage },
    created_by: context.user.id,
  });
  const eventByStage = {
    interested: ['sales_lead_hot', 'sales.lead.hot', 'Este cliente está muy interesado.'],
    quote_sent: ['sales_quote_sent', 'sales.quote.sent', 'Presupuesto enviado.'],
    won: ['sales_won', 'sales.won', 'Venta conseguida.'],
    lost: ['sales_lost', 'sales.lost', 'Oportunidad cerrada sin venta.'],
  } as const;
  const notification = eventByStage[stage as keyof typeof eventByStage];
  if (notification) {
    const customer = await getCustomer({
      companyId: context.companyId, name: previous?.name, companyName: previous?.company_name,
      email: previous?.email, phone: previous?.phone, source: 'closer',
    });
    const brainEvent = stage === 'quote_sent'
      ? 'BudgetSent'
      : stage === 'won'
        ? 'SaleWon'
        : stage === 'lost'
          ? 'SaleLost'
          : 'LeadCreated';
    await Promise.all([
      saveMemory({ companyId: context.companyId, customerId: customer.id, employeeId: context.closerId, type: 'commercial', content: `${notification[2]}`, metadata: { opportunity_id: opportunityId, stage } }),
      publishEvent({ companyId: context.companyId, customerId: customer.id, employeeId: context.closerId, name: brainEvent, source: 'closer', idempotencyKey: `brain:sales:${opportunityId}:${stage}`, payload: { opportunity_id: opportunityId, stage } }),
    ]);
    await businessNotification({
      eventName: notification[0],
      event: notification[1],
      companyId: context.companyId,
      message: `${previous?.name ?? 'Cliente'}: ${notification[2]}`,
      opportunityId,
    });
  }
  revalidatePath('/app/centro-ventas');
}

export async function createSalesActivity(formData: FormData) {
  const context = await salesContext();
  const opportunityId = text(formData, 'opportunity_id');
  const activityType = text(formData, 'activity_type');
  if (!activityTypes.has(activityType)) throw new Error('La acción elegida no es válida.');
  const title = text(formData, 'title');
  if (title.length < 2) throw new Error('Describe brevemente la próxima acción.');
  const scheduledValue = text(formData, 'scheduled_at');
  const scheduledAt = scheduledValue ? new Date(scheduledValue).toISOString() : null;
  const { error } = await context.supabase.from('sales_activities').insert({
    company_id: context.companyId,
    opportunity_id: opportunityId,
    employee_id: context.closerId,
    activity_type: activityType,
    status: scheduledAt ? 'planned' : 'completed',
    title,
    scheduled_at: scheduledAt,
    completed_at: scheduledAt ? null : new Date().toISOString(),
    created_by: context.user.id,
  });
  if (error) throw error;
  await context.supabase.from('sales_opportunities').update({
    next_action_at: scheduledAt,
    last_contact_at: scheduledAt ? undefined : new Date().toISOString(),
  }).eq('company_id', context.companyId).eq('id', opportunityId);
  if (activityType === 'meeting') {
    const { data: opportunity } = await context.supabase.from('sales_opportunities').select('name,email,phone,company_name').eq('company_id', context.companyId).eq('id', opportunityId).single();
    const customer = await getCustomer({ companyId: context.companyId, name: opportunity?.name, companyName: opportunity?.company_name, email: opportunity?.email, phone: opportunity?.phone, source: 'closer' });
    await publishEvent({ companyId: context.companyId, customerId: customer.id, employeeId: context.closerId, name: 'MeetingBooked', source: 'closer', idempotencyKey: `brain:activity:${opportunityId}:meeting:${title}`, payload: { opportunity_id: opportunityId, title, scheduled_at: scheduledAt } });
    await businessNotification({
      eventName: 'sales_meeting_scheduled',
      event: 'sales.meeting.scheduled',
      companyId: context.companyId,
      message: `Reunión agendada: ${title}.`,
      opportunityId,
    });
  } else if (activityType === 'quote') {
    const { data: opportunity } = await context.supabase.from('sales_opportunities').select('name,email,phone,company_name').eq('company_id', context.companyId).eq('id', opportunityId).single();
    const customer = await getCustomer({ companyId: context.companyId, name: opportunity?.name, companyName: opportunity?.company_name, email: opportunity?.email, phone: opportunity?.phone, source: 'closer' });
    await publishEvent({ companyId: context.companyId, customerId: customer.id, employeeId: context.closerId, name: 'BudgetCreated', source: 'closer', idempotencyKey: `brain:activity:${opportunityId}:quote:${title}`, payload: { opportunity_id: opportunityId, title } });
    await businessNotification({
      eventName: 'sales_quote_sent',
      event: 'sales.quote.sent',
      companyId: context.companyId,
      message: `Presupuesto preparado: ${title}.`,
      opportunityId,
    });
  }
  revalidatePath('/app/centro-ventas');
}
