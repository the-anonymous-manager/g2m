'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { send } from '@/lib/analytics';

// Counts one page view per page opened, including moves between pages inside the site.
// The private /stats pages are never counted.
export function PageTracker() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (!pathname || pathname.startsWith('/stats')) return;
    const params = new URLSearchParams(window.location.search);
    // Where the visit came from only matters for the page they landed on.
    const landing = first.current;
    first.current = false;
    const hit = () => send('pageview', { landing, ref: landing ? document.referrer : undefined, utm: params.get('utm_source') || params.get('ref') });
    // A page loaded in a background tab, or prepared ahead by the browser, counts once someone actually looks at it.
    if (document.visibilityState === 'visible') return hit();
    const onShow = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', onShow);
      hit();
    };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [pathname]);

  return null;
}

/** On the "page not found" page: records which address was broken. */
export function NotFoundTracker() {
  useEffect(() => {
    send('404', { ref: document.referrer });
  }, []);
  return null;
}
