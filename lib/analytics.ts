'use client';

// G2M's own analytics: events go to /api/v and show on the private /stats page (lib/stats/server.ts).
// Also works with Plausible if NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set, and fires a DOM event "g2m:track"
// so any other tool can be wired in without touching components.
type Props = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Props }) => void;
  }
}

/** True on devices the owner marked "don't count" on /stats. */
export const ignored = () => typeof document !== 'undefined' && /(?:^|;\s*)g2m_ignore=1/.test(document.cookie);

/** Sends one hit without slowing the page; survives the page being closed or left. */
export function send(name: string, extra: { props?: Props; ref?: string; utm?: string | null; landing?: boolean } = {}) {
  if (typeof window === 'undefined' || ignored()) return;
  const body = JSON.stringify({
    n: name,
    p: window.location.pathname,
    r: extra.ref,
    u: extra.utm,
    e: extra.landing ? 1 : undefined,
    props: extra.props
  });
  try {
    if (!navigator.sendBeacon?.('/api/v', new Blob([body], { type: 'application/json' }))) {
      void fetch('/api/v', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } });
    }
  } catch {
    // Analytics must never break the UI.
  }
}

export function track(event: string, props: Props = {}): void {
  if (typeof window === 'undefined') return;
  try {
    send(event, { props });
    window.plausible?.(event, { props });
    window.dispatchEvent(new CustomEvent('g2m:track', { detail: { event, props } }));
  } catch {
    // Analytics must never break the UI.
  }
}

/** Rough spend band, so the stats show what people plan to spend without exact amounts. */
export const spendBand = (usd: number) =>
  usd < 500 ? 'under $500' : usd < 1000 ? '$500–1k' : usd < 2500 ? '$1k–2.5k' : usd < 5000 ? '$2.5k–5k' : '$5k+';
