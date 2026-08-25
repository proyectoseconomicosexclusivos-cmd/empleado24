import { resilientFetch } from './resilient-fetch.ts';

export type BillingResult<T> = { data: T } | { error: { code: string; message: string } };

export interface BillingPlan {
  key: string;
  /** Stripe lookup keys are stable commercial identifiers, not database IDs. */
  lookupKey?: string;
  name: string;
  description?: string | null;
  amountMinor: number;
  currency: string;
  trialDays: number;
}

export interface PrepaidMinutePack {
  key: string;
  name: string;
  minutes: number;
  amountMinor: number;
  currency: string;
  targetMarginBps: number;
}

export function calculatePrepaidPriceMinor(costPerMinuteMicros: number, minutes: number, targetMarginBps: number) {
  if (!Number.isFinite(costPerMinuteMicros) || costPerMinuteMicros < 0) throw new Error('Invalid configured minute cost.');
  if (!Number.isInteger(minutes) || minutes <= 0) throw new Error('Invalid prepaid minute pack.');
  if (!Number.isInteger(targetMarginBps) || targetMarginBps < 0 || targetMarginBps >= 10000) throw new Error('Invalid target margin.');
  const costMicros = costPerMinuteMicros * minutes;
  const priceMicros = Math.ceil(costMicros * 10000 / (10000 - targetMarginBps));
  return Math.ceil(priceMicros / 10000);
}

export interface BillingProvider {
  createCustomer(input: { companyId: string; email: string; name: string }): Promise<BillingResult<{ customerId: string }>>;
  createCheckout(input: { companyId: string; customerId: string; plan: BillingPlan; successUrl: string; cancelUrl: string; attemptId: string; attribution?: Record<string, string> }): Promise<BillingResult<{ url: string }>>;
  createPrepaidCheckout(input: { companyId: string; customerId: string; pack: PrepaidMinutePack; successUrl: string; cancelUrl: string; attemptId: string }): Promise<BillingResult<{ url: string }>>;
  createPortal(input: { customerId: string; returnUrl: string; plans: BillingPlan[] }): Promise<BillingResult<{ url: string }>>;
  parseWebhook(input: { payload: string; signature?: string }): Promise<BillingResult<StripeEvent>>;
}

export interface StripeCustomer extends Record<string, unknown> {
  id: string;
  email?: string | null;
  name?: string | null;
  metadata?: Record<string, string>;
}

export interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, unknown> };
}

type StripeObject = Record<string, unknown> & { id: string };

function form(data: Record<string, string | number | boolean | undefined>) {
  const body = new URLSearchParams();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) body.append(key, String(value));
  });
  return body;
}

function safeMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === 'string') return error.message;
  }
  return fallback;
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export class StripeBillingAdapter implements BillingProvider {
  private readonly secretKey: string;
  private readonly webhookSecret?: string;
  private readonly fetcher: typeof fetch;
  readonly mode: 'live' | 'test';

  constructor(
    secretKey: string,
    webhookSecret?: string,
    fetcher: typeof fetch = fetch,
  ) {
    if (!secretKey.startsWith('sk_')) throw new Error('A valid Stripe secret key is required.');
    this.secretKey = secretKey;
    this.webhookSecret = webhookSecret;
    this.fetcher = fetcher;
    this.mode = secretKey.startsWith('sk_live_') ? 'live' : 'test';
  }

  async retrieveCustomer(customerId: string): Promise<BillingResult<StripeCustomer>> {
    return this.request<StripeCustomer>(`/v1/customers/${encodeURIComponent(customerId)}`);
  }

  async findCustomerByEmail(email: string, companyId: string): Promise<BillingResult<{ customerId: string } | null>> {
    if (!email) return { data: null };
    const result = await this.request<StripeObject & { data?: StripeCustomer[] }>(`/v1/customers?email=${encodeURIComponent(email)}&limit=100`);
    if ('error' in result) return result;
    const customers = result.data.data ?? [];
    const companyMatch = customers.find((customer) => customer.metadata?.company_id === companyId);
    // Never attach another tenant's Customer. An unowned legacy Customer may be
    // safely adopted, but a Customer with a different company_id must not be shared.
    const unownedEmailMatch = customers.find((customer) => customer.email?.toLowerCase() === email.toLowerCase() && !customer.metadata?.company_id);
    const emailMatch = companyMatch ?? unownedEmailMatch;
    return { data: emailMatch ? { customerId: emailMatch.id } : null };
  }

  private async request<T extends StripeObject>(path: string, init?: { method?: 'GET' | 'POST'; data?: Record<string, string | number | boolean | undefined>; idempotencyKey?: string }): Promise<BillingResult<T>> {
    const method = init?.method ?? 'GET';
    const headers: Record<string, string> = { Authorization: `Bearer ${this.secretKey}` };
    if (init?.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;
    const body = method === 'POST' ? form(init?.data ?? {}) : undefined;
    let response: Response;
    try {
      response = await resilientFetch(`https://api.stripe.com${path}`, {
        method,
        headers,
        body,
        cache: 'no-store',
        timeoutMs: 10_000,
        maxAttempts: 3,
        breakerKey: 'stripe-api',
        fetcher: this.fetcher,
      });
    } catch (error) {
      return { error: { code: error instanceof Error ? error.message : 'stripe_unavailable', message: 'Stripe no está disponible en este momento.' } };
    }
    const payload = await response.json().catch(() => null) as T | null;
    if (!response.ok || !payload) return { error: { code: `stripe_http_${response.status}`, message: safeMessage(payload, 'Stripe rejected the request.') } };
    return { data: payload };
  }

  async createCustomer(input: { companyId: string; email: string; name: string }) {
    return this.request<StripeObject>('/v1/customers', {
      method: 'POST',
      idempotencyKey: `empleado24-customer-${input.companyId}`,
      data: { email: input.email, name: input.name, 'metadata[company_id]': input.companyId },
    }).then((result): BillingResult<{ customerId: string }> => 'error' in result ? result : { data: { customerId: result.data.id } });
  }

  private async ensurePrice(plan: BillingPlan): Promise<BillingResult<{ priceId: string; productId: string }>> {
    const lookupKey = plan.lookupKey ?? `empleado24_${plan.key}_monthly`;
    const prices = await this.request<StripeObject & { data?: Array<StripeObject & { active?: boolean; unit_amount?: number; currency?: string; product?: string; recurring?: { interval?: string; interval_count?: number } }> }>(`/v1/prices?active=true&lookup_keys[]=${encodeURIComponent(lookupKey)}&limit=10`);
    if ('error' in prices) return prices;
    const matching = prices.data.data?.find((price) => price.unit_amount === plan.amountMinor && price.currency?.toUpperCase() === plan.currency.toUpperCase() && price.recurring?.interval === 'month' && price.recurring.interval_count === 1);
    if (matching && typeof matching.product === 'string') return { data: { priceId: matching.id, productId: matching.product } };

    let productId = prices.data.data?.find((price) => typeof price.product === 'string')?.product;
    if (!productId) {
      const products = await this.request<StripeObject & { data?: Array<StripeObject & { metadata?: Record<string, string> }> }>('/v1/products?active=true&limit=100');
      if ('error' in products) return products;
      productId = products.data.data?.find((product) => product.metadata?.plan_key === plan.key)?.id;
    }
    if (!productId) {
      const product = await this.request<StripeObject>('/v1/products', { method: 'POST', idempotencyKey: `empleado24-product-${plan.key}`, data: { name: `Empleado24 · ${plan.name}`, description: plan.description ?? undefined, 'metadata[plan_key]': plan.key } });
      if ('error' in product) return product;
      productId = product.data.id;
    }
    const price = await this.request<StripeObject>('/v1/prices', {
      method: 'POST',
      idempotencyKey: `empleado24-price-${plan.key}-${plan.amountMinor}-${plan.currency}`,
      data: { product: productId, currency: plan.currency.toLowerCase(), unit_amount: plan.amountMinor, 'recurring[interval]': 'month', lookup_key: lookupKey, transfer_lookup_key: true, 'metadata[plan_key]': plan.key },
    });
    return 'error' in price ? price : { data: { priceId: price.data.id, productId } };
  }

  async createCheckout(input: { companyId: string; customerId: string; plan: BillingPlan; successUrl: string; cancelUrl: string; attemptId: string; attribution?: Record<string, string> }) {
    const price = await this.ensurePrice(input.plan);
    if ('error' in price) return price;
    const trialDays = Number.isInteger(input.plan.trialDays) && input.plan.trialDays > 0 ? input.plan.trialDays : 0;
    const checkout = await this.request<StripeObject & { url?: string }>('/v1/checkout/sessions', {
      method: 'POST',
      idempotencyKey: `empleado24-checkout-${input.companyId}-${input.attemptId}`,
      data: {
        mode: 'subscription', customer: input.customerId, client_reference_id: input.companyId,
        'line_items[0][price]': price.data.priceId, 'line_items[0][quantity]': 1,
        success_url: input.successUrl, cancel_url: input.cancelUrl, allow_promotion_codes: true,
        payment_method_collection: 'always',
        'metadata[company_id]': input.companyId, 'metadata[plan_key]': input.plan.key,
        'subscription_data[metadata][company_id]': input.companyId, 'subscription_data[metadata][plan_key]': input.plan.key,
        ...Object.fromEntries(Object.entries(input.attribution ?? {}).flatMap(([key, value]) => [
          [`metadata[${key}]`, value], [`subscription_data[metadata][${key}]`, value],
        ])),
        'subscription_data[trial_period_days]': trialDays || undefined,
      },
    });
    return 'error' in checkout ? checkout : checkout.data.url ? { data: { url: checkout.data.url } } : { error: { code: 'stripe_checkout_url_missing', message: 'Stripe did not return a Checkout URL.' } };
  }

  private async ensurePrepaidPrice(pack: PrepaidMinutePack): Promise<BillingResult<{ priceId: string; productId: string }>> {
    const lookupKey = `empleado24_prepaid_${pack.key}`;
    const prices = await this.request<StripeObject & { data?: Array<StripeObject & { active?: boolean; unit_amount?: number; currency?: string; product?: string; recurring?: unknown; metadata?: Record<string, string> }> }>(`/v1/prices?active=true&lookup_keys[]=${encodeURIComponent(lookupKey)}&limit=10`);
    if ('error' in prices) return prices;
    const matching = prices.data.data?.find((price) => price.unit_amount === pack.amountMinor && price.currency?.toUpperCase() === pack.currency.toUpperCase() && !price.recurring);
    if (matching && typeof matching.product === 'string') return { data: { priceId: matching.id, productId: matching.product } };
    let productId = prices.data.data?.find((price) => typeof price.product === 'string')?.product;
    if (!productId) {
      const products = await this.request<StripeObject & { data?: Array<StripeObject & { metadata?: Record<string, string> }> }>('/v1/products?active=true&limit=100');
      if ('error' in products) return products;
      productId = products.data.data?.find((product) => product.metadata?.prepaid_pack_key === pack.key)?.id;
    }
    if (!productId) {
      const product = await this.request<StripeObject>('/v1/products', { method: 'POST', idempotencyKey: `empleado24-prepaid-product-${pack.key}`, data: { name: `Empleado24 · ${pack.name}`, description: `${pack.minutes} minutos prepago`, 'metadata[prepaid_pack_key]': pack.key, 'metadata[minutes]': pack.minutes } });
      if ('error' in product) return product;
      productId = product.data.id;
    }
    const price = await this.request<StripeObject>('/v1/prices', {
      method: 'POST', idempotencyKey: `empleado24-prepaid-price-${pack.key}-${pack.amountMinor}-${pack.currency}`,
      data: { product: productId, currency: pack.currency.toLowerCase(), unit_amount: pack.amountMinor, lookup_key: lookupKey, transfer_lookup_key: true, 'metadata[prepaid_pack_key]': pack.key, 'metadata[minutes]': pack.minutes, 'metadata[target_margin_bps]': pack.targetMarginBps },
    });
    return 'error' in price ? price : { data: { priceId: price.data.id, productId } };
  }

  async createPrepaidCheckout(input: { companyId: string; customerId: string; pack: PrepaidMinutePack; successUrl: string; cancelUrl: string; attemptId: string }) {
    const price = await this.ensurePrepaidPrice(input.pack);
    if ('error' in price) return price;
    const checkout = await this.request<StripeObject & { url?: string }>('/v1/checkout/sessions', {
      method: 'POST',
      idempotencyKey: `empleado24-prepaid-checkout-${input.companyId}-${input.pack.key}-${input.attemptId}`,
      data: {
        mode: 'payment', customer: input.customerId, client_reference_id: input.companyId,
        'line_items[0][price]': price.data.priceId, 'line_items[0][quantity]': 1,
        success_url: input.successUrl, cancel_url: input.cancelUrl,
        'metadata[company_id]': input.companyId, 'metadata[purchase_type]': 'prepaid_minutes', 'metadata[pack_key]': input.pack.key, 'metadata[minutes]': input.pack.minutes,
      },
    });
    return 'error' in checkout ? checkout : checkout.data.url ? { data: { url: checkout.data.url } } : { error: { code: 'stripe_prepaid_checkout_url_missing', message: 'Stripe did not return a Checkout URL.' } };
  }

  async createPortal(input: { customerId: string; returnUrl: string; plans: BillingPlan[] }) {
    const catalog = [] as Array<{ productId: string; priceId: string }>;
    for (const plan of input.plans) {
      const price = await this.ensurePrice(plan);
      if ('error' in price) return price;
      catalog.push(price.data);
    }
    const configurationData: Record<string, string | number | boolean | undefined> = {
      'business_profile[headline]': 'Gestiona tu equipo digital de Empleado24',
      'features[payment_method_update][enabled]': true,
      'features[invoice_history][enabled]': true,
      'features[subscription_cancel][enabled]': true,
      'features[subscription_cancel][mode]': 'at_period_end',
      'features[subscription_update][enabled]': true,
      'features[subscription_update][default_allowed_updates][0]': 'price',
      'features[subscription_update][proration_behavior]': 'create_prorations',
    };
    catalog.forEach((item, index) => {
      configurationData[`features[subscription_update][products][${index}][product]`] = item.productId;
      configurationData[`features[subscription_update][products][${index}][prices][0]`] = item.priceId;
    });
    const configuration = await this.request<StripeObject>('/v1/billing_portal/configurations', { method: 'POST', idempotencyKey: `empleado24-portal-${catalog.map((item) => item.priceId).join('-')}`, data: configurationData });
    if ('error' in configuration) return configuration;
    const session = await this.request<StripeObject & { url?: string }>('/v1/billing_portal/sessions', { method: 'POST', data: { customer: input.customerId, return_url: input.returnUrl, configuration: configuration.data.id } });
    return 'error' in session ? session : session.data.url ? { data: { url: session.data.url } } : { error: { code: 'stripe_portal_url_missing', message: 'Stripe did not return a portal URL.' } };
  }

  async parseWebhook(input: { payload: string; signature?: string }): Promise<BillingResult<StripeEvent>> {
    if (!this.webhookSecret || !input.signature) return { error: { code: 'stripe_signature_missing', message: 'Stripe webhook signing is not configured.' } };
    const parts = input.signature.split(',').map((part) => part.split('=', 2));
    const timestamp = parts.find(([key]) => key === 't')?.[1];
    const signatures = parts.filter((part): part is [string, string] => part[0] === 'v1' && typeof part[1] === 'string').map(([, value]) => value);
    if (!timestamp || !signatures.length || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return { error: { code: 'stripe_signature_invalid', message: 'The Stripe webhook signature is invalid or expired.' } };
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(this.webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const digest = bytesToHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${input.payload}`)));
    if (!signatures.some((signature) => constantTimeEqual(signature, digest))) return { error: { code: 'stripe_signature_invalid', message: 'The Stripe webhook signature is invalid.' } };
    try {
      const event = JSON.parse(input.payload) as StripeEvent;
      if (!event.id || !event.type || !event.data?.object) throw new Error('malformed');
      return { data: event };
    } catch {
      return { error: { code: 'stripe_payload_invalid', message: 'The Stripe webhook payload is malformed.' } };
    }
  }
}
