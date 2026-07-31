import { NextResponse } from 'next/server';
import { resilientFetch } from '@empleado24/integrations/resilient-fetch';

export const dynamic = 'force-dynamic';

async function probe(name: string, url: string, headers: Record<string, string>) {
  try {
    const response = await resilientFetch(url, { method: 'GET', headers, timeoutMs: 2_000, maxAttempts: 2, breakerKey: `health:${name}` });
    return { status: response.ok ? 'ok' : 'error', http_status: response.status };
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : 'unavailable' };
  }
}

export async function GET() {
  const checks: Record<string, unknown> = { cron: { status: process.env.CRON_SECRET ? 'configured' : 'missing' }, queue: { status: process.env.CRON_SECRET ? 'configured' : 'missing' }, retell: { status: 'tenant_scoped' }, zadarma: { status: 'tenant_scoped' } };
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    checks.supabase = await probe('supabase', `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY });
  else checks.supabase = { status: 'missing_configuration' };
  if (process.env.STRIPE_SECRET_KEY)
    checks.stripe = await probe('stripe', 'https://api.stripe.com/v1/balance', { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` });
  else checks.stripe = { status: 'missing_configuration' };
  if (process.env.RETELL_API_KEY)
    checks.retell = await probe('retell', 'https://api.retellai.com/list-agents?limit=1&is_latest=true', { Authorization: `Bearer ${process.env.RETELL_API_KEY}` });
  const degraded = Object.values(checks).some((value) => (value as { status?: string }).status === 'error');
  return NextResponse.json({ status: degraded ? 'degraded' : 'ok', service: 'empleado24', checks, checked_at: new Date().toISOString() }, { status: degraded ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
}
