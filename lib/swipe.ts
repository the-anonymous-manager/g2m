import type { CardRow, Tier } from '@/lib/types';
import { billedIn, fxIn } from '@/lib/fx';

// One purchase on one card, line by line: what the shop charges, every fee the card adds, the cashback, and what the
// purchase really costs. Amounts are in the purchase currency; small-purchase limits are in US dollars.

export type SwipeLine = { key: string; label: string; amount: number; kind: 'price' | 'fee' | 'reward' };

export type SwipeResult = {
  currency: string;
  amount: number;
  /** The purchase in US dollars. */
  usd: number;
  lines: SwipeLine[];
  fees: number;
  cashback: number;
  /** What leaves your balance: price plus fees. */
  totalPaid: number;
  /** Cashback minus fees (negative = the purchase cost you extra). */
  net: number;
  /** Net as a % of the price. */
  netPct: number;
  /** The headline "up to" rate the card advertises. */
  headlinePct: number | null;
  ratePct: number | null;
  foreign: boolean;
  notes: string[];
};

const tierRate = (t: Tier) => t.cashbackPct ?? t.bands?.[0]?.pct ?? null;

/**
 * @param perUsd units of each currency per 1 US dollar (USD = 1)
 * @param homeCurrency the visitor's own currency, for cards billed in it
 */
export function swipeReceipt(
  card: CardRow,
  tier: Tier,
  amount: number,
  currency: string,
  perUsd: Record<string, number>,
  homeCurrency?: string | null
): SwipeResult {
  const notes: string[] = [];
  const rate = currency === 'USD' ? 1 : perUsd[currency] ?? null;
  const toLocal = (usd: number) => usd * (rate ?? 1);
  const usd = rate ? amount / rate : amount;
  const lines: SwipeLine[] = [{ key: 'price', label: 'Merchant price', amount, kind: 'price' }];

  const tx = (amount * card.fees.txPct) / 100;
  if (tx > 0) lines.push({ key: 'tx', label: `Per-purchase fee (${card.fees.txPct}%)`, amount: tx, kind: 'fee' });
  const flat = toLocal(card.fees.txFlatUsd);
  if (flat > 0) lines.push({ key: 'flat', label: `Flat fee per purchase ($${card.fees.txFlatUsd})`, amount: flat, kind: 'fee' });

  const foreign = !billedIn(card, currency, homeCurrency);
  const sp = card.fees.smallPurchase;
  if (sp && usd < sp.underUsd && (!sp.foreignOnly || foreign)) {
    lines.push({
      key: 'small',
      label: `Small-purchase fee ($${sp.feeUsd} under $${sp.underUsd}${sp.foreignOnly ? ', non-base currency' : ''})`,
      amount: toLocal(sp.feeUsd),
      kind: 'fee'
    });
  }

  const fxPct = fxIn(card, tier, currency, homeCurrency);
  if (fxPct == null) notes.push('FX fee not published, counted as 0');
  if (fxPct) lines.push({ key: 'fx', label: `FX fee (${fxPct}%, ${currency} is not a base currency)`, amount: (amount * fxPct) / 100, kind: 'fee' });

  const before = lines.filter((l) => l.kind === 'fee').reduce((s, l) => s + l.amount, 0);
  const load = card.fees.topUpPct;
  if (load == null) notes.push('Top-up fee not published, counted as 0');
  if (load) {
    const p = Math.min(load / 100, 0.5);
    lines.push({ key: 'topup', label: `Top-up fee (${load}% of what you load)`, amount: ((amount + before) * p) / (1 - p), kind: 'fee' });
  }
  const fees = lines.filter((l) => l.kind === 'fee').reduce((s, l) => s + l.amount, 0);

  const ratePct = tierRate(tier);
  if (ratePct == null) notes.push('Cashback rate not published');
  const cashback = (amount * (ratePct ?? 0)) / 100;
  lines.push({ key: 'cashback', label: `Cashback (${ratePct ?? 0}%${card.cashback.payout ? ` in ${card.cashback.payout}` : ''})`, amount: cashback, kind: 'reward' });
  if (tier.capMonthlyUsd != null) notes.push(`Cashback stops at $${tier.capMonthlyUsd} a month`);
  if (!rate) notes.push(`No live ${currency} rate, so the US dollar limits use the amount as dollars`);

  const net = cashback - fees;
  return {
    currency,
    amount,
    usd,
    lines,
    fees,
    cashback,
    totalPaid: amount + fees,
    net,
    netPct: amount > 0 ? (net / amount) * 100 : 0,
    headlinePct: card.cashback.maxPct ?? card.cashback.basePct,
    ratePct,
    foreign,
    notes
  };
}
