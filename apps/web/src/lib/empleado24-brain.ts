import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyOwner } from '@/lib/owner-notifications';
import { automationForBrainEvent } from '@/lib/empleado24-brain-rules';

export type BrainEventName =
  | 'LeadCreated' | 'WhatsAppMessage' | 'CallStarted' | 'CallFinished'
  | 'EmailSent' | 'EmailOpened' | 'BudgetCreated' | 'BudgetSent'
  | 'MeetingBooked' | 'MeetingCompleted' | 'SaleWon' | 'SaleLost'
  | 'CustomerCreated' | 'EmployeeActivated' | 'EmployeePaused'
  | 'SubscriptionStarted' | 'SubscriptionCancelled' | 'PaymentCompleted'
  | 'MinutesPurchased' | 'SupportOpened' | 'SupportClosed'
  | 'TechnicalProjectAnalyzed' | 'TechnicalQuoteDrafted'
  | 'ProjectCreated' | 'ProjectFileUploaded' | 'ProjectAnalysisStarted'
  | 'ProjectAnalysisCompleted' | 'MeasurementDetected' | 'MeasurementConfirmed'
  | 'MeasurementEstimated' | 'BudgetDraftCreated' | 'BudgetReviewed'
  | 'LeadReceived' | 'LeadContacted' | 'ConversationStarted' | 'NeedDetected'
  | 'EmployeeRecommended' | 'DemoOffered' | 'DemoStarted' | 'DemoCompleted'
  | 'ObjectionDetected' | 'OfferPresented' | 'CheckoutStarted' | 'CheckoutAbandoned';

type CustomerInput = {
  companyId: string;
  name?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  source?: string;
};

const clean = (value?: string | null) => value?.trim() || null;
const normalEmail = (value?: string | null) => clean(value)?.toLowerCase() ?? null;
const normalPhone = (value?: string | null) => clean(value)?.replace(/[^+\d]/g, '') ?? null;

function identities(input: CustomerInput) {
  return [
    ['email', normalEmail(input.email)],
    ['phone', normalPhone(input.phone)],
    ['whatsapp', normalPhone(input.whatsapp)],
  ].filter((row): row is [string, string] => Boolean(row[1]));
}

/** Resolve one person per company across calls, messages and emails. */
export async function getCustomer(input: CustomerInput) {
  const admin = createAdminClient() as any;
  const ids = identities(input);
  const matchedCustomerIds = new Set<string>();
  for (const [identityType, normalizedValue] of ids) {
    const { data, error } = await admin.from('customer_identities')
      .select('customer_id')
      .eq('company_id', input.companyId)
      .eq('identity_type', identityType)
      .eq('normalized_value', normalizedValue)
      .maybeSingle();
    if (error) throw error;
    if (data?.customer_id) matchedCustomerIds.add(data.customer_id);
  }
  const [customerId, ...duplicates] = [...matchedCustomerIds];
  // A contact may arrive first by phone and later by email. Merge those two
  // partial records before writing the new interaction so Customer 360 stays
  // one person per company across every employee and channel.
  if (customerId && duplicates.length) {
    const migrations = await Promise.all([
      admin.from('customer_identities').update({ customer_id: customerId }).in('customer_id', duplicates),
      admin.from('brain_memories').update({ customer_id: customerId }).in('customer_id', duplicates),
      admin.from('brain_events').update({ customer_id: customerId }).in('customer_id', duplicates),
      admin.from('brain_tasks').update({ customer_id: customerId }).in('customer_id', duplicates),
    ]);
    const failure = migrations.find((result: { error?: unknown }) => result.error)?.error;
    if (failure) throw failure;
    const { error } = await admin.from('customers').delete().in('id', duplicates).eq('company_id', input.companyId);
    if (error) throw error;
  }

  const values = {
    display_name: clean(input.name),
    company_name: clean(input.companyName),
    email: normalEmail(input.email),
    phone: normalPhone(input.phone),
    whatsapp: normalPhone(input.whatsapp),
    source: input.source ?? 'unknown',
    last_contact_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const updates = Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== null || ['last_contact_at', 'updated_at'].includes(key)));
  const result = customerId
    ? await admin.from('customers').update(updates).eq('id', customerId).eq('company_id', input.companyId).select('*').single()
    : await admin.from('customers').insert({ company_id: input.companyId, ...values }).select('*').single();
  if (result.error || !result.data) throw result.error ?? new Error('brain_customer_upsert_failed');

  const customer = result.data as { id: string };
  if (ids.length) {
    const { error } = await admin.from('customer_identities').upsert(ids.map(([identity_type, normalized_value]) => ({
      company_id: input.companyId, customer_id: customer.id, identity_type, normalized_value,
    })), { onConflict: 'company_id,identity_type,normalized_value', ignoreDuplicates: true });
    if (error) throw error;
  }
  return customer;
}

