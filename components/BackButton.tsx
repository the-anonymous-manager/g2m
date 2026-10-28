'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const PREV = 'g2m_prev';
const HERE = 'g2m_here';

const store = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v == null) sessionStorage.removeItem(k);
      else sessionStorage.setItem(k, v);
    } catch {}
  }
};

/**
 * Remembers, for this tab, whether the visitor reached the current page from another g2m.life page, so a Back button
 * can return to it (with its filters) instead of a fixed page. Rendered once in the root layout.
 */
export function NavMemory() {
  const pathname = usePathname();
  const loaded = useRef(false);
  useEffect(() => {
    const here = window.location.pathname + window.location.search;
    if (!loaded.current) {
      loaded.current = true;
      // A full page load: internal only when the browser says we came from this site.
      let internal: string | null = null;
      try {
        const ref = document.referrer ? new URL(document.referrer) : null;
        if (ref && ref.origin === window.location.origin) internal = ref.pathname + ref.search;
      } catch {}
      store.set(PREV, internal);
    } else {
      store.set(PREV, store.get(HERE));
    }
    store.set(HERE, here);
  }, [pathname]);
  return null;
}

/** "← Back": to the previous g2m.life page when there is one in this tab, else to `fallback`. */
export function BackButton({ fallback = '/cards', label = 'Back' }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <a
      href={fallback}
      className="btn btn-sm back-btn"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        if (store.get(PREV) && window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      <span aria-hidden="true">←</span> {label}
    </a>
  );
}
