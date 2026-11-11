'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { LOCALES, localeOfPath, pathIn } from '@/lib/i18n/locales';

/**
 * The language button in the header: a globe with the current language, opening the list of languages. Each one
 * opens the same page in that language where it exists, otherwise that language's home page. A <details> element,
 * so it works before the page's scripts load, and the links are plain links search engines can follow.
 */
export function LanguageMenu({ label }: { label: string }) {
  const pathname = usePathname() || '/';
  const current = localeOfPath(pathname);
  const box = useRef<HTMLDetailsElement>(null);

  // Close on a click outside, on Escape, and after picking a language.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.open = false;
    const outside = (e: MouseEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false;
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && el.open) {
        el.open = false;
        el.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('click', outside);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('click', outside);
      document.removeEventListener('keydown', esc);
    };
  }, [pathname]);

  const items = [
    { code: 'en', tag: 'en', name: 'English', href: pathIn(pathname, undefined), active: !current },
    ...LOCALES.map((l) => ({ code: l.code, tag: l.tag, name: l.name, href: pathIn(pathname, l), active: current?.code === l.code }))
  ];

  return (
    <details ref={box} className="lang-menu">
      <summary className="lang-btn" aria-label={`${label}: ${current?.name ?? 'English'}`} title={label}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3 12h18M12 3c2.6 2.8 3.9 5.8 3.9 9s-1.3 6.2-3.9 9c-2.6-2.8-3.9-5.8-3.9-9S9.4 5.8 12 3Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        <span className="lang-code mono">{(current?.code ?? 'en').split('-')[0].toUpperCase()}</span>
        <svg className="lang-caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </summary>
      <ul className="lang-list" role="list">
        {items.map((i) => (
          <li key={i.code}>
            <Link
              href={i.href}
              lang={i.tag}
              hrefLang={i.tag}
              aria-current={i.active ? 'true' : undefined}
              onClick={() => box.current && (box.current.open = false)}
            >
              <span>{i.name}</span>
              <span className="mono faint">{i.code.toUpperCase()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
