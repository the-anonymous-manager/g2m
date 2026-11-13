import type { Locale } from '@/lib/i18n/locales';
import {
  intlCalculator,
  intlCompare,
  intlCorridors,
  intlFinder,
  intlGuides,
  intlHome,
  intlMethodology,
  intlRankings,
  intlReceipt,
  intlSubmit,
  intlWallet
} from '@/lib/i18n/locales';
import { CHROME } from '@/lib/i18n/chrome';
import { lastUpdated } from '@/lib/cards';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

// The header and footer of translated pages: the English ones (components/Header.tsx, Footer.tsx) with the same links
// in the same order, in that language (lib/i18n/chrome.ts), so every language looks like the English site.

export function IntlHeader({ locale }: { locale: Locale }) {
  const t = CHROME[locale.code];
  return (
    <Header
      words={{
        home: intlHome(locale),
        homeLabel: 'G2M',
        language: t.language,
        nav: [
          { href: intlRankings(locale), label: t.ranking },
          { href: intlFinder(locale), label: t.finder },
          { href: intlCalculator(locale), label: t.calculator },
          { href: intlWallet(locale), label: t.wallet },
          { href: intlCompare(locale), label: t.compare },
          { href: intlMethodology(locale), label: t.methodology }
        ],
        cta: { href: intlFinder(locale), label: t.cta }
      }}
    />
  );
}

export function IntlFooter({ locale }: { locale: Locale }) {
  const t = CHROME[locale.code];
  const updated = lastUpdated();
  const date = new Intl.DateTimeFormat(locale.tag, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${updated}T00:00:00Z`));
  return (
    <Footer
      updated={updated}
      words={{
        about: t.about,
        label: 'G2M',
        links: [
          { href: `${intlRankings(locale)}?country=all`, label: t.allCards },
          { href: intlFinder(locale), label: t.finder },
          { href: intlCalculator(locale), label: t.calculator },
          { href: intlWallet(locale), label: t.wallet },
          { href: intlReceipt(locale), label: t.receipt },
          { href: intlCorridors(locale), label: t.corridors },
          { href: intlCompare(locale), label: t.compare },
          { href: intlGuides(locale), label: t.guides },
          { href: intlMethodology(locale), label: t.methodology },
          { href: intlSubmit(locale), label: t.submit }
        ],
        disclaimer: `${t.disclaimer}${locale.code === 'zh-hk' ? '' : ' '}${t.checked.replace('{date}', date)}`
      }}
    />
  );
}
