import { NextResponse } from 'next/server';
import { guardRateLimit } from '@/lib/api-guard';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyOwner } from '@/lib/owner-notifications';
import { recordBusinessEvent } from '@/lib/business-events';
import { errorFingerprint, structuredLog } from '@/lib/structured-logger';

type AuthBody = { email?: unknown; password?: unknown; name?: unknown };

function email(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? normalized
    : null;
}

function redirectOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  return new URL(request.url).origin;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  const { action } = await context.params;
  if (!['login', 'register', 'forgot-password'].includes(action))
    return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as AuthBody | null;
  const targetEmail = email(body?.email);
  if (!targetEmail)
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 400 });

  const limits = {
    login: { maxRequests: 8, windowSeconds: 900 },
    register: { maxRequests: 4, windowSeconds: 3600 },
    'forgot-password': { maxRequests: 4, windowSeconds: 3600 },
  } as const;
  const limited = await guardRateLimit(request, {
    action: `auth.${action}`,
    ...limits[action as keyof typeof limits],
    dimensions: [{ kind: 'identity', value: targetEmail }],
  });
  if (limited) return limited;

  const supabase = await createClient();
  if (action === 'login') {
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password || password.length > 1024)
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 400 });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password,
    });
    if (error || !data.user)
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    const accountLimited = await guardRateLimit(request, {
      action: 'auth.login.account',
      maxRequests: 20,
      windowSeconds: 3600,
      dimensions: [{ kind: 'user', value: data.user.id }],
    });
    if (accountLimited) {
      await supabase.auth.signOut();
      return accountLimited;
    }
    if (data.user.user_metadata?.owner_first_login_notified !== true) {
      void notifyOwner({
        subject: 'Empleado24 · primer acceso',
        message: 'Un nuevo cliente ha accedido por primera vez a su empresa.',
        event: 'user.first_login',
      }).catch(() => undefined);
      void createAdminClient().auth.admin.updateUserById(data.user.id, {
        user_metadata: { ...data.user.user_metadata, owner_first_login_notified: true },
      }).catch(() => undefined);
    }
    await recordBusinessEvent({
      eventName: 'login', userId: data.user.id, source: 'auth.login',
      idempotencyKey: `login:${data.user.id}:${new Date().toISOString().slice(0, 13)}`,
    }).catch(() => undefined);
    return NextResponse.json({ authenticated: true });
  }

  if (action === 'register') {
    const password = typeof body?.password === 'string' ? body.password : '';
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
    if (password.length < 8 || password.length > 1024 || name.length < 2)
      return NextResponse.json({ error: 'invalid_registration' }, { status: 400 });
    const { data, error } = await supabase.auth.signUp({
      email: targetEmail,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${redirectOrigin(request)}/auth/callback?next=/app`,
      },
    });
    if (error) {
      structuredLog('warn', 'auth_registration_failed', {
        status: error.status ?? null,
        code: error.code ?? null,
        fingerprint: errorFingerprint(error, 'auth.register'),
      });
      if (String(error.code).trim().toLowerCase() === 'over_email_send_rate_limit') {
        return NextResponse.json({ error: 'confirmation_email_rate_limited' }, { status: 429 });
      }
      if (String(error.code).trim().toLowerCase() === 'weak_password') {
        return NextResponse.json({ error: 'weak_password' }, { status: 400 });
      }
      return NextResponse.json({ error: 'registration_failed' }, { status: 400 });
    }
    void notifyOwner({
      subject: 'Empleado24 · nuevo registro',
      message: `Se ha creado una cuenta con ${targetEmail}.`,
      event: 'user.registered',
    }).catch(() => undefined);
    const registrationKey = data.user?.id ? `signup:${data.user.id}` : `signup:${targetEmail}`;
    await Promise.all([
      recordBusinessEvent({ eventName: 'registration_started', userId: data.user?.id ?? null, source: 'auth.register', idempotencyKey: registrationKey, metadata: { source: 'auth.register' } }),
      recordBusinessEvent({ eventName: 'signup_completed', userId: data.user?.id ?? null, source: 'auth.register', idempotencyKey: `${registrationKey}:completed`, metadata: { source: 'auth.register' } }),
    ]).catch(() => undefined);
    return NextResponse.json({ authenticated: Boolean(data.session) });
  }

  await supabase.auth.resetPasswordForEmail(targetEmail, {
    redirectTo: `${redirectOrigin(request)}/auth/callback?next=/update-password`,
  });
  return NextResponse.json({ accepted: true });
}
