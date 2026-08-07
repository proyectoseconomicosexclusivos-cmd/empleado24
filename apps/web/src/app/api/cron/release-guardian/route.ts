import { NextResponse } from 'next/server';
import { runReleaseGuardian, type GuardianMode } from '@/lib/release-guardian';
import { refreshAnalyticsDaily } from '@/lib/analytics-rollup';
import { buildCeoBrief, weeklyCeoEmail } from '@/lib/ceo-insights';
import { notifyOwner } from '@/lib/owner-notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isoWeekKey(date = new Date()) {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const requested = url.searchParams.get('mode');
  const mode: GuardianMode = requested === 'daily' || requested === 'weekly' ? requested : 'probe';
  const result = await runReleaseGuardian(mode);
  let analytics: { date: string; visitors: number; events: number } | null = null;
  if (mode === 'daily') {
    try { analytics = await refreshAnalyticsDaily(); }
    catch (error) {
      return NextResponse.json({ ...result, analytics: { error: error instanceof Error ? error.message : 'analytics_rollup_failed' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  }
  if (mode === 'weekly' && process.env.CEO_WEEKLY_REPORT_ENABLED === 'true') {
    const brief = await buildCeoBrief();
    await notifyOwner({
      event: 'report.ceo.weekly',
      subject: '📊 CEO IA · informe semanal',
      message: weeklyCeoEmail(brief),
      idempotencyKey: `ceo-weekly:${isoWeekKey()}`,
      cooldownSeconds: 604800,
      channels: { email: true, telegram: false },
    });
  }
  return NextResponse.json({ ...result, analytics }, { status: result.status === 'ok' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
