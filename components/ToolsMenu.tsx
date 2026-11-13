'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * "Tools" in the header of translated pages: a small menu with the finder, calculator, wallet builder, compare tool,
 * swipe receipt and corridor finder in that language. A <details> element, so it works before the page's scripts load.
 */
export function ToolsMenu({ label, items }: { label: string; items: { href: string; name: string }[] }) {
  const pathname = usePathname() || '/';
  const box = useRef<HTMLDetailsElement>(null);

  // Close on a click outside, on Escape, and after picking a tool.
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

  const here = items.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  return (
    <details ref={box} className="tools-menu">
      <summary className="tools-btn" aria-current={here ? 'page' : undefined}>
        {label}
        <svg className="lang-caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </summary>
      <ul className="lang-list tools-list" role="list">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={pathname === i.href ? 'true' : undefined}
              onClick={() => box.current && (box.current.open = false)}
            >
              {i.name}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
