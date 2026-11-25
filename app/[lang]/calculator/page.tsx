import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCards } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { parseCalcInput } from '@/lib/calc';
import { COUNTRIES, isCountry } from '@/lib/regions';
import { usdPrices } from '@/lib/prices';
import { CalculatorClient } from '@/components/CalculatorClient';
import { Eyebrow } from '@/components/bits';
import { intlCalculator, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { formatters } from '@/lib/i18n/format';
import { noteOrNull } from '@/lib/i18n/notes';
import { UI } from '@/lib/i18n/ui';
import { metaDescription, metaTitle, shareMeta } from '@/lib/site';

// The rewards calculator in another language (/de/calculator): the same calculator as /calculator, with every word
// from that language's pack (lib/i18n/ui/calc), numbers from Intl, and the sheet text it shows (tier requirements,
// "paid in") passed down as an English → translation list. The cards themselves stay in English, because the
// calculator's maths reads some of that text (a requirement that starts with "$" is a price, not a condition).
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) return {};
  const w = UI[locale.code].calc;
  return {
    title: metaTitle(w.metaTitle),
    description: metaDescription(w.metaDesc),
    alternates: { canonical: intlCalculator(locale), languages: languageLinks('/calculator', intlCalculator) },
    ...shareMeta(w.metaTitle, w.metaDesc, intlCalculator(locale))
  };
}

export default async function IntlCalculatorPage({ params, searchParams }: Props) {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) notFound();
  const ui = UI[locale.code];
  const w = ui.calc;
  const f = formatters(locale, DICTS[locale.code]);
  const p = await searchParams;
  // Every setting lives in the link (mode, spend, currency split, purchase sizes, valuation, card, year, tier...).
  const keys = ['mode', 'spend', 'usd', 'travel', 'foreign', 'mix', 'ticket', 'value', 'form', 'year', 'tiers', 'all', 'hold', 'card', 'cards', 'tier'];
  const initial = parseCalcInput(Object.fromEntries(keys.map((k) => [k, one(p[k])])));
  // `country=JP`; older links used `market=IN`.
  const raw = (one(p.country) ?? one(p.market) ?? '').toUpperCase();
  const country = isCountry(raw) ? raw : '';
  const cards = getCards();
  const rows = cards.map(toRow);
  // The sheet text the calculator shows, translated where data/i18n has it.
  const texts = new Set(cards.flatMap((c) => [c.cashback.payout, ...c.tiers.map((t) => t.requirement)].filter((s): s is string => Boolean(s))));
  const sheet = Object.fromEntries([...texts].flatMap((s) => {
    const t = noteOrNull(locale, s);
    return t ? [[s, t]] : [];
  }));
  // Live USD value of staking tiers (one shared CoinGecko request, cached an hour; empty when unavailable).
  const prices = await usdPrices(cards.flatMap((c) => c.tiers.flatMap((t) => (t.stake?.coingeckoId ? [t.stake.coingeckoId] : []))));
  return (
    <div className="wrap section stack" style={{ gap: 28 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>{w.eyebrow}</Eyebrow>
        <h1 className="h2">{w.title}</h1>
        <p className="lead">{w.lead}</p>
      </div>
      <CalculatorClient
        rows={rows}
        initial={initial}
        initialCountry={country}
        hadCountry={Boolean(country)}
        prices={prices}
        ui={ui}
        tag={locale.tag}
        prefix={`/${locale.code}`}
        countryNames={Object.fromEntries(COUNTRIES.map((c) => [c.code, f.country(c.code)]))}
        sheet={sheet}
      />
    </div>
  );
}
