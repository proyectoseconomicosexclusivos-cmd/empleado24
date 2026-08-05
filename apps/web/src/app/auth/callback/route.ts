import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { guardRateLimit } from '@/lib/api-guard';
import { recordBusinessEvent } from '@/lib/business-events';

export async function GET(request: Request) {
  const limited = await guardRateLimit(request, {
    action: 'auth.callback', maxRequests: 20, windowSeconds: 900,
  });
  if (limited) return limited;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const requestedNext = url.searchParams.get('next') ?? '/app';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/app';
  if (!code) return NextResponse.redirect(new URL('/login?error=invalid-link', url.origin));
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL('/login?error=invalid-link', url.origin));
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user?.email_confirmed_at && next === '/app') {
    const cookie = request.headers.get('cookie') ?? '';
    const anonymousId = cookie.match(/(?:^|;\s*)e24_anon=([^;]+)/)?.[1] ?? null;
    const sessionId = cookie.match(/(?:^|;\s*)e24_session=([^;]+)/)?.[1] ?? null;
    await recordBusinessEvent({
      eventName: 'email_confirmed', userId: auth.user.id, source: 'auth.callback',
      idempotencyKey: `email-confirmed:${auth.user.id}:${auth.user.email_confirmed_at}`,
      anonymousId: anonymousId ? decodeURIComponent(anonymousId).slice(0, 120) : null,
      sessionId: sessionId ? decodeURIComponent(sessionId).slice(0, 120) : null,
    });
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
