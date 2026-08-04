import 'server-only';
import { createHash } from 'node:crypto';
import { createConnection } from 'node:net';
import { resilientFetch } from '@empleado24/integrations/resilient-fetch';
import { createAdminClient } from '@/lib/supabase/admin';
import { structuredLog } from '@/lib/structured-logger';

type Dimension = { kind: 'user' | 'company' | 'identity'; value?: string | null };

export interface RateLimitRule {
  action: string;
  maxRequests: number;
  windowSeconds: number;
  dimensions?: Dimension[];
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: string;
}

async function redisRateLimit(bucket: string, maxRequests: number, windowSeconds: number) {
  const localRedisUrl = process.env.REDIS_URL;
  if (localRedisUrl) return localRedisRateLimit(localRedisUrl, bucket, maxRequests, windowSeconds);
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('global_rate_limit_not_configured');
  const script = 'local n=redis.call("INCR",KEYS[1]); if n==1 then redis.call("EXPIRE",KEYS[1],ARGV[2]); end; return n';
  const response = await resilientFetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['EVAL', script, '1', bucket, String(maxRequests), String(windowSeconds)]),
    timeoutMs: 2_000,
    maxAttempts: 2,
    breakerKey: 'upstash-rate-limit',
  });
  if (!response.ok) throw new Error(`global_rate_limit_http_${response.status}`);
  const payload = await response.json() as { result?: number };
  const hits = Number(payload.result);
  if (!Number.isFinite(hits)) throw new Error('global_rate_limit_invalid_response');
  return {
    allowed: hits <= maxRequests,
    remaining: Math.max(maxRequests - hits, 0),
    reset_at: new Date(Date.now() + windowSeconds * 1000).toISOString(),
  };
}

function respCommand(parts: string[]) {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join('')}`;
}

async function localRedisRateLimit(urlValue: string, bucket: string, maxRequests: number, windowSeconds: number) {
  const url = new URL(urlValue);
  const password = decodeURIComponent(url.password);
  if (!password) throw new Error('local_redis_password_missing');
  const script = 'local n=redis.call("INCR",KEYS[1]); if n==1 then redis.call("EXPIRE",KEYS[1],ARGV[1]); end; return n';
  const payload = [
    respCommand(['AUTH', decodeURIComponent(url.username) || 'default', password]),
    respCommand(['EVAL', script, '1', bucket, String(windowSeconds)]),
  ].join('');
  const response = await new Promise<string>((resolve, reject) => {
    const socket = createConnection({ host: url.hostname, port: Number(url.port || 6379) });
    let body = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('local_redis_timeout'));
    }, 2_000);
    socket.on('connect', () => socket.write(payload));
    socket.on('data', (chunk) => {
      body += chunk.toString();
      const matches = body.match(/:([0-9]+)\r\n/g);
      const latestHit = matches?.[matches.length - 1];
      if (latestHit) {
        clearTimeout(timer);
        socket.end();
        resolve(latestHit);
      }
    });
    socket.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  const hits = Number(response.match(/:([0-9]+)/)?.[1]);
  if (!Number.isFinite(hits)) throw new Error('local_redis_invalid_response');
  return {
    allowed: hits <= maxRequests,
    remaining: Math.max(maxRequests - hits, 0),
    reset_at: new Date(Date.now() + windowSeconds * 1000).toISOString(),
  };
}

export function clientIp(request: Request) {
  const trusted =
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('x-forwarded-for') ??
    request.headers.get('x-real-ip');
  return trusted?.split(',')[0]?.trim() || 'unknown';
}

function hashBucket(action: string, kind: string, value: string) {
  return createHash('sha256').update(`${action}\0${kind}\0${value}`).digest('hex');
}

export async function enforceRateLimit(request: Request, rule: RateLimitRule) {
  const dimensions = [
    { kind: 'ip' as const, value: clientIp(request) },
    ...(rule.dimensions ?? []).filter(
      (item): item is Dimension & { value: string } => Boolean(item.value),
    ),
  ];
  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch (error) {
    structuredLog('warn', 'rate_limit_fallback', {
      action: rule.action,
      dimension: 'runtime',
      error: error instanceof Error ? error.message : 'admin_client_unavailable',
    });
  }
  const decisions = await Promise.all(
    dimensions.map(async ({ kind, value }) => {
      const bucket = hashBucket(rule.action, kind, value);
      try {
        return await redisRateLimit(bucket, rule.maxRequests, rule.windowSeconds);
      } catch (redisError) {
        structuredLog('warn', 'rate_limit_redis_unavailable', {
          action: rule.action,
          dimension: kind,
          error: redisError instanceof Error ? redisError.message : 'redis_unavailable',
        });
      }
      if (admin) {
        const { data, error } = await admin.rpc('service_enforce_rate_limit', {
          target_bucket_hash: bucket,
          target_action: `${rule.action}:${kind}`,
          max_requests: rule.maxRequests,
          window_seconds: rule.windowSeconds,
        });
        if (!error && data?.[0]) return data[0];

        structuredLog('warn', 'rate_limit_fallback', {
          action: rule.action,
          dimension: kind,
          error: error?.message ?? 'empty_result',
        });
      }
      throw new Error('global_rate_limit_unavailable');
    }),
  );
  return decisions.reduce<RateLimitDecision>(
    (current, decision) => ({
      allowed: current.allowed && decision.allowed,
      remaining: Math.min(current.remaining, decision.remaining),
      resetAt:
        new Date(decision.reset_at) > new Date(current.resetAt)
          ? decision.reset_at
          : current.resetAt,
    }),
    { allowed: true, remaining: rule.maxRequests, resetAt: new Date(0).toISOString() },
  );
}

export function rateLimitResponse(decision: RateLimitDecision) {
  const retryAfter = Math.max(
    1,
    Math.ceil((new Date(decision.resetAt).getTime() - Date.now()) / 1000),
  );
  return Response.json(
    { error: 'rate_limit_exceeded', retryAfter },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Remaining': '0',
        'Cache-Control': 'no-store',
      },
    },
  );
}
