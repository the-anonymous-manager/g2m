import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCards, lastUpdated } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { parseFilters } from '@/lib/table';
import { fill, intlRankings, languageLinks, localeByCode, hreflangOf, intlCard } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { formatters } from '@/lib/i18n/format';
import { UI } from '@/lib/i18n/ui';
import { absoluteUrl, metaDescription, metaTitle, shareMeta } from '@/lib/site';
import { RankingsTable } from '@/components/RankingsTable';
import { COUNTRIES } from '@/lib/regions';
import { Eyebrow } from '@/components/bits';

// The full rankings table in another language (/de/cards): the same table as /cards, with every word from that
// language's tool pack (lib/i18n/ui) and numbers from Intl. Filters live in the address, as in English.
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) return {};
  const d = DICTS[locale.code];
  return {
    title: metaTitle(d.rankTitle),
    description: metaDescription(d.rankDesc),
    alternates: { canonical: intlRankings(locale), languages: languageLinks('/cards', intlRankings) },
    ...shareMeta(d.rankTitle, d.rankDesc, intlRankings(locale))
  };
}

export default async function IntlRankingsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) notFound();
  const d = DICTS[locale.code];
  const f = formatters(locale, d);
  const sp = await searchParams;
  const initial = parseFilters(sp);
  const raw = sp.country ?? sp.market;
  const allCountries = String(Array.isArray(raw) ? raw[0] : (raw ?? '')).toLowerCase() === 'all';
  const cards = getCards();
  // The ranking as a list for search engines: every card in rank order, linked to its page in this language.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: d.rankTitle,
    inLanguage: hreflangOf(locale),
    itemListElement: cards.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(intlCard(locale, c.slug)), name: c.name }))
  };
  return (
    <div className="wrap wrap-wide section stack" style={{ gap: 28 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>{d.topEyebrow}</Eyebrow>
        <h1 className="h2">{d.rankTitle}</h1>
        <p className="lead">{fill(d.rankLead, { n: cards.length, date: f.date(lastUpdated()) })}</p>
      </div>
      <RankingsTable
        rows={cards.map(toRow)}
        initial={initial}
        hadMarketParam={Boolean(initial.country || initial.region) || allCountries}
        allCountries={allCountries}
        ui={UI[locale.code]}
        tag={locale.tag}
        prefix={`/${locale.code}`}
        countryNames={Object.fromEntries(COUNTRIES.map((c) => [c.code, f.country(c.code)]))}
      />
    </div>
  );
}
