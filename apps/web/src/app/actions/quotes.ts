'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateQuote, parseQuoteBrief, type QuoteLineInput } from '@/lib/quote-engine';
import { getCustomer, publishEvent, saveMemory } from '@/lib/empleado24-brain';
import { recordBusinessEvent } from '@/lib/business-events';

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}
function numeric(formData: FormData, key: string, fallback: number) {
  const raw = Number(value(formData, key));
  return Number.isFinite(raw) ? raw : fallback;
}

async function quoteContext() {
  const supabase = await createClient() as any;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Debes iniciar sesión.');
  const { data: member } = await supabase.from('members').select('company_id,role').eq('user_id', auth.user.id).in('role', ['owner', 'admin']).limit(1).maybeSingle();
  if (!member) throw new Error('No tienes permiso para preparar presupuestos.');
  const { data: employee } = await supabase.from('employees').select('id').eq('company_id', member.company_id).eq('employee_type', 'budget_specialist').eq('status', 'active').maybeSingle();
  if (!employee) throw new Error('Incorpora primero a tu Especialista Presupuestos IA.');
  return { companyId: member.company_id as string, userId: auth.user.id, employeeId: employee.id as string };
}

export async function createQuote(formData: FormData) {
  const context = await quoteContext();
  const title = value(formData, 'title');
  const brief = value(formData, 'brief');
  if (title.length < 2) throw new Error('Pon un título breve para el presupuesto.');
  const parsed = parseQuoteBrief(brief || title);
  const line: QuoteLineInput = {
    chapter: value(formData, 'chapter') || 'Servicios', concept: value(formData, 'concept'),
    unit: value(formData, 'unit') || 'unidad', quantity: numeric(formData, 'quantity', 1),
    unitCostCents: Math.round(numeric(formData, 'unit_cost_euros', 0) * 100), plannedDays: Math.max(0, Math.round(numeric(formData, 'planned_days', 0))),
  };
  if (!line.concept) throw new Error('Añade al menos una partida.');
  const customerName = value(formData, 'customer_name');
  const customerEmail = value(formData, 'customer_email');
  const customerPhone = value(formData, 'customer_phone');
  if (!customerName && !customerEmail && !customerPhone) throw new Error('Añade el nombre, email o teléfono del cliente para guardar su historial.');
  const marginBps = numeric(formData, 'margin_percent', parsed.marginBps ? parsed.marginBps / 100 : 35) * 100;
  const discountBps = numeric(formData, 'discount_percent', parsed.discountBps ? parsed.discountBps / 100 : 0) * 100;
  const taxBps = numeric(formData, 'tax_percent', 21) * 100;
  const totals = calculateQuote({ lines: [line], marginBps: Math.round(marginBps), discountBps: Math.round(discountBps), taxBps: Math.round(taxBps) });
  const admin = createAdminClient() as any;
  const customer = await getCustomer({ companyId: context.companyId, name: customerName || null, email: customerEmail || null, phone: customerPhone || null, source: 'budget_specialist' });
  const { data: quote, error } = await admin.from('quotes').insert({
    company_id: context.companyId, customer_id: customer.id, employee_id: context.employeeId, title, brief: parsed.brief,
    currency: 'EUR', current_version: 1, cost_cents: totals.costCents, subtotal_cents: totals.subtotalCents, tax_cents: totals.taxCents,
    total_cents: totals.totalCents, profit_cents: totals.profitCents, margin_bps: totals.actualMarginBps, created_by: context.userId,
  }).select('id').single();
  if (error || !quote) throw error ?? new Error('quote_create_failed');
  const snapshot = { brief: parsed.brief, lines: [line], totals, margin_bps: Math.round(marginBps), discount_bps: Math.round(discountBps), tax_bps: Math.round(taxBps) };
  const { data: version, error: versionError } = await admin.from('quote_versions').insert({ quote_id: quote.id, company_id: context.companyId, version: 1, source: 'assistant', snapshot, created_by: context.userId }).select('id').single();
  if (versionError || !version) throw versionError ?? new Error('quote_version_create_failed');
  const { error: lineError } = await admin.from('quote_lines').insert({ quote_version_id: version.id, company_id: context.companyId, chapter: line.chapter, concept: line.concept, unit: line.unit, quantity: line.quantity, unit_cost_cents: line.unitCostCents, planned_days: line.plannedDays, sort_order: 0 });
  if (lineError) throw lineError;
  await Promise.all([
    saveMemory({ companyId: context.companyId, customerId: customer.id, employeeId: context.employeeId, type: 'commercial', content: `Presupuesto creado: ${title}.`, metadata: { quote_id: quote.id, total_cents: totals.totalCents } }),
    publishEvent({ companyId: context.companyId, customerId: customer.id, employeeId: context.employeeId, name: 'BudgetCreated', source: 'budget_specialist', idempotencyKey: `brain:quote:${quote.id}:v1`, payload: { quote_id: quote.id, total_cents: totals.totalCents, version: 1 } }),
    recordBusinessEvent({ eventName: 'quote_created', companyId: context.companyId, idempotencyKey: `quote-created:${quote.id}`, metadata: { quote_id: quote.id, total_cents: totals.totalCents } }),
  ]);
  revalidatePath('/app/presupuestos');
  revalidatePath('/app/centro-ventas');
}

export async function sendQuote(formData: FormData) {
  const context = await quoteContext();
  const quoteId = value(formData, 'quote_id');
  const admin = createAdminClient() as any;
  const { data: quote, error } = await admin.from('quotes').select('id,title,customer_id,total_cents').eq('company_id', context.companyId).eq('id', quoteId).single();
  if (error || !quote) throw error ?? new Error('quote_not_found');
  const deliveredAt = new Date().toISOString();
  const { error: updateError } = await admin.from('quotes').update({ status: 'sent', sent_at: deliveredAt, updated_at: deliveredAt }).eq('company_id', context.companyId).eq('id', quote.id);
  if (updateError) throw updateError;
  const { error: deliveryError } = await admin.from('quote_deliveries').upsert({ company_id: context.companyId, quote_id: quote.id, channel: 'email', status: 'prepared', idempotency_key: `quote-email:${quote.id}:v1`, metadata: { title: quote.title } }, { onConflict: 'company_id,idempotency_key', ignoreDuplicates: true });
  if (deliveryError) throw deliveryError;
  await Promise.all([
    publishEvent({ companyId: context.companyId, customerId: quote.customer_id, employeeId: context.employeeId, name: 'BudgetSent', source: 'budget_specialist', idempotencyKey: `brain:quote-sent:${quote.id}:v1`, payload: { quote_id: quote.id, total_cents: quote.total_cents } }),
    recordBusinessEvent({ eventName: 'quote_sent', companyId: context.companyId, idempotencyKey: `quote-sent:${quote.id}:v1`, metadata: { quote_id: quote.id } }),
  ]);
  revalidatePath('/app/presupuestos');
  revalidatePath('/app/centro-ventas');
}
