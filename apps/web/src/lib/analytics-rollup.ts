import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

const planPrice: Record<string, number> = {
  one_employee: 9700,
  two_employees: 19700,
  five_employees: 39700,
  employee_email: 9700,
  employee_closer: 19700,
  employee_whatsapp: 9700,
};

function range(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
  return { start, end, key: start.toISOString().slice(0, 10) };
}

export async function refreshAnalyticsDaily(date = new Date()) {
  const admin = createAdminClient() as any;
  const { start, end, key } = range(date);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const [{ data: events, error: eventsError }, { count: companies, error: companiesError }, { data: paidInvoices, error: invoicesError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    admin.from('business_events').select('event_name,visitor_id,anonymous_id').gte('created_at', startIso).lt('created_at', endIso),
    admin.from('companies').select('*', { count: 'exact', head: true }).gte('created_at', startIso).lt('created_at', endIso),
    admin.from('invoices').select('amount_paid_cents').eq('status', 'paid').gte('paid_at', startIso).lt('paid_at', endIso),
    admin.from('subscriptions').select('state,plan_key,trial_ends_at').in('state', ['active', 'past_due', 'incomplete', 'canceled', 'canceling', 'trialing']),
  ]);
  const error = eventsError ?? companiesError ?? invoicesError ?? subscriptionsError;
  if (error) throw error;
  const items = (events ?? []) as Array<{ event_name: string; visitor_id: string | null; anonymous_id: string | null }>;
  const count = (name: string) => items.filter((event) => event.event_name === name).length;
  const visitors = new Set(items.filter((event) => ['landing_view', 'page_view', 'pricing_view'].includes(event.event_name)).map((event) => event.visitor_id ?? event.anonymous_id).filter(Boolean)).size;
  const current = (subscriptions ?? []) as Array<{ state: string; plan_key: string | null; trial_ends_at: string | null }>;
  const result = await admin.from('analytics_daily').upsert({
    date: key,
    visitors,
    registered_users: count('signup_completed'),
    emails_confirmed: count('email_confirmed'),
    companies_created: companies ?? count('company_created'),
    trials_started: count('trial_started'),
    trials_active: current.filter((subscription) => subscription.state === 'trialing' && (!subscription.trial_ends_at || new Date(subscription.trial_ends_at) > new Date())).length,
    employees_hired: count('employee_hired'),
    calls_completed: count('call_completed'),
    emails_sent: count('email_sent'),
    sales_won: count('sale_won') + count('sales_won'),
    revenue_cents: (paidInvoices ?? []).reduce((sum: number, invoice: { amount_paid_cents?: number | null }) => sum + Number(invoice.amount_paid_cents ?? 0), 0),
    mrr_cents: current.filter((subscription) => subscription.state === 'active').reduce((sum, subscription) => sum + (planPrice[subscription.plan_key ?? ''] ?? 0), 0),
    cancellations: count('subscription_cancelled'),
    past_due: current.filter((subscription) => subscription.state === 'past_due').length,
    refreshed_at: new Date().toISOString(),
  }, { onConflict: 'date' });
  if (result.error) throw result.error;
  return { date: key, visitors, events: items.length };
}
