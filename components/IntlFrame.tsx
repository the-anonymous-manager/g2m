import Link from 'next/link';
import type { Locale } from '@/lib/i18n/locales';
import { intlCalculator, intlCompare, intlCorridors, intlFinder, intlGuides, intlHome, intlRankings, intlReceipt, intlWallet } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { ToolsMenu } from '@/components/ToolsMenu';
import { CHROME } from '@/lib/i18n/chrome';
import { LogoLockup, LogoMark } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageMenu } from '@/components/LanguageMenu';

/** Header of the translated pages: the ranking and guides links, the tools menu, the language menu and the theme switch. */
export function IntlHeader({ locale }: { locale: Locale }) {
  const t = CHROME[locale.code];
  const d = DICTS[locale.code];
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Link href={intlHome(locale)} className="brand" aria-label="G2M">
          <LogoLockup id="hdr" />
        </Link>
        <nav className="intl-nav" aria-label={t.ranking}>
          <Link href={intlRankings(locale)}>{t.ranking}</Link>
          <Link href={intlGuides(locale)}>{t.guides}</Link>
          <ToolsMenu
            label={t.tools}
            items={[
              { href: intlFinder(locale), name: d.toolFinder },
              { href: intlCalculator(locale), name: d.toolCalc },
              { href: intlWallet(locale), name: d.toolWallet },
              { href: intlCompare(locale), name: d.toolCompare },
              { href: intlReceipt(locale), name: d.toolReceipt },
              { href: intlCorridors(locale), name: d.toolCorridor }
            ]}
          />
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
