import type { CardRow, Tier } from '@/lib/types';
import { otherFxPct } from '@/lib/fx';
import { isSmallPurchase } from '@/lib/calc';

// One purchase on one card, line by line: what the shop charges, every fee the card adds, the cashback, and what the
// purchase really costs. Three currencies: the card's base (billing) currency, the currency the shop charges in, and
// the currency the receipt is shown in. Small-purchase limits are in US dollars.

/** `vars`: the facts in the label, so other languages can word it (the English label is built from the same facts). */
export type SwipeLine = {
  key: string;
  label: string;
  amount: number;
  kind: 'price' | 'fee' | 'reward';
  vars?: Record<string, string | number | boolean | null>;
};
/** A note as a fact (`k`) with its number, for other languages; `notes` has the English. */
export type SwipeNote = { k: 'billing' | 'noRate' | 'fxNP' | 'topUpNP' | 'freeSmall' | 'cbNP' | 'capTx' | 'capMonth'; n?: number };

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
  /** Price + FX in the receipt currency: what card apps show as the "cleared" amount. */
  cleared: number;
  /** The same in the card's base currency. */
  clearedBase: number;
  /** How the price was set: live mid-market rate, or matched to a real app (cleared amount, total, or rate). */
  mode: 'live' | 'cleared' | 'total' | 'rate';
  /** Shop currency per 1 unit of the base currency, as used (implied when matched to a real app). */
  impliedRate: number | null;
  notes: string[];
  noteParts: SwipeNote[];
};

