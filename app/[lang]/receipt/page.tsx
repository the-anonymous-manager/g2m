import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCard, getCards } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { fiatPerUsd } from '@/lib/prices';
import { parseReceiptParams, receiptQuery } from '@/lib/receipt-params';
import { SwipeReceipt } from '@/components/SwipeReceipt';
import { Eyebrow } from '@/components/bits';
import { intlReceipt, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { noteOrNull } from '@/lib/i18n/notes';
import { UI } from '@/lib/i18n/ui';
import { metaDescription, metaTitle, shareMeta } from '@/lib/site';

// The swipe receipt in another language (/de/receipt): the same receipt as /receipt, every word from that language's
// pack (lib/i18n/ui/receipt), money from Intl, and "rewards paid in" from the sheet translated here. The picture to
// post or download (/receipt/image) stays in English: its font has no Arabic or Chinese letters.
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const WHAT = ['Coffee', 'Subscription', 'Dinner', 'Flight or hotel', 'Purchase'] as const;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) return {};
  const w = UI[locale.code].receipt;
  const p = parseReceiptParams(await searchParams);
  const card = p.card ? getCard(p.card) : null;
  const what = (WHAT as readonly string[]).includes(p.what) ? w[p.what as (typeof WHAT)[number]] : p.what;
  const title = card ? w.metaTitleCard.replace('{card}', card.name).replace('{what}', what) : w.metaTitle;
  const image = card ? `/receipt/image?${receiptQuery(p)}` : undefined;
  return {
    title: metaTitle(title),
    description: metaDescription(w.metaDesc),
    alternates: { canonical: intlReceipt(locale), languages: languageLinks('/receipt', intlReceipt) },
    ...shareMeta(title, w.metaDesc, intlReceipt(locale), image)
  };
}

export default async function IntlReceiptPage({ params, searchParams }: Props) {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) notFound();
  const ui = UI[locale.code];
  const w = ui.receipt;
  const p = parseReceiptParams(await searchParams);
  const cards = getCards();
  const rows = cards.map(toRow);
  const perUsd = await fiatPerUsd();
  const initial = p.card && rows.some((r) => r.slug === p.card) ? p : { ...p, card: rows[0]?.slug ?? null };
  // "Rewards paid in" from the sheet, translated where data/i18n has it.
  const sheet = Object.fromEntries(
    cards.flatMap((c) => {
      const t = c.cashback.payout ? noteOrNull(locale, c.cashback.payout) : null;
      return t && c.cashback.payout ? [[c.cashback.payout, t]] : [];
    })
  );
  return (
    <div className="wrap section stack" style={{ gap: 28 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>{w.eyebrow}</Eyebrow>
        <h1 className="h2">{w.title}</h1>
        <p className="lead">{w.lead}</p>
      </div>
      <div className="panel panel-pad">
        <SwipeReceipt cards={rows} initial={initial} perUsd={perUsd} syncUrl ui={ui} tag={locale.tag} prefix={`/${locale.code}`} sheet={sheet} />
      </div>
      <p className="faint" style={{ fontSize: 13, maxWidth: '90ch' }}>
        {w.foot}
      </p>
    </div>
  );
}
