import { NextResponse } from 'next/server';
import { runReleaseGuardian, type GuardianMode } from '@/lib/release-guardian';
import { refreshAnalyticsDaily } from '@/lib/analytics-rollup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  return NextResponse.json({ ...result, analytics }, { status: result.status === 'ok' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
