import 'server-only';
import { StripeBillingAdapter, type BillingPlan, type StripeEvent } from '@empleado24/integrations/billing-provider';
import { stripeSubscriptionState, stripeTimestamp, type SubscriptionState } from '@empleado24/integrations/subscription-engine';
import type { Database, Json } from '@empleado24/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordBusinessEvent } from '@/lib/business-events';
import { createClient } from '@/lib/supabase/server';
import { stripeEnv } from '@/lib/env';
import { notifyOwner } from '@/lib/owner-notifications';
import { publishEvent, type BrainEventName } from '@/lib/empleado24-brain';
import { departmentForPlan } from '@/lib/departments';

type Admin = SupabaseClient<Database>;
type PlanRow = Database['public']['Tables']['billing_plans']['Row'];
type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];

export function stripeAdapter(requireWebhook = false) {
  const { secretKey, webhookSecret } = stripeEnv(requireWebhook);
  return new StripeBillingAdapter(secretKey, webhookSecret);
}

export function billingPlan(plan: PlanRow): BillingPlan {
  return {
    key: plan.plan_key,
    lookupKey: plan.plan_key === 'employee_email'
      ? 'employee_email_monthly'
      : plan.plan_key === 'employee_closer'
        ? 'employee_closer_monthly'
        : plan.plan_key === 'employee_whatsapp'
          ? 'employee_whatsapp_monthly'
          : plan.plan_key === 'department_commercial'
            ? 'department_commercial_monthly'
            : undefined,
    name: plan.name,
    description: plan.description,
    amountMinor: plan.monthly_price_cents,
    currency: plan.currency,
    trialDays: plan.trial_days,
  };
}

export async function authorizedBillingContext() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: 'unauthorized' as const };
  const { data: member } = await supabase.from('members').select('company_id,role').eq('user_id', auth.user.id).in('role', ['owner', 'admin']).limit(1).maybeSingle();
  if (!member) return { error: 'forbidden' as const };
  const { data: company } = await supabase.from('companies').select('id,name').eq('id', member.company_id).single();
  if (!company) return { error: 'company_not_found' as const };
  return { supabase, admin: createAdminClient(), user: auth.user, member, company };
}

export async function ensureStripeCustomer(context: Exclude<Awaited<ReturnType<typeof authorizedBillingContext>>, { error: string }>) {
  const { data: existing } = await context.admin.from('subscriptions').select('*').eq('company_id', context.company.id).maybeSingle();
  const adapter = stripeAdapter();
  const email = context.user.email ?? '';
  if (existing?.provider_customer_id) {
    const liveCustomer = await adapter.retrieveCustomer(existing.provider_customer_id);
    if ('data' in liveCustomer) {
      console.info(JSON.stringify({ event: 'stripe_customer_reused', company_id: context.company.id, customer_id: liveCustomer.data.id, mode: adapter.mode }));
      return { subscription: existing, customerId: liveCustomer.data.id };
    }
    if (liveCustomer.error.code !== 'stripe_http_404') throw new Error(`${liveCustomer.error.code}:${liveCustomer.error.message}`);
    console.info(JSON.stringify({ event: 'stripe_customer_migrating', company_id: context.company.id, previous_customer_id: existing.provider_customer_id, mode: adapter.mode }));
  }

  const reused = await adapter.findCustomerByEmail(email, context.company.id);
  if ('error' in reused) throw new Error(`${reused.error.code}:${reused.error.message}`);
  if (reused.data) {
    console.info(JSON.stringify({ event: 'stripe_customer_reused', company_id: context.company.id, previous_customer_id: existing?.provider_customer_id ?? null, customer_id: reused.data.customerId, mode: adapter.mode }));
    const updated = existing
      ? await context.admin.from('subscriptions').update({ provider_customer_id: reused.data.customerId, updated_at: new Date().toISOString() }).eq('id', existing.id).select().single()
      : await context.admin.from('subscriptions').insert({ company_id: context.company.id, provider: 'stripe', provider_customer_id: reused.data.customerId, status: 'inactive', state: 'incomplete', updated_at: new Date().toISOString() }).select().single();
    if (updated.error) throw updated.error;
    return { subscription: updated.data, customerId: reused.data.customerId };
  }

  const created = await adapter.createCustomer({ companyId: context.company.id, email, name: context.company.name });
  if ('error' in created) throw new Error(`${created.error.code}:${created.error.message}`);
  console.info(JSON.stringify({ event: existing?.provider_customer_id ? 'stripe_customer_migrated' : 'stripe_customer_created', company_id: context.company.id, customer_id: created.data.customerId, mode: adapter.mode }));
  const values = { company_id: context.company.id, provider: 'stripe', provider_customer_id: created.data.customerId, status: existing?.status ?? 'inactive', state: existing?.state ?? 'incomplete' as const, updated_at: new Date().toISOString() };
  const result = existing
    ? await context.admin.from('subscriptions').update(values).eq('id', existing.id).select().single()
    : await context.admin.from('subscriptions').insert(values).select().single();
  if (result.error) throw result.error;
  return { subscription: result.data, customerId: created.data.customerId };
}

