import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getCardPage, guessCard } from '@/lib/cards';
import { cashbackLabel, fmtDate, pct, usd } from '@/lib/format';
import { metaDescription, metaTitle, shareMeta } from '@/lib/site';
import { intlCard, languageLinks } from '@/lib/i18n/locales';
import { CardReview } from '@/components/CardReview';

// Rendered fresh on every request rather than statically prerendered (ISR): this uses live token prices
// (lib/prices.ts), and a host with no incremental-cache storage configured can't serve a stale/revalidating build.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const card = getCardPage(slug);
  if (!card) return {};
  if (card.closed) {
    const closedTitle = `${card.name} has closed: what happens now and alternatives`;
    const closedDesc = `${card.brand} stopped the ${card.name} on ${fmtDate(card.closed)}. It no longer works and takes no new applications. What it offered, and the best cards to use instead.`;
    return {
      title: metaTitle(closedTitle),
      description: metaDescription(closedDesc),
      alternates: { canonical: `/cards/${card.slug}`, languages: languageLinks(`/cards/${card.slug}`, (l) => intlCard(l, card.slug)) },
      ...shareMeta(closedTitle, closedDesc, `/cards/${card.slug}`, null)
    };
  }
  const cb = cashbackLabel(card.cashback.basePct, card.cashback.maxPct);
  const title = `${card.name} Review ${new Date().getUTCFullYear()}: Fees, Cashback & Countries`;
  // Search results show about 155 characters: the facts first, then the summary only when it still fits whole.
  const fee = card.fees.annualUsd;
  const none = !card.cashback.basePct && !card.cashback.maxPct;
  const facts = `${card.name}: ${card.cashback.basePct == null && card.cashback.maxPct == null ? 'cashback not published' : none ? 'no cashback' : `${cb.toLowerCase()} cashback`}, ${
    fee == null ? 'annual fee not published' : fee === 0 ? 'no annual fee' : `${usd(fee)} a year`
  }, ${card.fees.fxPct == null ? 'FX fee not published' : card.fees.fxPct === 0 ? 'no FX fee' : `${pct(card.fees.fxPct)} FX fee`}. G2M score ${card.score.total}/100.`;
  const description = `${facts} ${card.summary}`.length <= 160 ? `${facts} ${card.summary}` : `${facts} Fees, tiers, countries and sources, checked ${fmtDate(card.lastChecked)}.`;
  return {
    title: metaTitle(title),
    description: metaDescription(description),
    alternates: { canonical: `/cards/${card.slug}`, languages: languageLinks(`/cards/${card.slug}`, (l) => intlCard(l, card.slug)) },
    ...shareMeta(`${card.name} · G2M score ${card.score.total}`, description, `/cards/${card.slug}`, null)
  };
}

export default async function CardPage({ params }: Props) {
  const { slug } = await params;
  const card = getCardPage(slug);
  if (!card) {
    // A cut-off or mistyped link (e.g. "ethena-pa=" from an email) goes to the one card it can mean.
    const guess = guessCard(slug);
    if (guess) permanentRedirect(`/cards/${guess.slug}`);
    notFound();
  }
  // The page itself is shared with the other languages (components/CardReview.tsx).
  return <CardReview card={card} />;
}
