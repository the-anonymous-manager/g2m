import Link from 'next/link';
import { LogoLockup } from '@/components/Logo';
import { NavLinks } from '@/components/NavLinks';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageMenu } from '@/components/LanguageMenu';

type HeaderWords = {
  home: string;
  homeLabel: string;
  nav: { href: string; label: string }[];
  language: string;
  cta: { href: string; label: string };
};

/** `words`: the same header in another language (its links and labels); English when left out. */
export function Header({ words }: { words?: HeaderWords }) {
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Link href={words?.home ?? '/'} className="brand" aria-label={words?.homeLabel ?? 'G2M home'}>
          <LogoLockup id="hdr" />
        </Link>
        {words ? <NavLinks items={words.nav} label={words.homeLabel} /> : <NavLinks />}
        <div className="header-actions">
          <LanguageMenu label={words?.language ?? 'Language'} />
          <ThemeToggle />
          <Link href={words?.cta.href ?? '/finder'} className="btn btn-metal header-cta">
            {words?.cta.label ?? 'Find your best card'}
          </Link>
        </div>
      </div>
    </header>
  );
}
