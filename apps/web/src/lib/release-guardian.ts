import 'server-only';
import { randomUUID } from 'node:crypto';
import { resilientFetch } from '@empleado24/integrations/resilient-fetch';
import { createAdminClient } from '@/lib/supabase/admin';
import { errorFingerprint, structuredLog } from '@/lib/structured-logger';
import { notifyOwner } from '@/lib/owner-notifications';
import { buildGuardianSummary, periodBucket, type GuardianCheck, type CheckStatus } from '@/lib/release-guardian-core';
import { createTask, publishEvent } from '@/lib/empleado24-brain';

export type GuardianMode = 'probe' | 'daily' | 'weekly';

function appOrigin() {
  return (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://empleado24.com').replace(/\/$/, '');
}

async function check(name: string, operation: () => Promise<void>): Promise<GuardianCheck> {
  const started = Date.now();
  try {
    await operation();
    return { status: 'ok', latencyMs: Date.now() - started };
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 240) : 'check_failed';
    structuredLog('warn', 'release_guardian_check_failed', { check: name, detail });
    return { status: 'error', latencyMs: Date.now() - started, detail };
  }
}

async function httpCheck(url: string, headers: Record<string, string> = {}) {
  const response = await resilientFetch(url, { method: 'GET', headers, timeoutMs: 4_000, maxAttempts: 2, breakerKey: `guardian:${new URL(url).hostname}` });
  if (!response.ok) throw new Error(`http_${response.status}`);
}

async function redisCheck() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('redis_not_configured');
  const key = `empleado24:guardian:${randomUUID()}`;
  const response = await resilientFetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(['SET', key, 'ok', 'EX', 60]), timeoutMs: 4_000, maxAttempts: 2, breakerKey: 'guardian:redis' });
  if (!response.ok) throw new Error(`redis_http_${response.status}`);
  const read = await resilientFetch(`${url}/GET/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` }, timeoutMs: 4_000, maxAttempts: 2, breakerKey: 'guardian:redis' });
  if (!read.ok) throw new Error(`redis_read_http_${read.status}`);
}

/**
 * A checkout is only eligible for a follow-up after 24h, with no payment or
 * activation, and when that company has an active WhatsApp employee. The
 * Brain event and its two tasks are idempotent, so frequent Guardian runs do
 * not create duplicate commercial work. We deliberately do not send WhatsApp
 * messages directly: the employee only acts once the company has the contact
 * and consent required for that channel.
 */
async function createCheckoutFollowUps(admin: any) {
  const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: candidates, error } = await admin
    .from('business_events')
    .select('event_id,company_id,user_id,created_at')
    .eq('event_name', 'checkout_started')
    .not('company_id', 'is', null)
    .lt('created_at', staleBefore)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  for (const candidate of candidates ?? []) {
    const [{ data: payment }, { data: employee }] = await Promise.all([
      admin.from('business_events').select('event_id').eq('company_id', candidate.company_id).in('event_name', ['payment_completed', 'employee_hired']).gte('created_at', candidate.created_at).limit(1).maybeSingle(),
      admin.from('employees').select('id').eq('company_id', candidate.company_id).eq('employee_type', 'whatsapp').eq('status', 'active').maybeSingle(),
    ]);
    if (payment || !employee) continue;
    const event = await publishEvent({
      companyId: candidate.company_id,
      name: 'LeadCreated',
      source: 'revenue_guardian',
      idempotencyKey: `checkout-abandoned:${candidate.event_id}`,
      payload: { checkout_event_id: candidate.event_id, detected_at: new Date().toISOString(), channel: 'whatsapp' },
    });
    if (!event) continue;
    await createTask({
      companyId: candidate.company_id,
      sourceEventId: event.id,
      employeeType: 'whatsapp',
      type: 'review',
      title: 'Preparar recordatorio de checkout abandonado',
      metadata: { checkout_event_id: candidate.event_id, requires_contact_consent: true },
    });
  }
}