function stringValue(value: unknown) { return typeof value === 'string' ? value : null; }
function numberValue(value: unknown) { return typeof value === 'number' ? value : null; }
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function metadata(object: Record<string, unknown>) { return objectValue(object.metadata); }

function subscriptionPeriod(object: Record<string, unknown>) {
  const directStart = numberValue(object.current_period_start);
  const directEnd = numberValue(object.current_period_end);
  if (directStart || directEnd) return { start: directStart, end: directEnd };
  const items = objectValue(object.items);
  const first = Array.isArray(items.data) ? objectValue(items.data[0]) : {};
  return { start: numberValue(first.current_period_start), end: numberValue(first.current_period_end) };
}

function planKeyFromSubscription(object: Record<string, unknown>) {
  const direct = stringValue(metadata(object).plan_key);
  if (direct) return direct;
  const items = objectValue(object.items);
  const first = Array.isArray(items.data) ? objectValue(items.data[0]) : {};
  const price = objectValue(first.price);
  return stringValue(metadata(price).plan_key) ?? stringValue(price.lookup_key)?.replace(/^empleado24_/, '').replace(/_monthly$/, '') ?? null;
}

async function findSubscription(admin: Admin, object: Record<string, unknown>, companyHint?: string | null) {
  const customerId = stringValue(object.customer) ?? (stringValue(object.object) === 'customer' ? stringValue(object.id) : null);
  const providerSubscriptionId = stringValue(object.subscription) ?? (stringValue(object.object) === 'subscription' ? stringValue(object.id) : null);
  if (providerSubscriptionId) {
    const result = await admin.from('subscriptions').select('*').eq('provider_subscription_id', providerSubscriptionId).maybeSingle();
    if (result.data) return result.data;
  }
  if (customerId) {
    const result = await admin.from('subscriptions').select('*').eq('provider_customer_id', customerId).maybeSingle();
    if (result.data) return result.data;
  }
  if (companyHint) return (await admin.from('subscriptions').select('*').eq('company_id', companyHint).maybeSingle()).data;
  return null;
}

async function planId(admin: Admin, key: string | null) {
  if (!key) return null;
  return (await admin.from('billing_plans').select('id').eq('plan_key', key).maybeSingle()).data?.id ?? null;
}

async function updateSubscriptionState(admin: Admin, current: SubscriptionRow, target: SubscriptionState, values: Database['public']['Tables']['subscriptions']['Update']) {
  const update = async (state: SubscriptionState, extra: Database['public']['Tables']['subscriptions']['Update'] = {}) => admin.from('subscriptions').update({ ...extra, state, status: state, updated_at: new Date().toISOString() }).eq('id', current.id);
  let result = await update(target, values);
  if (!result.error) return;
  if (result.error.code !== '23514') throw result.error;
  const intermediate: Partial<Record<SubscriptionState, SubscriptionState>> = { past_due: 'active', canceling: 'active', frozen: 'active' };
  const via = intermediate[target];
  if (!via) throw result.error;
  result = await update(via);
  if (result.error) throw result.error;
  result = await update(target, values);
  if (result.error) throw result.error;
}

