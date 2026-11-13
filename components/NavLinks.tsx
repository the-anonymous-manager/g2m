'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export const NAV = [
  { href: '/cards', label: 'Rankings' },
  { href: '/finder', label: 'Card finder' },
  { href: '/calculator', label: 'Rewards calculator' },
  { href: '/wallet', label: 'Wallet builder' },
  { href: '/compare', label: 'Compare' },
  { href: '/methodology', label: 'Methodology' }
] as const;

/** `items`: the same links in another language (/de/cards …); English when left out. */
export function NavLinks({ items = NAV, label = 'Main' }: { items?: readonly { href: string; label: string }[]; label?: string }) {
  const path = usePathname() || '/';
  const nav = useRef<HTMLElement>(null);

  // On phones the links scroll sideways: bring the current page's link into view, and fade the edge
  // only while there is more to scroll to.
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (active && el.scrollWidth > el.clientWidth) {
      const a = active.getBoundingClientRect();
      const n = el.getBoundingClientRect();
      el.scrollLeft += a.left - n.left - (n.width - a.width) / 2;
    }
    const edge = () => (el.dataset.more = String(el.scrollLeft + el.clientWidth < el.scrollWidth - 2));
    edge();
    el.addEventListener('scroll', edge, { passive: true });
    window.addEventListener('resize', edge);
    return () => {
      el.removeEventListener('scroll', edge);
      window.removeEventListener('resize', edge);
    };
  }, [path]);

  return (
    <nav ref={nav} className="nav" aria-label={label}>
      {items.map((item) => {
        const active = path === item.href || path.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
