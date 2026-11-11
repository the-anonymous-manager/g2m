import Link from 'next/link';
import type { Locale } from '@/lib/i18n/locales';
import { intlGuides, intlHome, intlRankings } from '@/lib/i18n/locales';
import { CHROME } from '@/lib/i18n/chrome';
import { LogoLockup, LogoMark } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageMenu } from '@/components/LanguageMenu';

/** Header of the translated pages: the ranking, guides and tools links, the language menu and the theme switch. */
export function IntlHeader({ locale }: { locale: Locale }) {
  const t = CHROME[locale.code];
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Link href={intlHome(locale)} className="brand" aria-label="G2M">
          <LogoLockup id="hdr" />
        </Link>
        <nav className="intl-nav" aria-label={t.ranking}>
          <Link href={intlRankings(locale)}>{t.ranking}</Link>
          <Link href={intlGuides(locale)}>{t.guides}</Link>
          <Link href="/finder" hrefLang="en">
            {t.tools}
          </Link>
        </nav>
        <div className="header-actions">
          <LanguageMenu label={t.language} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function IntlFooter({ locale }: { locale: Locale }) {
  const t = CHROME[locale.code];
  return (
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
  );
}
