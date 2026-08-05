'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Json } from '@empleado24/types';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { headers } from 'next/headers';
import { enforceRateLimit } from '@/lib/rate-limit';
import { notifyOwner } from '@/lib/owner-notifications';
import { recordBusinessEvent } from '@/lib/business-events';
import { getCustomer, publishEvent, saveMemory } from '@/lib/empleado24-brain';

const locales = new Set(['es', 'en', 'pt', 'fr', 'it', 'de']);
const currencies = new Set(['EUR', 'USD', 'GBP', 'MXN', 'BRL']);
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function text(formData: FormData, key: string, max = 500) {
  return String(formData.get(key) ?? '').trim().slice(0, max);
}

export async function completeOnboarding(formData: FormData) {
  const returnTo = text(formData, 'return_to', 40) === 'settings' ? '/app/configuracion' : '/onboarding';
  const companyId = text(formData, 'company_id', 36);
  const companyName = text(formData, 'company_name', 120);
  const receptionistName = text(formData, 'receptionist_name', 80);
  const primaryLocale = text(formData, 'primary_locale', 5);
  const currency = text(formData, 'currency', 3);
  const timezone = text(formData, 'timezone', 80);
  const open = text(formData, 'open', 5);
  const close = text(formData, 'close', 5);

  if (!companyId || companyName.length < 2 || receptionistName.length < 2 || !locales.has(primaryLocale) || !currencies.has(currency) || !timezone || !timePattern.test(open) || !timePattern.test(close) || open >= close) {
    redirect(`${returnTo}?error=invalid`);
  }

  const secondaryLocales = formData.getAll('secondary_locales').map(String).filter((locale) => locales.has(locale) && locale !== primaryLocale);
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const businessHours = Object.fromEntries([
    ...weekdays.map((day) => [day, { enabled: true, open, close }]),
    ['saturday', { enabled: formData.get('weekends') === 'on', open, close }],
    ['sunday', { enabled: false, open, close }],
  ]) as Json;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const request = new Request('https://empleado24.internal/onboarding', { headers: await headers() });
  const decision = await enforceRateLimit(request, {
    action: 'company.onboarding', maxRequests: 10, windowSeconds: 900,
    dimensions: [{ kind: 'user', value: auth.user.id }, { kind: 'company', value: companyId }],
  });
  if (!decision.allowed) redirect(`${returnTo}?error=rate_limit`);
  const { error } = await supabase.rpc('complete_company_onboarding', {
    target_company: companyId,
    company_name: companyName,
    company_sector: text(formData, 'sector', 100),
    company_country: text(formData, 'country', 2),
    company_currency: currency,
    company_locale: primaryLocale,
    company_timezone: timezone,
    company_business_hours: businessHours,
    receptionist_name: receptionistName,
    receptionist_primary_locale: primaryLocale,
    receptionist_secondary_locales: secondaryLocales,
    receptionist_description: text(formData, 'description', 1000),
    receptionist_greeting: text(formData, 'greeting', 500),
    receptionist_farewell: text(formData, 'farewell', 500),
    receptionist_unknown_answer_policy: text(formData, 'unknown_answer_policy', 1000),
    receptionist_handoff_policy: text(formData, 'handoff_policy', 1000),
  });

  if (error) redirect(`${returnTo}?error=save`);
  await Promise.all([
    recordBusinessEvent({ eventName: 'company_created', companyId, userId: auth.user.id, source: 'onboarding', idempotencyKey: `company-created:${companyId}` }),
    recordBusinessEvent({ eventName: 'employee_hired', companyId, userId: auth.user.id, source: 'onboarding', idempotencyKey: `employee-hired:onboarding:${companyId}` }),
  ]).catch(() => undefined);
  // A public Laura conversation has no company while the visitor is anonymous.
  // Once the visitor creates one, connect that commercial context to the
  // existing Customer 360 without changing the Brain schema or checkout flow.
  void (async () => {
    const admin = createAdminClient() as any;
    const { data: lead } = await admin.from('sales_assistant_leads')
      .select('id,anonymous_id,name,email,company_name,sector,primary_problem,recommended_employees,roi_snapshot')
      .eq('registered_user_id', auth.user.id)
      .is('registered_company_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lead) return;
    await admin.from('sales_assistant_leads').update({
      registered_company_id: companyId, commercial_state: 'INTERESTED', updated_at: new Date().toISOString(),
    }).eq('id', lead.id);
    if (lead.anonymous_id) await admin.from('sales_assistant_conversations').update({
      commercial_state: 'INTERESTED', updated_at: new Date().toISOString(),
    }).eq('anonymous_id', lead.anonymous_id);
    const customer = await getCustomer({
      companyId, name: lead.name, email: lead.email, companyName: lead.company_name, source: 'laura_sales_assistant',
    });
    await saveMemory({
      companyId, customerId: customer.id, type: 'commercial',
      content: `Laura detectó interés por ${lead.primary_problem ?? 'mejorar la atención comercial'}.`,
      metadata: { lead_id: lead.id, sector: lead.sector, recommendation: lead.recommended_employees, roi: lead.roi_snapshot },
    });
    await publishEvent({
      companyId, customerId: customer.id, name: 'LeadCreated', source: 'laura_sales_assistant',
      idempotencyKey: `brain:laura:lead:${lead.id}`, payload: { lead_id: lead.id, attribution: 'laura' },
    });
  })().catch(() => undefined);
  void notifyOwner({
    subject: 'Empleado24 · empresa creada',
    message: `La empresa ${companyName} ha completado el onboarding inicial.`,
    companyId,
    event: 'company.created',
  }).catch(() => undefined);
  void notifyOwner({
    subject: 'Empleado24 · empleado contratado',
    message: `La Recepcionista ${receptionistName} está lista para incorporarse al equipo.`,
    companyId,
    event: 'employee.hired',
  }).catch(() => undefined);
  revalidatePath('/app', 'layout');
  redirect(returnTo === '/onboarding' ? '/app/recepcionista?prepare=1' : '/app/configuracion?saved=1');
}