/** Settings for one receipt. Amounts to match are in the card's base currency. */
export type SwipeOptions = {
  base?: string | null;
  display?: string | null;
  homeCurrency?: string | null;
  /** The app's "transaction cleared" amount: price + FX. */
  cleared?: number | null;
  /** The app's total charged: cleared amount + fixed fees. */
  total?: number | null;
  /** The exchange rate the app used: shop currency per 1 base currency, before the FX fee. */
  rate?: number | null;
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

/** Decimal places a currency is shown with (2 for most, 0 for JPY). */
function minorUnits(currency: string): number {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * One purchase, worked out in the card's base currency, then shown in the receipt currency. Every line is rounded to
 * the cent first and the totals are sums of the rounded lines, so the receipt always adds up.
 *
 * Without a match, the price comes from the live mid-market rate. With the app's cleared amount (price + FX), its
 * total charged, or its exchange rate, the price is worked back from it so the receipt matches the app to the cent.
 *
 * @param perUsd units of each currency per 1 US dollar (USD = 1)
 */
export function swipeReceipt(
  card: CardRow,
  tier: Tier,
  amount: number,
  currency: string,
  perUsd: Record<string, number>,
  opts: SwipeOptions = {}
): SwipeResult {
  const notes: string[] = [];
  const noteParts: SwipeNote[] = [];
  const note = (text: string, part: SwipeNote) => {
    notes.push(text);
    noteParts.push(part);
  };
  const bases = baseCurrencies(card, opts.homeCurrency);
  const base = opts.base && bases.list.includes(opts.base) ? opts.base : bases.list[0];
  if (!bases.known) note('Billing currency not published, so US dollars are assumed', { k: 'billing' });
  const rateOf = (c: string) => (c === 'USD' ? 1 : perUsd[c] ?? null);
  const display = opts.display && rateOf(opts.display) ? opts.display : currency;
  if (!rateOf(currency) || !rateOf(base)) note('No live exchange rate for one of these currencies, so amounts are not converted', { k: 'noRate' });
  const baseRate = rateOf(base) ?? 1; // base currency per US dollar

  // A purchase is foreign when the shop's currency is not the card's base currency.
  const foreign = currency !== base;
  // FX: none in the base currency (unless the issuer lists a fee for it); otherwise a lower listed rate for that
  // currency, else the card's usual FX fee.
  const by = card.fees.fxByCurrency ?? {};
  const other = otherFxPct(card, tier);
  const fxPct = !foreign ? (by[base] ?? 0) : by[currency] != null && by[currency] > 0 ? by[currency] : other;
  if (fxPct == null) note('FX fee not published, counted as 0', { k: 'fxNP' });
  const fxp = (fxPct ?? 0) / 100;
  const txp = card.fees.txPct / 100;
  const load = card.fees.topUpPct;
  if (load == null) note('Top-up fee not published, counted as 0', { k: 'topUpNP' });
  const lp = Math.min((load ?? 0) / 100, 0.5);
  const sp = card.fees.smallPurchase;
  const flatB = card.fees.txFlatUsd * baseRate;
  // The % fee's minimum per purchase (e.g. Oobit: 1%, at least $0.25), in the base currency.
  const minB = txp > 0 && card.fees.txMinUsd ? card.fees.txMinUsd * baseRate : 0;
  const txB = (priceB: number) => Math.max(priceB * txp, minB);
  const smallB = sp ? sp.feeUsd * baseRate : 0;
  const smallApplies = (priceB: number) => Boolean(sp && isSmallPurchase(sp, priceB / baseRate) && (!sp.foreignOnly || foreign));

  // The price in the base currency.
  let mode: SwipeResult['mode'] = 'live';
  let priceB: number;
  if (opts.cleared && opts.cleared > 0) {
    mode = 'cleared';
    priceB = opts.cleared / (1 + fxp);
  } else if (opts.total && opts.total > 0) {
    mode = 'total';
    // total = (price x (1 + FX) + per-purchase fee + flat + small fee) / (1 - top-up %), where the per-purchase fee
    // is price x % or the minimum fee, whichever is more. Try with and without the small fee, and both fee forms.
    const solve = (withSmall: boolean) => {
      const rest = opts.total! * (1 - lp) - flatB - (withSmall ? smallB : 0);
      const byPct = rest / (1 + fxp + txp);
      if (!minB || byPct * txp >= minB) return byPct;
      return (rest - minB) / (1 + fxp);
    };
    const a = solve(true);
    priceB = smallApplies(a) ? a : solve(false);
  } else if (opts.rate && opts.rate > 0) {
    mode = 'rate';
    priceB = amount / opts.rate;
  } else {
    const pay = rateOf(currency);
    priceB = pay ? (amount / pay) * baseRate : amount;
  }
  priceB = Math.max(priceB, 0);
  const impliedRate = mode === 'live' ? (rateOf(currency) && rateOf(base) ? rateOf(currency)! / baseRate : null) : priceB > 0 ? amount / priceB : null;

  // Base currency -> receipt currency. Shown in the shop's currency, the price is exactly what the shop charged.
  const perBase =
    display === base ? 1 : display === currency && impliedRate ? impliedRate : (rateOf(display) ?? baseRate) / baseRate;
  const d = minorUnits(display);
  const r = (x: number) => Math.round(x * 10 ** d) / 10 ** d;
  const inDisplay = (xB: number) => xB * perBase;

  const price = display === currency ? r(amount) : r(inDisplay(priceB));
  const clearedB = mode === 'cleared' ? opts.cleared! : priceB * (1 + fxp);
  const clearedRaw = mode === 'cleared' && display === base ? opts.cleared! : inDisplay(clearedB);
  let cleared = fxp > 0 ? Math.max(r(clearedRaw), price) : price;
  let fx = r(cleared - price);
  const tx = r(inDisplay(txB(priceB)));
  const atMin = minB > 0 && priceB * txp < minB;
  const flat = r(inDisplay(flatB));
  const small = smallApplies(priceB) ? r(inDisplay(smallB)) : 0;
  const before = cleared + tx + flat + small;
  let topUp = lp > 0 ? r((before * lp) / (1 - lp)) : 0;
  // Matched to a total charged in the receipt's own currency: put any rounding cent on the last fee so it adds up.
  if (mode === 'total' && display === base) {
    const gap = r(opts.total! - (before + topUp));
    if (gap && lp > 0) topUp = r(topUp + gap);
    else if (gap && fxp > 0) {
      fx = r(fx + gap);
      cleared = r(cleared + gap);
    }
  }

  const lines: SwipeLine[] = [
    {
      key: 'price',
      label: display === currency ? 'Merchant price' : `Merchant price (${fmtPlain(amount, currency)})`,
      amount: price,
      kind: 'price',
      vars: { asPaid: display === currency, amount, currency }
    }
  ];
  if (fx > 0) {
    lines.push({
      key: 'fx',
      label: foreign ? `FX fee (${fxPct}%, ${currency} on a ${base} card)` : `FX fee (${fxPct}% on ${base})`,
      amount: fx,
      kind: 'fee',
      vars: { pct: fxPct ?? 0, currency, base, foreign }
    });
  }
  if (tx > 0) {
    const min = card.fees.txMinUsd;
    lines.push({
      key: 'tx',
      label: `Per-purchase fee (${card.fees.txPct}%${min ? `, min ${usdText(min)}` : ''})`,
      amount: tx,
      kind: 'fee',
      vars: { pct: card.fees.txPct, ...(min ? { min, atMin } : {}) }
    });
  }
  if (flat > 0) lines.push({ key: 'flat', label: `Flat fee per purchase (${usdText(card.fees.txFlatUsd)})`, amount: flat, kind: 'fee', vars: { usd: card.fees.txFlatUsd } });
  if (small > 0 && sp) {
    lines.push({
      key: 'small',
      label: `Small-purchase fee (${usdText(sp.feeUsd)} ${sp.inclusive ? 'at or under' : 'under'} ${usdText(sp.underUsd)}${sp.foreignOnly ? ', foreign purchases' : ''})`,
      amount: small,
      kind: 'fee',
      vars: { fee: sp.feeUsd, under: sp.underUsd, inclusive: Boolean(sp.inclusive), foreignOnly: Boolean(sp.foreignOnly) }
    });
  }
  if (small > 0 && sp?.freePerMonth) note(`The first ${sp.freePerMonth} small purchases each month are free; this receipt assumes you have used them`, { k: 'freeSmall', n: sp.freePerMonth });
  if (topUp > 0) lines.push({ key: 'topup', label: `Top-up fee (${load}% of what you load)`, amount: topUp, kind: 'fee', vars: { pct: load } });
  const fees = r(lines.filter((l) => l.kind === 'fee').reduce((s, l) => s + l.amount, 0));

  // Cashback on the amount the card is charged (price + FX), like card apps.
  const ratePct = tierRate(tier);
  if (ratePct == null) note('Cashback rate not published', { k: 'cbNP' });
  // A per-purchase cap (e.g. Kolo: at most $1 a purchase), converted to the receipt currency.
  const maxTx = card.cashback.maxPerTxUsd;
  const capD = maxTx ? inDisplay(maxTx * baseRate) : Infinity;
  const uncapped = (cleared * (ratePct ?? 0)) / 100;
  const cashback = r(Math.min(uncapped, capD));
  const capped = uncapped > capD;
  lines.push({
    key: 'cashback',
    label: `Cashback (${ratePct ?? 0}%${capped ? `, capped at ${usdText(maxTx!)} a purchase` : ''}${card.cashback.payout ? ` in ${card.cashback.payout}` : ''})`,
    amount: cashback,
    kind: 'reward',
    vars: { pct: ratePct ?? 0, capUsd: capped ? maxTx! : null, payout: card.cashback.payout }
  });
  if (maxTx && !capped) note(`Cashback is capped at ${usdText(maxTx)} a purchase`, { k: 'capTx', n: maxTx });
  if (tier.capMonthlyUsd != null) note(`Cashback stops at $${tier.capMonthlyUsd} a month`, { k: 'capMonth', n: tier.capMonthlyUsd });

  const totalPaid = r(price + fees);
  const net = r(cashback - fees);
  return {
    currency,
    base,
    display,
    amount,
    usd: priceB / baseRate,
    lines,
    price,
    fees,
    cashback,
    totalPaid,
    net,
    netPct: price > 0 ? (net / price) * 100 : 0,
    headlinePct: card.cashback.maxPct ?? card.cashback.basePct,
    ratePct,
    foreign,
    cleared,
    clearedBase: Math.round(clearedB * 10 ** minorUnits(base)) / 10 ** minorUnits(base),
    mode,
    impliedRate,
    notes,
    noteParts
  };
}

/** $0.10, $25: cents shown only when there are any. */
const usdText = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

function fmtPlain(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}