async function syncSubscription(admin: Admin, object: Record<string, unknown>, companyHint?: string | null) {
  const companyId = stringValue(metadata(object).company_id) ?? companyHint;
  const current = await findSubscription(admin, object, companyId);
  if (!current) throw new Error('stripe_subscription_tenant_not_found');
  const key = planKeyFromSubscription(object) ?? stringValue(metadata(object).plan_key) ?? current.plan_key;
  const period = subscriptionPeriod(object);
  const cancelAtPeriodEnd = object.cancel_at_period_end === true;
  const state = stripeSubscriptionState(object.status, cancelAtPeriodEnd);
  await updateSubscriptionState(admin, current, state, {
    provider: 'stripe', provider_customer_id: stringValue(object.customer) ?? current.provider_customer_id,
    provider_subscription_id: stringValue(object.id) ?? current.provider_subscription_id,
    plan_id: await planId(admin, key), plan_key: key, cancel_at_period_end: cancelAtPeriodEnd,
    trial_ends_at: stripeTimestamp(object.trial_end), current_period_starts_at: stripeTimestamp(period.start), current_period_ends_at: stripeTimestamp(period.end),
    canceled_at: stripeTimestamp(object.canceled_at),
  });
  if (['trialing', 'active', 'canceling'].includes(state)) {
    if (key === 'employee_email' || key === 'employee_closer' || key === 'employee_whatsapp') {
      await activateEmployeeForPlan(admin, current.company_id, key);
    }
    if (departmentForPlan(key)) {
      await activateDepartmentForPlan(admin, current.company_id, current.id, key);
    }
  }
}

async function syncInvoice(admin: Admin, object: Record<string, unknown>, companyHint?: string | null) {
  const subscription = await findSubscription(admin, object, companyHint);
  if (!subscription) throw new Error('stripe_invoice_tenant_not_found');
  const parent = objectValue(object.parent);
  const subscriptionDetails = objectValue(parent.subscription_details);
  const subscriptionId = stringValue(object.subscription) ?? stringValue(subscriptionDetails.subscription);
  const invoice = {
    company_id: subscription.company_id, subscription_id: subscription.id, provider_key: 'stripe', provider_invoice_id: stringValue(object.id)!,
    status: stringValue(object.status) ?? 'unknown', amount_due_cents: numberValue(object.amount_due) ?? 0, amount_paid_cents: numberValue(object.amount_paid) ?? 0,
    currency: (stringValue(object.currency) ?? 'eur').toUpperCase(), invoice_url: stringValue(object.hosted_invoice_url), issued_at: stripeTimestamp(object.created),
    due_at: stripeTimestamp(object.due_date), paid_at: stripeTimestamp(object.status_transitions && objectValue(object.status_transitions).paid_at),
  };
  const result = await admin.from('invoices').upsert(invoice, { onConflict: 'provider_invoice_id' });
  if (result.error) throw result.error;
  if (subscriptionId && !subscription.provider_subscription_id) await admin.from('subscriptions').update({ provider_subscription_id: subscriptionId }).eq('id', subscription.id);
}

const employeeByPlan = {
  employee_email: {
    employeeType: 'email_specialist',
    name: 'Especialista Email IA',
    description: 'Organiza contactos, prepara campañas y mantiene el seguimiento por email.',
    providerKey: 'brevo',
    connectedTools: ['email'],
  },
  employee_closer: {
    employeeType: 'closer',
    name: 'Closer IA',
    description: 'Hace seguimiento de oportunidades, prepara contactos y convierte interés en ventas.',
    providerKey: 'retell',
    connectedTools: ['voice', 'email', 'calendar'],
  },
  employee_whatsapp: {
    employeeType: 'whatsapp',
    name: 'WhatsApp IA',
    description: 'Atiende mensajes, resuelve dudas y abre oportunidades para tu empresa.',
    providerKey: 'whatsapp_meta',
    connectedTools: ['messaging', 'voice', 'email', 'calendar'],
  },
} as const;

