import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCard } from '@/lib/cards';
import { fill, intlCard, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { clean, formatters } from '@/lib/i18n/format';
import { metaDescription, metaTitle, shareMeta } from '@/lib/site';
import { shortName } from '@/lib/versus';
import { CardReview } from '@/components/CardReview';

// A card's review in another language: the same page as the English review (components/CardReview.tsx), with words
// from the language's pack, numbers from Intl and the sheet's text from data/i18n. Rendered on each visit like the
// English page, for the live token prices in the staking check.
type Props = { params: Promise<{ lang: string; slug: string }> };

export const dynamic = 'force-dynamic';

function load(lang: string, slug: string) {
  const locale = localeByCode(lang);
  const card = getCard(slug);
  return locale && card ? { locale, card, d: DICTS[locale.code] } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  const x = load(lang, slug);
  if (!x) return {};
  const { locale, card, d } = x;
  const f = formatters(locale, d);
  const vars = {
    name: shortName(card.name),
    year: new Date().getUTCFullYear(),
    cb: f.cashbackS(card),
    fee: f.usdS(card.fees.annualUsd),
    fx: f.pctS(card.fees.fxPct),
    score: card.score.total
  };
  const title = fill(d.cardTitle, vars);
  // Direction marks help inside the page but not in a search result.
  const description = clean(fill(d.cardDesc, { ...vars, name: card.name }));
  const path = intlCard(locale, card.slug);
  return {
    title: metaTitle(title),
    description: metaDescription(description),
    alternates: { canonical: path, languages: languageLinks(`/cards/${card.slug}`, (l) => intlCard(l, card.slug)) },
    ...shareMeta(title, description, path, `/cards/${card.slug}/opengraph-image`)
  };
}

export default async function IntlCardPage({ params }: Props) {
  const { lang, slug } = await params;
  const x = load(lang, slug);
  if (!x) notFound();
  return <CardReview card={x.card} locale={x.locale} />;
}
