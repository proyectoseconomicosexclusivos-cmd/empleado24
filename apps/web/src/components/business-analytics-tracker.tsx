'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

declare global { interface Window { fbq?: (...args: unknown[]) => void; } }

function trackMeta(event: 'PageView' | 'ViewContent') {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) return;
  const send = () => window.fbq?.('track', event);
  if (typeof window.fbq === 'function') { send(); return; }
  if (document.getElementById('meta-pixel-script')) return;
  const queue = ((...args: unknown[]) => { queue.queue.push(args); }) as ((...args: unknown[]) => void) & { queue: unknown[][]; loaded?: boolean; version?: string };
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

export function BusinessAnalyticsTracker() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const cookie = (name: string) => document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`))?.split('=')[1] ?? null;
      const setCookie = (name: string, value: string, maxAge: number) => { document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`; };
      const anonymousId = cookie('e24_anon') ?? crypto.randomUUID();
      const sessionId = cookie('e24_session') ?? crypto.randomUUID();
      const landing = cookie('e24_landing') ?? `${window.location.pathname}${window.location.search}`;
      setCookie('e24_anon', anonymousId, 60 * 60 * 24 * 365);
      setCookie('e24_session', sessionId, 60 * 30);
      setCookie('e24_landing', landing, 60 * 60 * 24 * 30);
      const eventName = pathname === '/' ? 'landing_view' : pathname === '/pricing' ? 'pricing_view' : 'page_view';
      const eventId = crypto.randomUUID();
      const query = new URLSearchParams(window.location.search);
      const body = JSON.stringify({
        eventName, path: pathname, anonymousId, visitorId: anonymousId, sessionId, eventId,
        idempotencyKey: `${eventName}:${sessionId}:${pathname}`,
        source: 'web', landing, referrer: document.referrer || null,
        utmSource: query.get('utm_source'), utmMedium: query.get('utm_medium'),
        utmCampaign: query.get('utm_campaign'), utmContent: query.get('utm_content'),
        utmTerm: query.get('utm_term'), fbclid: query.get('fbclid'),
      });
      const payload = new Blob([body], { type: 'application/json' });
      trackMeta(pathname === '/' ? 'PageView' : 'ViewContent');
      if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon('/api/analytics/event', payload)) return;
      void fetch('/api/analytics/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
    } catch { /* analytics must never affect the customer journey */ }
  }, [pathname]);
  return null;
}
