import Link from 'next/link';
import { LogoLockup } from '@/components/Logo';
import { NavLinks } from '@/components/NavLinks';
import { ThemeToggle } from '@/components/ThemeToggle';

export function Header() {
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Link href="/" className="brand" aria-label="G2M home">
          <LogoLockup id="hdr" />
        </Link>
        <NavLinks />
        <div className="header-actions">
          <ThemeToggle />
          <Link href="/finder" className="btn btn-metal header-cta">
            Find your best card
          </Link>
        </div>
      </div>
    </header>
  );
}
