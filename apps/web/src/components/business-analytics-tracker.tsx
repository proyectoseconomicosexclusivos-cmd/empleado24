'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

type CroMetadata = {
  action?: string;
  label?: string;
  zone?: string;
  scrollDepth?: number;
  xBucket?: number;
  yBucket?: number;
  durationSeconds?: number;
  gclid?: string | null;
  ad?: string | null;
  device?: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  language?: string;
};

type AnalyticsIdentity = {
  anonymousId: string;
  sessionId: string;
  landing: string;
};

function readCookie(name: string) {
  return (
    document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${name}=`))
      ?.split('=')[1] ?? null
  );
}

function writeCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

function analyticsIdentity(): AnalyticsIdentity {
  const anonymousId = readCookie('e24_anon') ?? crypto.randomUUID();
  const sessionId = readCookie('e24_session') ?? crypto.randomUUID();
  const landing =
    readCookie('e24_landing') ?? `${window.location.pathname}${window.location.search}`;
  writeCookie('e24_anon', anonymousId, 60 * 60 * 24 * 365);
  writeCookie('e24_session', sessionId, 60 * 30);
  writeCookie('e24_landing', landing, 60 * 60 * 24 * 30);
  return { anonymousId, sessionId, landing };
}

function trackMeta(event: 'PageView' | 'ViewContent') {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) return;
  const send = () => window.fbq?.('track', event);
  if (typeof window.fbq === 'function') {
    send();
    return;
  }
  if (document.getElementById('meta-pixel-script')) return;
  const queue = ((...args: unknown[]) => {
    queue.queue.push(args);
  }) as ((...args: unknown[]) => void) & { queue: unknown[][]; loaded?: boolean; version?: string };
  queue.queue = [];
  queue.loaded = true;
  queue.version = '2.0';
  window.fbq = queue;
  window.fbq('init', pixelId);
  const bootstrap = document.createElement('script');
  bootstrap.id = 'meta-pixel-script';
  bootstrap.async = true;
  bootstrap.src = 'https://connect.facebook.net/en_US/fbevents.js';
  bootstrap.onload = send;
  document.head.appendChild(bootstrap);
}

function sendEvent(input: {
  eventName: 'landing_view' | 'pricing_view' | 'page_view';
  idempotencyKey: string;
  metadata?: CroMetadata;
}) {
  try {
    const identity = analyticsIdentity();
    const query = new URLSearchParams(window.location.search);
    const body = JSON.stringify({
      eventName: input.eventName,
      path: window.location.pathname,
      anonymousId: identity.anonymousId,
      visitorId: identity.anonymousId,
      sessionId: identity.sessionId,
      eventId: crypto.randomUUID(),
      idempotencyKey: input.idempotencyKey,
      source: input.metadata?.action ? 'cro' : 'web',
      landing: identity.landing,
      referrer: document.referrer || null,
      utmSource: query.get('utm_source'),
      utmMedium: query.get('utm_medium'),
      utmCampaign: query.get('utm_campaign'),
      utmContent: query.get('utm_content'),
      utmTerm: query.get('utm_term'),
      fbclid: query.get('fbclid'),
      gclid: query.get('gclid'),
      metadata: input.metadata,
    });
    const payload = new Blob([body], { type: 'application/json' });
    if (
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon('/api/analytics/event', payload)
    )
      return;
    void fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Medir nunca debe interrumpir el recorrido de contratación.
  }
}

function device() {
  const userAgent = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(userAgent)) return 'tablet' as const;
  return /mobi|android|iphone/.test(userAgent) ? ('mobile' as const) : ('desktop' as const);
}

function browserName() {
  const userAgent = navigator.userAgent;
  if (/Edg\//.test(userAgent)) return 'Edge';
  if (/CriOS|Chrome\//.test(userAgent)) return 'Chrome';
  if (/Firefox\//.test(userAgent)) return 'Firefox';
  if (/Safari\//.test(userAgent) && !/Chrome|CriOS/.test(userAgent)) return 'Safari';
  return 'Other';
}

function bucket(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return undefined;
  return Math.max(0, Math.min(9, Math.floor((value / total) * 10)));
}

export function BusinessAnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const identity = analyticsIdentity();
    const eventName =
      pathname === '/' ? 'landing_view' : pathname === '/pricing' ? 'pricing_view' : 'page_view';
    sendEvent({
      eventName,
      idempotencyKey: `${eventName}:${identity.sessionId}:${pathname}`,
      metadata: {
        action: 'page_view',
        gclid: new URLSearchParams(window.location.search).get('gclid'),
        ad: new URLSearchParams(window.location.search).get('utm_content'),
        device: device(),
        browser: browserName(),
        language: navigator.language.slice(0, 20),
      },
    });
    trackMeta(pathname === '/' ? 'PageView' : 'ViewContent');

    const sentDepths = new Set<number>();
    const onScroll = () => {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      if (available <= 0) return;
      const depth = Math.min(100, Math.floor((window.scrollY / available) * 100));
      const threshold = [100, 75, 50, 25].find((value) => depth >= value && !sentDepths.has(value));
      if (!threshold) return;
      sentDepths.add(threshold);
      sendEvent({
        eventName: 'page_view',
        idempotencyKey: `cro:scroll:${identity.sessionId}:${pathname}:${threshold}`,
        metadata: { action: 'scroll_depth', scrollDepth: threshold, zone: 'page' },
      });
    };

    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-e24-track]');
      if (!target) return;
      const label = target.dataset.e24Track;
      if (!label) return;
      const zone = target.dataset.e24Zone ?? 'unknown';
      sendEvent({
        eventName: 'page_view',
        idempotencyKey: `cro:click:${identity.sessionId}:${pathname}:${label}`,
        metadata: {
          action: 'click',
          label,
          zone,
          xBucket: bucket(event.clientX, window.innerWidth),
          yBucket: bucket(event.clientY, window.innerHeight),
        },
      });
    };
    const startedAt = Date.now();
    const onPageHide = () => {
      const seconds = Math.max(0, Math.min(86_400, Math.round((Date.now() - startedAt) / 1000)));
      sendEvent({
        eventName: 'page_view',
        idempotencyKey: `cro:leave:${identity.sessionId}:${pathname}`,
        metadata: { action: 'page_leave', durationSeconds: seconds, zone: 'page' },
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick);
    window.addEventListener('pagehide', onPageHide, { once: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [pathname]);

  return null;
}