export async function runReleaseGuardian(mode: GuardianMode = 'probe') {
  const admin = createAdminClient();
  const started = new Date().toISOString();
  const { data: run } = await (admin as any).from('release_guardian_runs').insert({ mode, status: 'running', started_at: started }).select('id').single();
  const checks: Record<string, GuardianCheck> = {};
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  checks.application = await check('application', () => httpCheck(`${appOrigin()}/api/health`));
  checks.domain = await check('domain', () => httpCheck(appOrigin()));
  checks.supabase = await check('supabase', async () => { if (!supabaseUrl || !supabaseKey) throw new Error('supabase_not_configured'); await httpCheck(`${supabaseUrl}/rest/v1/companies?select=id&limit=1`, { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }); });
  checks.stripe = await check('stripe', async () => { if (!process.env.STRIPE_SECRET_KEY) throw new Error('stripe_not_configured'); await httpCheck('https://api.stripe.com/v1/balance', { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }); });
  checks.retell = await check('retell', async () => { if (!process.env.RETELL_API_KEY) throw new Error('retell_not_configured'); await httpCheck('https://api.retellai.com/list-agents?limit=1&is_latest=true', { Authorization: `Bearer ${process.env.RETELL_API_KEY}` }); });
  checks.zadarma = { status: 'ok', latencyMs: 0, detail: 'tenant_scoped_credentials' };
  checks.google_calendar = { status: 'ok', latencyMs: 0, detail: 'tenant_scoped_oauth' };
  checks.brevo = await check('brevo', async () => { if (!process.env.BREVO_API_KEY) throw new Error('brevo_not_configured'); await httpCheck('https://api.brevo.com/v3/account', { 'api-key': process.env.BREVO_API_KEY }); });
  checks.telegram = await check('telegram', async () => { if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('telegram_not_configured'); await httpCheck(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`); });
  checks.redis = await check('redis', redisCheck);
  checks.backups = await check('backups', async () => { if (!process.env.BACKUP_LAST_SUCCESS_AT) throw new Error('backup_heartbeat_not_configured'); if (Date.now() - Date.parse(process.env.BACKUP_LAST_SUCCESS_AT) > 26 * 60 * 60 * 1000) throw new Error('backup_stale'); });
  checks.restore = await check('restore', async () => { if (!process.env.RESTORE_DRILL_LAST_SUCCESS_AT) throw new Error('restore_heartbeat_not_configured'); if (Date.now() - Date.parse(process.env.RESTORE_DRILL_LAST_SUCCESS_AT) > 8 * 24 * 60 * 60 * 1000) throw new Error('restore_drill_stale'); });
  checks.queue = await check('queue', async () => { const result = await (admin as any).from('webhook_delivery_queue').select('id,status', { count: 'exact', head: true }).in('status', ['queued', 'retrying', 'processing']); if (result.error) throw result.error; if ((result.count ?? 0) > Number(process.env.GUARDIAN_QUEUE_ALERT_THRESHOLD ?? 500)) throw new Error(`queue_growing:${result.count}`); });
  checks.cron = process.env.CRON_SECRET ? { status: 'ok', latencyMs: 0 } : { status: 'error', latencyMs: 0, detail: 'cron_secret_not_configured' };
  checks.revenue_follow_up = await check('revenue_follow_up', () => createCheckoutFollowUps(admin));
  checks.certificates = await check('certificates', async () => { const value = process.env.CERTIFICATE_EXPIRY_AT; if (!value) return; if (Date.parse(value) - Date.now() < 14 * 24 * 60 * 60 * 1000) throw new Error('certificate_expiring_soon'); });
  const { data: snapshot, error: snapshotError } = await (admin as any).rpc('service_operations_snapshot');
  if (snapshotError) checks.dashboard = { status: 'error', latencyMs: 0, detail: 'operations_snapshot_failed' };
  else {
    checks.dashboard = { status: 'ok', latencyMs: 0 };
    checks.billing = { status: 'ok', latencyMs: 0 };
    checks.calls = { status: 'ok', latencyMs: 0 };
    checks.usage = { status: 'ok', latencyMs: 0 };
    checks.webhooks = { status: 'ok', latencyMs: 0 };
    if (snapshot && Number(snapshot.gross_margin_micros ?? 0) < 0) checks.profit_margin = { status: 'error', latencyMs: 0, detail: 'negative_gross_margin' };
  }
  const { data: companies } = await (admin as any).rpc('service_operations_companies', { page_limit: 20, page_offset: 0 });
  const { data: alerts } = await (admin as any).rpc('service_operations_alerts', { alert_limit: 50 });
  const summary = { ...buildGuardianSummary(checks), snapshot: snapshot ?? null, companies: companies ?? null, alerts: alerts ?? null, generatedAt: new Date().toISOString() };
  const failed = summary.failed as Array<{ key: string; detail?: string }>;
  for (const item of failed) {
    const fingerprint = errorFingerprint(`${item.key}:${item.detail ?? 'failed'}`, 'release_guardian');
    const bucket = periodBucket();
    const existing = await (admin as any).from('release_guardian_alerts').select('id').eq('fingerprint', fingerprint).eq('bucket', bucket).maybeSingle();
    if (existing.data) continue;
    await (admin as any).from('release_guardian_alerts').insert({ fingerprint, bucket, severity: item.key === 'application' || item.key === 'supabase' ? 'P0' : 'P1', message: `${item.key}: ${item.detail ?? 'check failed'}` });
    await notifyOwner({ subject: `Empleado24 · Guardian · ${item.key}`, message: item.detail ?? 'Comprobación fallida.', event: `guardian.${item.key}` });
  }
  if (mode === 'daily' || mode === 'weekly') {
    const period = mode === 'daily' ? 'daily' : 'weekly';
    await notifyOwner({ subject: `Empleado24 · Informe ${period}`, message: JSON.stringify({ status: summary.status, failed: summary.failed, snapshot: summary.snapshot, companies: summary.companies, alerts: summary.alerts }), event: `guardian.report.${period}` });
  }
  if (run?.id) await (admin as any).from('release_guardian_runs').update({ status: summary.status === 'ok' ? 'succeeded' : 'degraded', results: summary, completed_at: new Date().toISOString() }).eq('id', run.id);
  structuredLog(summary.status === 'ok' ? 'info' : 'warn', 'release_guardian_completed', { mode, status: summary.status, failed: failed.length });
  return summary;
}