const departmentProfiles: Record<string, { employeeType: string; name: string; description: string; providerKey: string | null; connectedTools: string[] }> = {
  receptionist: { employeeType: 'receptionist', name: 'Recepcionista IA', description: 'Atiende llamadas y organiza las primeras conversaciones.', providerKey: 'retell', connectedTools: ['voice', 'calendar'] },
  whatsapp: { employeeType: 'whatsapp', name: 'WhatsApp IA', description: 'Atiende mensajes y abre oportunidades para tu empresa.', providerKey: 'whatsapp_meta', connectedTools: ['messaging', 'email', 'calendar'] },
  closer: { employeeType: 'closer', name: 'Closer IA', description: 'Hace seguimiento de oportunidades y convierte interés en ventas.', providerKey: 'retell', connectedTools: ['voice', 'email', 'calendar'] },
  booking: { employeeType: 'booking', name: 'Booking IA', description: 'Organiza citas, cambios y recordatorios con el mismo historial de cliente.', providerKey: 'google_calendar', connectedTools: ['calendar'] },
  budget_specialist: { employeeType: 'budget_specialist', name: 'Especialista Presupuestos IA', description: 'Prepara presupuestos y coordina el seguimiento comercial.', providerKey: null, connectedTools: ['email', 'calendar'] },
};

async function activateDepartmentForPlan(admin: Admin, companyId: string, subscriptionId: string, planKey: string) {
  const department = departmentForPlan(planKey);
  if (!department) return;
  const profiles = department.employeeTypes
    .map((employeeType) => departmentProfiles[employeeType])
    .filter((profile): profile is { employeeType: string; name: string; description: string; providerKey: string | null; connectedTools: string[] } => Boolean(profile));
  for (const profile of profiles) {
    const existing = await admin.from('employees').select('id').eq('company_id', companyId).eq('employee_type', profile.employeeType).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) continue;
    const created = await admin.from('employees').insert({
      company_id: companyId,
      employee_type: profile.employeeType,
      name: profile.name,
      description: profile.description,
      status: 'active',
      runtime_status: profile.providerKey ? 'configuring' : 'training',
      provider_key: profile.providerKey,
      connected_tools: profile.connectedTools,
      instructions: { role: profile.employeeType, brain: 'shared' },
    }).select('id').single();
    if (created.error) throw created.error;
    await publishEvent({
      companyId,
      employeeId: created.data.id,
      name: 'EmployeeActivated',
      source: 'department',
      idempotencyKey: `brain:department:${department.key}:${created.data.id}`,
      payload: { department_key: department.key, employee_type: profile.employeeType },
    });
  }
  const { error } = await (admin as any).from('company_departments').upsert({
    company_id: companyId,
    department_key: department.key,
    subscription_id: subscriptionId,
    status: 'active',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'company_id,department_key' });
  if (error) throw error;
  await recordBusinessEvent({
    eventName: 'department_activated',
    companyId,
    source: 'billing',
    idempotencyKey: `department-activated:${companyId}:${department.key}`,
    metadata: { department_key: department.key, plan_key: planKey },
  }).catch(() => undefined);
}

