'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LOCALES, intlHome, localeOfPath, type Locale } from '@/lib/i18n/locales';
import { CHROME } from '@/lib/i18n/chrome';
import { LogoLockup, LogoMark } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

/** The same page in another language: translated pages share their address after the language prefix. */
const swap = (pathname: string, from: Locale, to: Locale) => `/${to.code}${pathname.slice(from.code.length + 1)}`;

/** The English page a translated address stands for. */
function englishOf(pathname: string, from: Locale) {
  const rest = pathname.slice(from.code.length + 1) || '/';
  return rest.startsWith('/best-crypto-cards/') ? `/guides${rest}` : rest;
}

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
            <Link href="/finder">{t.tools}</Link>
            <Link href={englishOf(pathname, locale)} lang="en" hrefLang="en">
              {t.english}
            </Link>
          </nav>
          <div className="header-actions">
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
          <nav aria-label={t.languages} className="footer-links lang-links">
            <span className="faint">{t.languages}:</span>
            <Link href={englishOf(pathname, locale)} lang="en" hrefLang="en">
              English
            </Link>
            {LOCALES.map((l) => (
              <Link key={l.code} href={swap(pathname, locale, l)} lang={l.tag} hrefLang={l.tag} aria-current={l.code === locale.code ? 'true' : undefined}>
                {l.name}
              </Link>
            ))}
          </nav>
          <p className="faint" style={{ fontSize: 13, maxWidth: '90ch' }}>
            {t.disclaimer}
          </p>
        </div>
      </footer>
    </div>
  );
}