export async function saveMemory(input: { companyId: string; customerId?: string | null; employeeId?: string | null; type: 'note' | 'preference' | 'fact' | 'incident' | 'summary' | 'commercial'; content: string; metadata?: Record<string, unknown> }) {
  const admin = createAdminClient() as any;
  const { data, error } = await admin.from('brain_memories').insert({
    company_id: input.companyId, customer_id: input.customerId ?? null,
    source_employee_id: input.employeeId ?? null, memory_type: input.type,
    content: input.content, metadata: input.metadata ?? {},
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function createTask(input: { companyId: string; customerId?: string | null; sourceEventId?: string | null; employeeType?: 'closer' | 'email' | 'receptionist' | 'whatsapp'; type: 'follow_up' | 'call' | 'email' | 'quote' | 'meeting' | 'review'; title: string; dueAt?: string | null; metadata?: Record<string, unknown> }) {
  const admin = createAdminClient() as any;
  let employeeId: string | null = null;
  if (input.employeeType) {
    const { data } = await admin.from('employees').select('id').eq('company_id', input.companyId).eq('employee_type', input.employeeType).eq('status', 'active').maybeSingle();
    employeeId = data?.id ?? null;
  }
  if (input.sourceEventId) {
    const { data: existing, error } = await admin.from('brain_tasks')
      .select('*')
      .eq('source_event_id', input.sourceEventId)
      .eq('task_type', input.type)
      .maybeSingle();
    if (error) throw error;
    if (existing) return existing;
  }
  const { data, error } = await admin.from('brain_tasks').insert({
    company_id: input.companyId, customer_id: input.customerId ?? null,
    assigned_employee_id: employeeId, source_event_id: input.sourceEventId ?? null,
    task_type: input.type, title: input.title, due_at: input.dueAt ?? null,
    metadata: input.metadata ?? {},
  }).select('*').single();
  if (error?.code === '23505' && input.sourceEventId) {
    const { data: duplicate, error: duplicateError } = await admin.from('brain_tasks')
      .select('*')
      .eq('company_id', input.companyId)
      .eq('source_event_id', input.sourceEventId)
      .eq('task_type', input.type)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) return duplicate;
  }
  if (error) throw error;
  return data;
}

/** Idempotent internal event bus with safe commercial automations. */
export async function publishEvent(input: { companyId: string; customerId?: string | null; employeeId?: string | null; name: BrainEventName; source: string; idempotencyKey: string; payload?: Record<string, unknown> }) {
  const admin = createAdminClient() as any;
  const { data: event, error } = await admin.from('brain_events').upsert({
    company_id: input.companyId, customer_id: input.customerId ?? null,
    employee_id: input.employeeId ?? null, event_name: input.name, source: input.source,
    payload: input.payload ?? {}, idempotency_key: input.idempotencyKey,
  }, { onConflict: 'company_id,idempotency_key', ignoreDuplicates: true }).select('*').maybeSingle();
  if (error) throw error;
  if (!event) return null;

  const automation = automationForBrainEvent(input.name);
  if (automation?.employeeType && automation.taskType && automation.title) await createTask({
    companyId: input.companyId, customerId: input.customerId, sourceEventId: event.id,
    employeeType: automation.employeeType, type: automation.taskType, title: automation.title,
    dueAt: input.name === 'BudgetSent' ? new Date(Date.now() + 48 * 60 * 60_000).toISOString() : null,
    metadata: input.payload,
  });
  if (input.name === 'MeetingBooked') await createTask({
    companyId: input.companyId, customerId: input.customerId, sourceEventId: event.id,
    employeeType: 'receptionist', type: 'review', title: 'Revisar reserva y disponibilidad de Calendar', metadata: input.payload,
  });
  if (input.name === 'EmailOpened') await createTask({
    companyId: input.companyId, customerId: input.customerId, sourceEventId: event.id,
    employeeType: 'closer', type: 'follow_up', title: 'Cliente ha abierto el email: revisar prioridad', metadata: { ...input.payload, priority: 'high' },
  });
  if (input.name === 'SaleLost') await createTask({
    companyId: input.companyId, customerId: input.customerId, sourceEventId: event.id,
    employeeType: 'closer', type: 'follow_up', title: 'Recontactar al cliente',
    dueAt: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(), metadata: input.payload,
  });
  if (input.name === 'SaleWon') {
    await admin.from('brain_tasks').update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('company_id', input.companyId).eq('customer_id', input.customerId ?? '').in('status', ['open', 'in_progress']);
  }
  if (automation?.notifyOwner) await notifyOwner({
    subject: 'Venta conseguida', companyId: input.companyId, event: 'sales.won',
    message: 'Un cliente ha confirmado una venta.',
  });
  await admin.from('brain_events').update({ processed_at: new Date().toISOString() }).eq('id', event.id);
  return event;
}

export async function notifyEmployee(input: { companyId: string; customerId?: string | null; employeeType?: 'closer' | 'email' | 'receptionist' | 'whatsapp'; title: string; body: string }) {
  const task = await createTask({
    companyId: input.companyId, customerId: input.customerId, employeeType: input.employeeType,
    type: 'review', title: input.title, metadata: { body: input.body },
  });
  return task;
}

export async function customerContext(companyId: string, customerId: string) {
  const admin = createAdminClient() as any;
  const [{ data: customer, error }, { data: memories }, { data: events }, { data: tasks }] = await Promise.all([
    admin.from('customers').select('*').eq('company_id', companyId).eq('id', customerId).single(),
    admin.from('brain_memories').select('memory_type,content,created_at').eq('company_id', companyId).eq('customer_id', customerId).order('created_at', { ascending: false }).limit(12),
    admin.from('brain_events').select('event_name,occurred_at,payload').eq('company_id', companyId).eq('customer_id', customerId).order('occurred_at', { ascending: false }).limit(30),
    admin.from('brain_tasks').select('task_type,title,status,due_at').eq('company_id', companyId).eq('customer_id', customerId).neq('status', 'completed').order('created_at', { ascending: false }).limit(10),
  ]);
  if (error) throw error;
  return { customer, memories: memories ?? [], events: events ?? [], tasks: tasks ?? [] };
}