async function activateEmployeeForPlan(
  admin: Admin,
  companyId: string,
  planKey: keyof typeof employeeByPlan,
) {
  const profile = employeeByPlan[planKey];
  const existing = await admin
    .from('employees')
    .select('id')
    .eq('company_id', companyId)
    .eq('employee_type', profile.employeeType)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id;

  const created = await admin
    .from('employees')
    .insert({
      company_id: companyId,
      employee_type: profile.employeeType,
      name: profile.name,
      description: profile.description,
      status: 'active',
      runtime_status: 'active',
      provider_key: profile.providerKey,
      connected_tools: [...profile.connectedTools],
      instructions: { role: profile.employeeType },
    })
    .select('id')
    .single();
  if (created.error) throw created.error;
  await recordBusinessEvent({
    eventName: 'employee_hired',
    companyId,
    metadata: { employee_type: profile.employeeType, employee_id: created.data.id },
  }).catch(() => undefined);
  await publishEvent({
    companyId,
    employeeId: created.data.id,
    name: 'EmployeeActivated',
    source: 'billing',
    idempotencyKey: `brain:employee-activated:${created.data.id}`,
    payload: { employee_type: profile.employeeType, plan_key: planKey },
  });
  return created.data.id;
}

function brainEventForStripeEvent(event: StripeEvent, purchaseType: string | null): BrainEventName | null {
  if (purchaseType === 'prepaid_minutes') return 'MinutesPurchased';
  if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') return 'PaymentCompleted';
  if (event.type === 'customer.subscription.created') return 'SubscriptionStarted';
  if (event.type === 'customer.subscription.deleted') return 'SubscriptionCancelled';
  return null;
}

