'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const NAV = [
  { href: '/cards', label: 'Rankings' },
  { href: '/finder', label: 'Card finder' },
  { href: '/calculator', label: 'Rewards calculator' },
  { href: '/compare', label: 'Compare' },
  { href: '/methodology', label: 'Methodology' }
] as const;

export function NavLinks() {
  const path = usePathname() || '/';
  return (
    <nav className="nav" aria-label="Main">
      {NAV.map((item) => {
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
