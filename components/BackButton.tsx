'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LOCALES } from '@/lib/i18n/locales';
import { CHROME } from '@/lib/i18n/chrome';

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

const LANGS = new Set(LOCALES.map((l) => l.code));

/**
 * Where Back goes when this tab has no earlier g2m.life page: the page one level up that exists in every language
 * (a card's review for its alternatives or referral page, the rankings for a card, the list for a guide, a "X vs Y"
 * page or a post), else the home page.
 */
function parentOf(path: string): string {
  const segs = path.split('/').filter(Boolean);
  const lang = segs[0] && LANGS.has(segs[0]) ? segs.shift()! : null;
  const prefix = lang ? `/${lang}` : '';
  const [top, second, third] = segs;
  if (top === 'cards' && second) return third ? `${prefix}/cards/${second}` : `${prefix}/cards`;
  if ((top === 'compare' || top === 'guides' || top === 'updates') && second) return `${prefix}/${top}`;
  if (top === 'best-crypto-cards') return `${prefix}/guides`;
  return prefix || '/';
}

/**
 * The floating "← Back" button on every page but the home page (Akash, 25 Nov 2026: it stays with you as you scroll,
 * at the top under the header, in liquid glass). Goes to the previous g2m.life page in this tab (with its filters), else one level up.
 * Rendered once in the root layout, in the page's language.
 */
export function FloatingBack() {
  const pathname = usePathname() ?? '/';
  const segs = pathname.split('/').filter(Boolean);
  const lang = segs[0] && LANGS.has(segs[0]) ? segs[0] : null;
  const home = segs.length === 0 || (lang !== null && segs.length === 1);
  if (home) return null;
  const locale = lang ? LOCALES.find((l) => l.code === lang) : undefined;
  const label = lang ? CHROME[lang].back : 'Back';
  const fallback = parentOf(pathname);
  return <FloatingBackLink fallback={fallback} label={label} rtl={locale?.dir === 'rtl'} />;
}

/** The button itself. Sits just under the sticky header (its bottom edge kept in --hdr-bottom), so it stays in view. */
function FloatingBackLink({ fallback, label, rtl }: { fallback: string; label: string; rtl: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.site-header');
    if (!header) return;
    const set = () => document.documentElement.style.setProperty('--hdr-bottom', `${Math.round(header.getBoundingClientRect().bottom)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(header);
    window.addEventListener('resize', set);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', set);
    };
  }, []);
  return (
    <a
      href={fallback}
      className="float-back"
      aria-label={label}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        if (store.get(PREV) && window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      <span className="float-back-arrow" aria-hidden="true">
        {rtl ? '→' : '←'}
      </span>
      <span className="float-back-label">{label}</span>
    </a>
  );
}