export async function processStripeEvent(event: StripeEvent) {
  const admin = createAdminClient();
  const object = event.data.object;
  const companyHint = stringValue(metadata(object).company_id) ?? stringValue(object.client_reference_id);
  const resolvedSubscription = await findSubscription(admin, object, companyHint);
  const resolvedCompanyId = companyHint ?? resolvedSubscription?.company_id;
  if (!resolvedCompanyId) throw new Error('stripe_event_tenant_not_found');
  if (event.type === 'checkout.session.completed') {
    await recordBusinessEvent({
      eventName: 'checkout_completed',
      companyId: resolvedCompanyId,
      metadata: { session_id: stringValue(object.id), purchase_type: stringValue(metadata(object).purchase_type) ?? 'subscription' },
    }).catch(() => undefined);
  }
  const auditPayload = { processed: false, event_type: event.type, object_id: stringValue(object.id), received_at: new Date().toISOString() } as Json;
  const inserted = await admin.from('subscription_events').insert({ company_id: resolvedCompanyId, subscription_id: resolvedSubscription?.id ?? null, event_type: event.type, provider_key: 'stripe', provider_event_id: event.id, payload: auditPayload }).select('id,payload').maybeSingle();
  let eventRow = inserted.data;
  if (inserted.error) {
    if (inserted.error.code !== '23505') throw inserted.error;
    eventRow = (await admin.from('subscription_events').select('id,payload').eq('provider_event_id', event.id).single()).data;
    const existingPayload = objectValue(eventRow?.payload);
    if (existingPayload.processed === true) return { duplicate: true };
  }
  if (!eventRow) throw new Error('stripe_event_audit_failed');

  if (event.type === 'checkout.session.completed') {
    if (metadata(object).purchase_type === 'prepaid_minutes') {
      const packKey = stringValue(metadata(object).pack_key);
      if (!packKey) throw new Error('stripe_prepaid_pack_missing');
      const applied = await admin.rpc('service_apply_prepaid_purchase', {
        target_company: resolvedCompanyId,
        target_pack_key: packKey,
        target_provider_event_id: event.id,
        target_provider_payment_id: stringValue(object.payment_intent) ?? '',
        target_checkout_session_id: stringValue(object.id) ?? '',
        target_amount_minor: numberValue(object.amount_total) ?? 0,
        target_tax_minor: numberValue(object.amount_tax) ?? 0,
        target_currency: (stringValue(object.currency) ?? 'eur').toUpperCase(),
        target_metadata: (object.metadata ?? {}) as Json,
      });
      if (applied.error) throw applied.error;
    } else {
      const current = await findSubscription(admin, object, companyHint);
      if (!current) throw new Error('stripe_checkout_tenant_not_found');
      const providerSubscriptionId = stringValue(object.subscription);
      const key = stringValue(metadata(object).plan_key);
      const result = await admin.from('subscriptions').update({ provider_customer_id: stringValue(object.customer), provider_subscription_id: providerSubscriptionId, plan_id: await planId(admin, key), plan_key: key, provider: 'stripe', updated_at: new Date().toISOString() }).eq('id', current.id);
      if (result.error) throw result.error;
      if (key === 'employee_email' || key === 'employee_closer' || key === 'employee_whatsapp') {
        await activateEmployeeForPlan(admin, resolvedCompanyId, key);
      }
      if (key && departmentForPlan(key)) {
        await activateDepartmentForPlan(admin, resolvedCompanyId, current.id, key);
      }
    }
  } else if (event.type.startsWith('customer.subscription.')) {
    await syncSubscription(admin, object, companyHint);
  } else if (event.type.startsWith('invoice.')) {
    await syncInvoice(admin, object, companyHint);
  } else if (event.type === 'customer.deleted') {
    const current = await findSubscription(admin, object, companyHint);
    if (current) await updateSubscriptionState(admin, current, 'canceled', { provider_customer_id: null, canceled_at: new Date().toISOString() });
  }

  const purchaseType = stringValue(metadata(object).purchase_type);
  const commercialEvent = purchaseType === 'prepaid_minutes'
    ? 'minutes_purchased'
    : event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded'
      ? 'payment_completed'
      : event.type === 'customer.subscription.created' && object.status === 'trialing'
        ? 'trial_started'
        : event.type === 'customer.subscription.updated' && object.status === 'active'
          ? 'subscription_active'
          : event.type === 'customer.subscription.deleted'
            ? 'subscription_cancelled'
            : event.type === 'customer.subscription.updated' && object.cancel_at_period_end === false && resolvedSubscription?.state === 'canceled'
              ? 'subscription_reactivated'
              : null;
  if (commercialEvent) {
    await recordBusinessEvent({
      eventName: commercialEvent,
      companyId: resolvedCompanyId,
      source: 'stripe.webhook',
      idempotencyKey: `stripe:${event.id}:${commercialEvent}`,
      metadata: { provider_event_id: event.id, provider_object_id: stringValue(object.id), purchase_type: purchaseType },
    }).catch(() => undefined);
  }
  const brainEvent = brainEventForStripeEvent(event, purchaseType);
  if (brainEvent) {
    await publishEvent({
      companyId: resolvedCompanyId,
      name: brainEvent,
      source: 'stripe',
      idempotencyKey: `brain:stripe:${event.id}`,
      payload: { stripe_event_id: event.id, event_type: event.type, purchase_type: purchaseType },
    });
  }

  const processedPayload = { ...objectValue(eventRow.payload), processed: true, processed_at: new Date().toISOString() } as Json;
  const completed = await admin.from('subscription_events').update({ payload: processedPayload }).eq('id', eventRow.id);
  if (completed.error) throw completed.error;
  const notificationEvent = purchaseType === 'prepaid_minutes'
    ? 'prepaid.purchase'
    : event.type === 'customer.subscription.created' && object.status === 'trialing'
      ? 'trial.started'
      : event.type === 'customer.subscription.deleted'
        ? 'subscription.cancelled'
        : event.type === 'customer.subscription.updated' && object.cancel_at_period_end === true
          ? 'subscription.cancelled'
          : event.type === 'customer.subscription.updated' && resolvedSubscription?.state === 'canceled' && object.status === 'active'
            ? 'subscription.reactivated'
        : event.type;
  void notifyOwner({
    subject: 'Empleado24 · actividad comercial',
    message: purchaseType === 'prepaid_minutes' ? 'Se ha realizado una recarga de minutos.' : 'La actividad comercial se ha actualizado correctamente.',
    companyId: resolvedCompanyId,
    event: notificationEvent,
    idempotencyKey: `owner:stripe:${event.id}`,
  }).catch((error) => console.warn(JSON.stringify({ event: 'owner_notification_failed', stripe_event: event.id, error: error instanceof Error ? error.message : String(error) })));
  return { duplicate: false };
}
