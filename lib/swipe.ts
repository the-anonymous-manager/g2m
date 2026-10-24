import type { CardRow, Tier } from '@/lib/types';
import { otherFxPct } from '@/lib/fx';

// One purchase on one card, line by line: what the shop charges, every fee the card adds, the cashback, and what the
// purchase really costs. Three currencies: the card's base (billing) currency, the currency the shop charges in, and
// the currency the receipt is shown in. Small-purchase limits are in US dollars.

export type SwipeLine = { key: string; label: string; amount: number; kind: 'price' | 'fee' | 'reward' };

export type SwipeResult = {
  /** The currency the shop charged in. */
  currency: string;
  /** The card's base currency for this receipt. */
  base: string;
  /** The currency the amounts below are shown in. */
  display: string;
  /** The price in the shop's currency. */
  amount: number;
  /** The purchase in US dollars. */
  usd: number;
  /** All amounts below are in `display`. */
  lines: SwipeLine[];
  price: number;
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
 * The currencies a card bills in, for the "card's base currency" picker: currencies with no FX fee, the holder's own
 * currency on cards billed in it, otherwise the currencies with the lowest listed fee. `known` is false when the
 * issuer does not say (US dollars are assumed).
 */
export function baseCurrencies(card: Pick<CardRow, 'fees'>, homeCurrency?: string | null): { list: string[]; known: boolean } {
  const by = card.fees.fxByCurrency ?? {};
  const list: string[] = [];
  if (card.fees.fxHome && homeCurrency) list.push(homeCurrency);
  const zero = Object.keys(by).filter((c) => by[c] === 0);
  const lowest = Object.keys(by).filter((c) => by[c] === Math.min(...Object.values(by)));
  for (const c of zero.length ? zero : lowest) if (!list.includes(c)) list.push(c);
  if (!list.length) return { list: ['USD'], known: false };
  // US dollars first when the card has them, as most crypto cards settle in dollars.
  return { list: list.includes('USD') ? ['USD', ...list.filter((c) => c !== 'USD')] : list, known: true };
}

/**
 * @param perUsd units of each currency per 1 US dollar (USD = 1)
 * @param opts.base the card's base currency (one of `baseCurrencies`); defaults to the first
 * @param opts.display the currency to show the receipt in; defaults to the shop's currency
 */
export function swipeReceipt(
  card: CardRow,
  tier: Tier,
  amount: number,
  currency: string,
  perUsd: Record<string, number>,
  opts: { base?: string | null; display?: string | null; homeCurrency?: string | null } = {}
): SwipeResult {
  const notes: string[] = [];
  const bases = baseCurrencies(card, opts.homeCurrency);
  const base = opts.base && bases.list.includes(opts.base) ? opts.base : bases.list[0];
  if (!bases.known) notes.push('Billing currency not published, so US dollars are assumed');
  const rateOf = (c: string) => (c === 'USD' ? 1 : perUsd[c] ?? null);
  const payRate = rateOf(currency);
  const display = opts.display && rateOf(opts.display) ? opts.display : currency;
  const showRate = rateOf(display);
  const usd = payRate ? amount / payRate : amount;
  // Shop currency -> display currency, and US dollars -> display currency.
  const show = (inPay: number) => (payRate && showRate ? (inPay / payRate) * showRate : inPay);
  const showUsd = (x: number) => x * (showRate ?? 1);

  const price = show(amount);
  const lines: SwipeLine[] = [
    { key: 'price', label: display === currency ? 'Merchant price' : `Merchant price (${fmtPlain(amount, currency)})`, amount: price, kind: 'price' }
  ];

  const tx = (price * card.fees.txPct) / 100;
  if (tx > 0) lines.push({ key: 'tx', label: `Per-purchase fee (${card.fees.txPct}%)`, amount: tx, kind: 'fee' });
  if (card.fees.txFlatUsd > 0) {
    lines.push({ key: 'flat', label: `Flat fee per purchase ($${card.fees.txFlatUsd})`, amount: showUsd(card.fees.txFlatUsd), kind: 'fee' });
  }

  // A purchase is foreign when the shop's currency is not the card's base currency.
  const foreign = currency !== base;
  const sp = card.fees.smallPurchase;
  if (sp && usd < sp.underUsd && (!sp.foreignOnly || foreign)) {
    lines.push({
      key: 'small',
      label: `Small-purchase fee ($${sp.feeUsd} under $${sp.underUsd}${sp.foreignOnly ? ', foreign purchases' : ''})`,
      amount: showUsd(sp.feeUsd),
      kind: 'fee'
    });
  }

  // FX: none in the base currency (unless the issuer lists a fee for it); otherwise a lower listed rate for that
  // currency, else the card's usual FX fee.
  const by = card.fees.fxByCurrency ?? {};
  const other = otherFxPct(card, tier);
  const fxPct = !foreign ? (by[base] ?? 0) : by[currency] != null && by[currency] > 0 ? by[currency] : other;
  if (fxPct == null) notes.push('FX fee not published, counted as 0');
  if (fxPct) {
    lines.push({
      key: 'fx',
      label: foreign ? `FX fee (${fxPct}%, ${currency} on a ${base} card)` : `FX fee (${fxPct}% on ${base})`,
      amount: (price * fxPct) / 100,
      kind: 'fee'
    });
  }

  const before = lines.filter((l) => l.kind === 'fee').reduce((s, l) => s + l.amount, 0);
  const load = card.fees.topUpPct;
  if (load == null) notes.push('Top-up fee not published, counted as 0');
  if (load) {
    const p = Math.min(load / 100, 0.5);
    lines.push({ key: 'topup', label: `Top-up fee (${load}% of what you load)`, amount: ((price + before) * p) / (1 - p), kind: 'fee' });
  }
  const fees = lines.filter((l) => l.kind === 'fee').reduce((s, l) => s + l.amount, 0);

  const ratePct = tierRate(tier);
  if (ratePct == null) notes.push('Cashback rate not published');
  const cashback = (price * (ratePct ?? 0)) / 100;
  lines.push({ key: 'cashback', label: `Cashback (${ratePct ?? 0}%${card.cashback.payout ? ` in ${card.cashback.payout}` : ''})`, amount: cashback, kind: 'reward' });
  if (tier.capMonthlyUsd != null) notes.push(`Cashback stops at $${tier.capMonthlyUsd} a month`);
  if (!payRate || !showRate) notes.push('No live exchange rate for one of these currencies, so amounts are not converted');

  const net = cashback - fees;
  return {
    currency,
    base,
    display,
    amount,
    usd,
    lines,
    price,
    fees,
    cashback,
    totalPaid: price + fees,
    net,
    netPct: price > 0 ? (net / price) * 100 : 0,
    headlinePct: card.cashback.maxPct ?? card.cashback.basePct,
    ratePct,
    foreign,
    notes
  };
}

function fmtPlain(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}
