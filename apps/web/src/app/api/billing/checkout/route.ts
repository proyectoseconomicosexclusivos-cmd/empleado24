import { NextResponse } from 'next/server';
import { authorizedBillingContext, billingPlan, ensureStripeCustomer, stripeAdapter } from '@/lib/billing-runtime';
import { publicAppUrl } from '@/lib/retell-runtime';
import { guardRateLimit } from '@/lib/api-guard';
import { recordBusinessEvent } from '@/lib/business-events';

export async function POST(request: Request) {
  const context = await authorizedBillingContext();
  if ('error' in context) return NextResponse.json({ error: context.error }, { status: context.error === 'unauthorized' ? 401 : 403 });
  const limited = await guardRateLimit(request, {
    action: 'stripe.checkout', maxRequests: 5, windowSeconds: 900,
    dimensions: [{ kind: 'user', value: context.user.id }, { kind: 'company', value: context.company.id }],
  });
  if (limited) return limited;
  const body = await request.json().catch(() => ({})) as { planKey?: unknown; attemptId?: unknown };
  const planKey = typeof body.planKey === 'string' ? body.planKey : null;
  const attemptId = typeof body.attemptId === 'string' && /^[0-9a-f-]{36}$/i.test(body.attemptId) ? body.attemptId : null;
  if (!planKey || !attemptId) return NextResponse.json({ error: 'invalid_checkout_request' }, { status: 400 });
  const { data: plan } = await context.supabase.from('billing_plans').select('*').eq('plan_key', planKey).eq('active', true).eq('self_serve_enabled', true).maybeSingle();
  if (!plan) return NextResponse.json({ error: 'plan_not_available' }, { status: 404 });
  try {
    const customer = await ensureStripeCustomer(context);
    if (customer.subscription.provider_subscription_id && !['canceled', 'incomplete'].includes(customer.subscription.state)) return NextResponse.json({ error: 'subscription_already_exists', redirect: '/api/billing/portal' }, { status: 409 });
    const requestOrigin = new URL(request.url).origin.replace(/\/$/, '');
    const baseUrl = /^https:\/\//.test(requestOrigin) && !/localhost|127\.0\.0\.1/.test(requestOrigin) ? requestOrigin : publicAppUrl(request);
    if (!baseUrl) return NextResponse.json({ error: 'public_url_required' }, { status: 503 });
    const { data: lead } = await (context.admin as any)
      .from('sales_assistant_leads')
      .select('id,lead_token,anonymous_id,utm_campaign,utm_content,fbclid,gclid,meta_campaign_id,meta_adset_id,meta_ad_id,meta_form_id')
      .eq('registered_company_id', context.company.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const attribution = Object.fromEntries(Object.entries({
      lead_id: lead?.id, lead_token: lead?.lead_token, conversation_id: lead?.anonymous_id,
      utm_campaign: lead?.utm_campaign, utm_content: lead?.utm_content, fbclid: lead?.fbclid, gclid: lead?.gclid,
      meta_campaign_id: lead?.meta_campaign_id, meta_adset_id: lead?.meta_adset_id, meta_ad_id: lead?.meta_ad_id, meta_form_id: lead?.meta_form_id,
    }).filter(([, value]) => typeof value === 'string' && value.length > 0)) as Record<string, string>;
    const checkout = await stripeAdapter().createCheckout({ companyId: context.company.id, customerId: customer.customerId, plan: billingPlan(plan), successUrl: `${baseUrl}/app/facturacion?checkout=success`, cancelUrl: `${baseUrl}/app/facturacion?checkout=canceled`, attemptId, attribution });
    if ('error' in checkout) return NextResponse.json({ error: checkout.error.code, message: checkout.error.message }, { status: 502 });
    await recordBusinessEvent({ eventName: 'checkout_started', userId: context.user.id, companyId: context.company.id, metadata: { plan_key: planKey, ...attribution }, idempotencyKey: `checkout-started:${context.company.id}:${attemptId}` }).catch(() => undefined);
    return NextResponse.json(checkout.data);
  } catch (error) {
    return NextResponse.json({ error: 'checkout_failed', message: error instanceof Error ? error.message : 'Checkout unavailable.' }, { status: 502 });
  }
}
