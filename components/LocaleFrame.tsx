'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { intlGuides, intlHome, localeOfPath } from '@/lib/i18n/locales';
import { CHROME } from '@/lib/i18n/chrome';
import { LogoLockup, LogoMark } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageMenu } from '@/components/LanguageMenu';

/**
 * Wraps every page. English pages get the usual header and footer. A page under a language prefix (/de/...) gets a
 * header and footer in that language, inside a block that carries the language and its reading direction, so
 * Arabic lays out right to left. The address decides, so this also holds in the HTML the server sends.
 */
export function LocaleFrame({ header, footer, children }: { header: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const locale = localeOfPath(pathname);

  useEffect(() => {
    document.documentElement.lang = locale ? locale.tag : 'en';
  }, [locale]);

  if (!locale) {
    return (
      <>
        {header}
        <main id="main">{children}</main>
        {footer}
      </>
    );
  }

  const t = CHROME[locale.code];
  return (
    <div lang={locale.tag} dir={locale.dir} className="intl">
      <header className="site-header">
        <div className="wrap header-row">
          <Link href={intlHome(locale)} className="brand" aria-label="G2M">
            <LogoLockup id="hdr" />
          </Link>
          <nav className="intl-nav" aria-label={t.ranking}>
            <Link href={intlHome(locale)}>{t.ranking}</Link>
            <Link href={intlGuides(locale)}>{t.guides}</Link>
            <Link href="/finder">{t.tools}</Link>
          </nav>
          <div className="header-actions">
            <LanguageMenu label={t.language} />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer">
        <div className="wrap stack" style={{ gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LogoMark size={32} id="ftr" />
            <span style={{ fontWeight: 800, letterSpacing: '-0.5px', fontSize: 18 }}>
              G2M <span className="faint" style={{ fontWeight: 500 }}>· Gwei 2 Merchant</span>
            </span>
          </div>
          <p className="faint" style={{ fontSize: 13, maxWidth: '90ch' }}>
            {t.disclaimer}
          </p>
        </div>
      </footer>
    </div>
  );
}
