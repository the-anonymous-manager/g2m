import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCards } from '@/lib/cards';
import { toRow, type CardRow } from '@/lib/types';
import { CompareClient } from '@/components/CompareClient';
import { Eyebrow } from '@/components/bits';
import { BackButton } from '@/components/BackButton';
import { PICK } from '@/lib/tierpick';
import { usdPrices } from '@/lib/prices';
import { allPairs, versusPath } from '@/lib/versus';
import { fill, intlCompare, intlRankings, intlVersus, languageLinks, localeByCode, type Locale } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { formatters } from '@/lib/i18n/format';
import { note } from '@/lib/i18n/notes';
import { UI } from '@/lib/i18n/ui';
import { COUNTRIES } from '@/lib/regions';
import { metaDescription, metaTitle, shareMeta } from '@/lib/site';

// The compare tool in another language (/de/compare): the same tool as /compare, with every word from that
// language's pack (lib/i18n/ui/compare), numbers from Intl, and the issuer notes the table shows (ATM, perks,
// requirements, bonus) translated here on the server from data/i18n.
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) return {};
  const w = UI[locale.code].compare;
  return {
    title: metaTitle(w.metaTitle),
    description: metaDescription(w.metaDesc),
    alternates: { canonical: intlCompare(locale), languages: languageLinks('/compare', intlCompare) },
    ...shareMeta(w.metaTitle, w.metaDesc, intlCompare(locale))
  };
}

/** A card with the sheet text the compare table shows in the page's language (English where no translation yet). */
function translated(l: Locale, c: CardRow): CardRow {
  const tx = (s: string) => note(l, s).text;
  const txOrNull = (s: string | null | undefined) => (s ? tx(s) : s);
  return {
    ...c,
    cashback: { ...c.cashback, payout: txOrNull(c.cashback.payout) ?? null },
    fees: { ...c.fees, atm: txOrNull(c.fees.atm) ?? null },
    coverage: { ...c.coverage, scope: tx(c.coverage.scope) },
    signupBonus: txOrNull(c.signupBonus) ?? c.signupBonus,
    // "yes" is a value the table reads, not text.
    noIdCheck: c.noIdCheck && c.noIdCheck.toLowerCase() !== 'yes' ? tx(c.noIdCheck) : c.noIdCheck,
    perks: c.perks.map(tx),
    tiers: c.tiers.map((t) => ({ ...t, requirement: txOrNull(t.requirement) ?? t.requirement, perks: t.perks.map(tx) }))
  };
}

export default async function IntlComparePage({ params, searchParams }: Props) {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) notFound();
  const ui = UI[locale.code];
  const w = ui.compare;
  const f = formatters(locale, DICTS[locale.code]);
  const sp = await searchParams;
  const raw = Array.isArray(sp.c) ? sp.c[0] : sp.c;
  // `c=kast,tria`, or one tier per card by its real name: `c=kast:premium,tria:pro,etherfi:luxe`.
  const initial = (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => PICK.test(s));
  const cards = getCards();
  const rows = cards.map((c) => translated(locale, toRow(c)));
  // Live USD value of staking tiers (cached an hour; empty when unavailable).
  const prices = await usdPrices(cards.flatMap((c) => c.tiers.flatMap((t) => (t.stake?.coingeckoId ? [t.stake.coingeckoId] : []))));
  return (
    <div className="wrap section stack" style={{ gap: 28 }}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="back-row">
          <BackButton fallback={intlRankings(locale)} label={ui.card.back} />
        </div>
        <Eyebrow>{w.eyebrow}</Eyebrow>
        <h1 className="h2">{w.title}</h1>
        <p className="lead">{w.lead}</p>
      </div>
      <CompareClient
        rows={rows}
        initial={initial}
        prices={prices}
        ui={ui}
        tag={locale.tag}
        prefix={`/${locale.code}`}
        countryNames={Object.fromEntries(COUNTRIES.map((c) => [c.code, f.country(c.code)]))}
      />
      <section className="stack" style={{ gap: 14 }} aria-labelledby="popular">
        <h2 id="popular" className="h3">
          {w.popular}
        </h2>
        <ul className="vs-links vs-links-cols">
          {allPairs(cards.slice(0, 7)).map(([a, b]) => (
            <li key={`${a.slug}-${b.slug}`}>
              <Link href={intlVersus(locale, versusPath(a.slug, b.slug).split('/').pop()!)}>{fill(ui.card.vs, { a: a.name, b: b.name })}</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
