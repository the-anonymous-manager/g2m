import type { Metadata } from 'next';
import { metaDescription, metaTitle, shareMeta } from '@/lib/site';
import { getCard, getCards } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { fiatPerUsd } from '@/lib/prices';
import { parseReceiptParams, receiptQuery } from '@/lib/receipt-params';
import { SwipeReceipt } from '@/components/SwipeReceipt';
import { Eyebrow } from '@/components/bits';
import { intlReceipt, languageLinks } from '@/lib/i18n/locales';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// A shared receipt link previews as the receipt picture on X and elsewhere.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const p = parseReceiptParams(await searchParams);
  const card = p.card ? getCard(p.card) : null;
  const title = card ? `${card.name}: the real cost of a ${p.what.toLowerCase()}` : 'Real swipe receipt';
  const description = 'What one purchase really costs on a crypto card: every fee, the cashback, and the real result.';
  const image = card ? `/receipt/image?${receiptQuery(p)}` : undefined;
  return {
    title: metaTitle(title),
    description: metaDescription(description),
    alternates: { canonical: '/receipt', languages: languageLinks('/receipt', intlReceipt) },
    ...shareMeta(title, description, '/receipt', image)
  };
}

export default async function ReceiptPage({ searchParams }: Props) {
  const p = parseReceiptParams(await searchParams);
  const rows = getCards().map(toRow);
  const perUsd = await fiatPerUsd();
  const initial = p.card && rows.some((r) => r.slug === p.card) ? p : { ...p, card: rows[0]?.slug ?? null };
  return (
    <div className="wrap section stack" style={{ gap: 28 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>one purchase</Eyebrow>
        <h1 className="h2">Real swipe receipt</h1>
        <p className="lead">
          A card says &ldquo;up to 4% back&rdquo;. Here is what one purchase really costs: every fee it adds, the cashback, and the
          result. Pick a card, a purchase and a currency, then post the receipt picture on X.
        </p>
      </div>
      <div className="panel panel-pad">
        <SwipeReceipt cards={rows} initial={initial} perUsd={perUsd} syncUrl />
      </div>
      <p className="faint" style={{ fontSize: 13, maxWidth: '90ch' }}>
        Fees come from each card&apos;s published fee list: per-purchase and flat fees, small-purchase fees (limits in US dollars),
        the FX fee when the card does not bill in your currency, and the top-up fee on what you load. Cashback is the tier&apos;s
        ongoing rate; monthly caps are noted. Exchange rates are live and refreshed every hour.
      </p>
    </div>
  );
}
