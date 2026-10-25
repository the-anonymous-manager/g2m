import { z } from 'zod';
import type { CardRow, Tier } from '@/lib/types';
import { tierOffered } from '@/lib/regions';
import { billedIn, fxIn, homeFx, otherFxPct } from '@/lib/fx';
import { currencyOf } from '@/lib/currencies.mjs';
import { BASKET, BASKET_USD } from '@/lib/basket';

// Calculator inputs are validated and clamped, so bad URL params or typed values
// can never break the page: anything invalid falls back to a sensible default.
export const CALC_MODES = ['best', 'tiers', 'audit'] as const;
export type CalcMode = (typeof CALC_MODES)[number];

const flag = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === '1' || v === 'true')
  .catch(false);

export const CalcInputSchema = z.object({
  mode: z.enum(CALC_MODES).catch('best'),
  spend: z.coerce.number().finite().min(0).max(1_000_000).catch(1000),
  // Share of spending in US dollars (online shops, subscriptions) and in other currencies (travel), in %.
  // The rest is spent in the visitor's own currency.
  usd: z.coerce.number().finite().min(0).max(100).catch(10),
  travel: z.coerce.number().finite().min(0).max(100).catch(10),
  // Purchase sizes: the balanced $10 to $200 mix, or one size for every purchase.
  mix: z.enum(['balanced', 'custom']).catch('balanced'),
  ticket: z.coerce.number().finite().min(1).max(10_000).catch(40),
  // How rewards are valued: face value, a conservative haircut on tokens and points, or cash and stablecoins only.
  value: z.enum(['face', 'conservative', 'cash']).catch('face'),
  form: z.enum(['virtual', 'physical']).catch('virtual'),
  // Year 1 adds one-off card fees and welcome offers; year 2 onwards is the ongoing cost.
  year: z.coerce.number().int().min(1).max(2).catch(2),
  // Leaderboard: the best tier for this spend, or only the entry and free tiers.
  tiers: z.enum(['best', 'entry']).catch('best'),
  all: flag,
  card: z.string().regex(/^[a-z0-9-]{1,60}$/).nullable().catch(null),
  tier: z.coerce.number().int().min(0).max(50).catch(0)
});

export type CalcInput = z.infer<typeof CalcInputSchema>;
export const DEFAULT_INPUT: CalcInput = {
  mode: 'best',
  spend: 1000,
  usd: 10,
  travel: 10,
  mix: 'balanced',
  ticket: 40,
  value: 'face',
  form: 'virtual',
  year: 2,
  tiers: 'best',
  all: false,
  card: null,
  tier: 0
};

/**
 * Parse URL params or form values. Older links used `foreign` (the share spent in other currencies) and `ticket`
 * on its own: they still work, as travel spending and a custom purchase size.
 */
export function parseCalcInput(raw: Record<string, unknown>): CalcInput {
  const given = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined && v !== ''));
  if ('foreign' in given && !('usd' in given) && !('travel' in given)) {
    given.travel = given.foreign;
    given.usd = 0;
  }
  if ('ticket' in given && !('mix' in given)) given.mix = 'custom';
  const input = CalcInputSchema.parse({ ...DEFAULT_INPUT, ...given });
  // The two shares cannot add up to more than all spending.
  if (input.usd + input.travel > 100) input.travel = 100 - input.usd;
  return input;
}

/** The URL params for these inputs, leaving out defaults so shared links stay short. */
export function calcParams(input: CalcInput, country: string): URLSearchParams {
  const p = new URLSearchParams();
  if (input.mode !== 'best') p.set('mode', input.mode);
  if (country) p.set('country', country);
  p.set('spend', String(input.spend));
  if (input.usd !== DEFAULT_INPUT.usd) p.set('usd', String(input.usd));
  if (input.travel !== DEFAULT_INPUT.travel) p.set('travel', String(input.travel));
  p.set('mix', input.mix);
  if (input.mix === 'custom') p.set('ticket', String(input.ticket));
  if (input.value !== 'face') p.set('value', input.value);
  if (input.form !== 'virtual') p.set('form', input.form);
  if (input.year !== 2) p.set('year', String(input.year));
  if (input.mode === 'best' && input.tiers !== 'best') p.set('tiers', input.tiers);
  if (input.mode === 'best' && input.all) p.set('all', '1');
  if (input.mode !== 'best' && input.card) p.set('card', input.card);
  if (input.mode === 'audit') p.set('tier', String(input.tier));
  return p;
}

// ---------- Cashback ----------

export type BandLine = { from: number; to: number | null; pct: number; amount: number };

/**
 * Monthly cashback for one tier at a given monthly spend, before and after the monthly cap, with the amount earned
 * in each spending band. `gross` is null when there is no published rate.
 */
export function cashbackBreakdown(tier: Tier, spend: number): { gross: number | null; capped: number | null; bands: BandLine[] } {
  const bands: BandLine[] = [];
  let gross: number | null = null;
  if (tier.bands && tier.bands.length) {
    let remaining = spend;
    let floor = 0;
    gross = 0;
    for (const band of tier.bands) {
      const ceiling = band.uptoUsd ?? Infinity;
      const portion = Math.max(0, Math.min(remaining, ceiling - floor));
      const amount = (portion * band.pct) / 100;
      bands.push({ from: floor, to: band.uptoUsd ?? null, pct: band.pct, amount });
      gross += amount;
      remaining -= portion;
      floor = ceiling;
      if (remaining <= 0) break;
    }
  } else if (tier.cashbackPct != null) {
    gross = (spend * tier.cashbackPct) / 100;
    bands.push({ from: 0, to: null, pct: tier.cashbackPct, amount: gross });
  }
  const capped = gross != null && tier.capMonthlyUsd != null ? Math.min(gross, tier.capMonthlyUsd) : gross;
  return { gross, capped, bands };
}

/** Monthly cashback in USD for one tier at a given monthly spend, after the monthly cap. null = no published rate. */
export function monthlyCashback(tier: Tier, spend: number): number | null {
  return cashbackBreakdown(tier, spend).capped;
}

type SmallFee = NonNullable<CardRow['fees']['smallPurchase']>;

/** Whether a purchase of `size` USD pays the small-purchase fee: under the limit, or at or under it when inclusive. */
export const isSmallPurchase = (sp: Pick<SmallFee, 'underUsd' | 'inclusive'>, size: number) =>
  sp.inclusive ? size <= sp.underUsd : size < sp.underUsd;

/** Cashback one purchase of `size` USD loses to a per-purchase cap (e.g. Kolo: at most $1 a purchase). */
export function perPurchaseCut(tier: Tier, maxPerTxUsd: number | null | undefined, size: number): number {
  if (!maxPerTxUsd) return 0;
  const pct = tier.cashbackPct ?? tier.bands?.[0]?.pct ?? null;
  return pct == null ? 0 : Math.max(0, (size * pct) / 100 - maxPerTxUsd);
}

export type PayoutKind = 'cash' | 'major' | 'token' | 'points' | 'unknown';

/** What rewards are paid in, from the card's "Cashback paid in" text (e.g. "USDC", "BTC, daily", "CRO", "Points"). */
export function payoutKind(payout: string | null | undefined): PayoutKind {
  const p = (payout ?? '').trim();
  if (!p) return 'unknown';
  if (/^(USD|USDC|USDT|EUR|stablecoin|cash)/i.test(p)) return 'cash';
  if (/\b(BTC|ETH|bitcoin|ether)\b/i.test(p)) return 'major';
  if (/points?/i.test(p)) return 'points';
  return 'token';
}

/** The share of face value a reward counts for under each valuation. */
export function payoutFactor(kind: PayoutKind, value: CalcInput['value']): number {
  if (value === 'face') return 1;
  if (value === 'cash') return kind === 'cash' ? 1 : 0;
  return { cash: 1, major: 1, token: 0.75, points: 0.5, unknown: 0.75 }[kind];
}

// ---------- Purchases ----------

/** Purchases a year, and how many of them are below a size limit (for small-purchase fees). */
export function purchasesPerYear(input: Pick<CalcInput, 'spend' | 'mix' | 'ticket'>, under?: number): number {
  const yearSpend = input.spend * 12;
  if (yearSpend <= 0) return 0;
  if (input.mix === 'custom') return under == null || input.ticket < under ? yearSpend / input.ticket : 0;
  // Balanced mix: the same share of spending in each purchase size as the $1,000 test basket (20% each).
  return BASKET.filter((b) => under == null || b.usd < under).reduce((s, b) => s + (yearSpend * ((b.usd * b.count) / BASKET_USD)) / b.usd, 0);
}

/** One slice of a year's spending: which currency group, the purchase size, and how much (USD a year). */
export type Segment = { part: 'home' | 'usd' | 'travel'; size: number; spendYear: number };

/** The year's spending as slices: own currency / US dollars online / travel, times the purchase sizes. */
export function buildSegments(input: Pick<CalcInput, 'spend' | 'usd' | 'travel' | 'mix' | 'ticket'>): Segment[] {
  const yearSpend = input.spend * 12;
  const usd = input.usd / 100;
  const travel = input.travel / 100;
  const shares = { home: Math.max(0, 1 - usd - travel), usd, travel };
  const sizes =
    input.mix === 'custom'
      ? [{ size: input.ticket, share: 1 }]
      : BASKET.map((b) => ({ size: b.usd, share: (b.usd * b.count) / BASKET_USD }));
  return (['home', 'usd', 'travel'] as const).flatMap((part) =>
    sizes.map((z) => ({ part, size: z.size, spendYear: yearSpend * shares[part] * z.share }))
  );
}

// ---------- One tier's year ----------

export type SpendPart = {
  key: 'home' | 'usd' | 'travel';
  /** Share of spending, 0 to 1. */
  share: number;
  currency: string | null;
  /** FX % this card charges on it. null = not published. */
  fxPct: number | null;
  /** True when the card does not bill in this currency, so foreign-only fees apply. */
  foreign: boolean;
  /** FX cost in USD a year. */
  fx: number;
};

export type TierResult = {
  tier: Tier;
  index: number;
  offered: boolean;
  /** Cashback earned on ongoing rates, before the cap. */
  gross: number;
  /** Lost to the monthly cap. */
  capCut: number;
  /** Lost to a per-purchase cap (e.g. at most $1 a purchase). */
  txCapCut: number;
  /** Extra from a welcome offer (year 1 only). */
  intro: number;
  /** Taken off for rewards paid in tokens or points (valuation setting). */
  valueCut: number;
  /** Rewards counted: gross - capCut + intro - valueCut. */
  cashback: number;
  bands: BandLine[];
  fee: number;
  /** One-off card or shipping fee (year 1 only). */
  oneTime: number;
  parts: SpendPart[];
  fx: number;
  txPct: number;
  txFlat: number;
  small: number;
  smallCount: number;
  topUp: number;
  /** Per-purchase, small-purchase and top-up fees together. */
  tx: number;
  net: number;
  /** Net as a % of yearly spend. */
  yieldPct: number;
  purchases: number;
  flags: string[];
};

/**
 * One tier's year for this spending profile. With `country`, spending at home is in that country's currency and pays
 * the card's FX fee unless the card bills in it; US-dollar spending is free of FX only on cards billed in dollars;
 * other currencies always pay the card's usual FX fee. Foreign-only fees follow the same rule.
 */
export function tierValue(
  card: CardRow,
  tier: Tier,
  input: CalcInput,
  index = 0,
  country?: string | null,
  /** Only these slices of spending go on this card (e.g. one card of a two-card wallet). Default: all of it. */
  only?: Segment[]
): TierResult {
  const flags: string[] = [];
  const segs = only ?? buildSegments(input);
  const yearSpend = segs.reduce((s, g) => s + g.spendYear, 0);
  const monthSpend = yearSpend / 12;
  const offered = !country || tierOffered(tier, country);

  // Rewards
  const month = cashbackBreakdown(tier, monthSpend);
  if (month.gross == null) flags.push('Cashback rate not published');
  const gross = (month.gross ?? 0) * 12;
  // A per-purchase cap first (on each purchase size), then the monthly cap on what is left.
  const maxPerTx = card.cashback.maxPerTxUsd;
  const txCapCut = segs.reduce((s, g) => s + (g.size > 0 ? (g.spendYear / g.size) * perPurchaseCut(tier, maxPerTx, g.size) : 0), 0);
  const afterTx = Math.max(0, (month.gross ?? 0) - txCapCut / 12);
  const cappedMonth = month.gross == null ? 0 : tier.capMonthlyUsd != null ? Math.min(afterTx, tier.capMonthlyUsd) : afterTx;
  const capCut = (afterTx - cappedMonth) * 12;
  let intro = 0;
  const welcome = card.cashback.intro;
  if (input.year === 1 && welcome && index === 0) {
    const months = Math.min((welcome.days / 365) * 12, 12);
    const introMonth = Math.min((monthSpend * welcome.pct) / 100, tier.capMonthlyUsd ?? Infinity);
    intro = Math.max(0, (introMonth - cappedMonth) * months);
  }
  const kind = payoutKind(card.cashback.payout);
  const factor = payoutFactor(kind, input.value);
  if (factor < 1 && kind === 'unknown') flags.push('Reward currency not published');
  const earned = gross - txCapCut - capCut + intro;
  const valueCut = earned * (1 - factor);
  const cashback = earned - valueCut;

  // Plan and one-off fees
  if (tier.feeUsdYear == null) flags.push('Tier price not published');
  const fee = tier.feeUsdYear ?? 0;
  let oneTime = 0;
  if (input.year === 1) {
    if (input.form === 'physical') {
      if (card.fees.physicalCardFeeUsd == null) flags.push('Physical card price not published');
      oneTime = card.fees.physicalCardFeeUsd ?? 0;
    } else {
      oneTime = card.fees.cardFeeUsd ?? 0;
    }
  }

  // FX by currency
  const local = country ? currencyOf(country) : null;
  const partSpend = (k: Segment['part']) => segs.filter((g) => g.part === k).reduce((s, g) => s + g.spendYear, 0);
  const share = (k: Segment['part']) => (yearSpend > 0 ? partSpend(k) / yearSpend : 0);
  const home = country ? homeFx(card, tier, country) : null;
  const other = otherFxPct(card, tier);
  const parts: SpendPart[] = [
    // No country: home spending is in the card's own currency.
    { key: 'home', share: share('home'), currency: local, fxPct: home ? home.pct : 0, foreign: Boolean(country) && !billedIn(card, local, local), fx: 0 },
    { key: 'usd', share: share('usd'), currency: 'USD', fxPct: fxIn(card, tier, 'USD', local), foreign: !billedIn(card, 'USD', local), fx: 0 },
    { key: 'travel', share: share('travel'), currency: null, fxPct: other, foreign: true, fx: 0 }
  ];
  for (const p of parts) p.fx = (partSpend(p.key) * (p.fxPct ?? 0)) / 100;
  if (parts.some((p) => p.share > 0 && p.fxPct == null)) flags.push('FX fee not published');
  if (home && !home.known && home.pct && share('home') > 0) {
    flags.push(`Billing currency not published, so FX is counted on your ${home.currency ?? 'local'} spending too`);
  }
  const fx = parts.reduce((s, p) => s + p.fx, 0);

  // Per-purchase fees
  const count = (g: Segment) => (g.size > 0 ? g.spendYear / g.size : 0);
  const purchases = segs.reduce((s, g) => s + count(g), 0);
  const txPct = (yearSpend * card.fees.txPct) / 100;
  const txFlat = card.fees.txFlatUsd * purchases;
  const sp = card.fees.smallPurchase;
  let smallCount = 0;
  if (sp) {
    // Purchases under the limit, in the currencies the fee applies to (all of them, or only foreign ones).
    const foreign = new Set(parts.filter((p) => p.foreign).map((p) => p.key));
    const counted = segs
      .filter((g) => isSmallPurchase(sp, g.size) && (!sp.foreignOnly || foreign.has(g.part)))
      .reduce((s, g) => s + count(g), 0);
    // Some issuers waive the first few small purchases each month (e.g. RedotPay: first 5).
    smallCount = Math.max(0, counted - (sp.freePerMonth ?? 0) * 12);
  }
  const small = sp ? sp.feeUsd * smallCount : 0;

  // Top-up fee: to spend this much and cover the fees, you load (spend + fees) / (1 - top-up %).
  const loadPct = card.fees.topUpPct;
  if (loadPct == null) flags.push('Top-up fee not published');
  const lp = Math.min((loadPct ?? 0) / 100, 0.5);
  const needed = yearSpend + fx + txPct + txFlat + small;
  const topUp = lp > 0 ? (needed * lp) / (1 - lp) : 0;

  const tx = txPct + txFlat + small + topUp;
  const net = cashback - fee - oneTime - fx - tx;

  const req = tier.requirement?.trim();
  if (req && !req.startsWith('$')) {
    if (/^not published$/i.test(req)) flags.push('How to qualify is not published');
    else if (index === 0) flags.push(req);
    else flags.push(`Needs: ${req}`);
  }
  if (tier.stake) {
    const amount = tier.stake.amount != null ? tier.stake.amount.toLocaleString('en-US') : 'some';
    flags.push(`${req?.startsWith('$') ? 'Or hold' : 'Hold'} ${amount} ${tier.stake.token}`);
  }
  if (!offered && country) flags.push('Not offered where you live');

  return {
    tier,
    index,
    offered,
    gross,
    capCut,
    txCapCut,
    intro,
    valueCut,
    cashback,
    bands: month.bands.map((b) => ({ ...b, amount: b.amount * 12 })),
    fee,
    oneTime,
    parts,
    fx,
    txPct,
    txFlat,
    small,
    smallCount,
    topUp,
    tx,
    net,
    yieldPct: yearSpend > 0 ? (net / yearSpend) * 100 : 0,
    purchases,
    flags
  };
}

// ---------- Mode 1: best card ----------

/** Tiers shown by default: the entry tier, open tiers, and tiers you can simply pay for. */
export function isOpenTier(tier: Tier, index: number): boolean {
  if (tier.comingSoon) return false;
  if (index === 0) return true;
  if (!tier.requirement && !tier.stake) return true;
  return Boolean(tier.requirement?.trim().startsWith('$'));
}

/** The entry tier, and other tiers that are free with nothing to hold or qualify for. */
export function isEntryTier(tier: Tier, index: number): boolean {
  if (tier.comingSoon) return false;
  return index === 0 || (tier.feeUsdYear === 0 && !tier.stake && !tier.requirement);
}

export type CardResult = TierResult & { card: CardRow };

/** Whether a card is offered as a physical card. */
export const hasPhysical = (card: Pick<CardRow, 'forms'>) => card.forms.includes('physical') || card.forms.includes('metal');

/**
 * Best tier per card for this spending profile, sorted by what you keep a year. With a country, tiers only offered
 * elsewhere (e.g. a US-only plan for someone in India) are left out and FX follows that country's currency.
 */
export function rankByValue(cards: CardRow[], input: CalcInput, country?: string | null): CardResult[] {
  return cards
    .map((card) => {
      const options = card.tiers
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => !country || tierOffered(t, country))
        .filter(({ t, i }) => (input.tiers === 'entry' ? isEntryTier(t, i) : input.all ? !t.comingSoon : isOpenTier(t, i)))
        .map(({ t, i }) => tierValue(card, t, input, i, country));
      const fallback = card.tiers.find((t) => !country || tierOffered(t, country)) ?? card.tiers[0];
      const best = options.sort((a, b) => b.net - a.net)[0] ?? tierValue(card, fallback, input, card.tiers.indexOf(fallback), country);
      return { ...best, card };
    })
    .sort((a, b) => b.net - a.net);
}

// ---------- Mode 2: tiers of one card ----------

export type BreakEven = {
  from: TierResult;
  to: TierResult;
  /** Monthly spend from which `to` keeps you more than `from`. null = never (up to the search limit). 0 = always. */
  beatsFrom: number | null;
  /** Monthly spend from which `from` is ahead again (e.g. once a cap kicks in). null = it stays ahead. */
  until: number | null;
};

export const BREAK_EVEN_LIMIT = 100_000;

/**
 * Each tier against the one before it: the monthly spend where the dearer tier starts to keep you more money, with
 * all other settings unchanged. Found on a $10 grid, then narrowed down to the dollar.
 */
export function breakEvens(
  card: CardRow,
  input: CalcInput,
  country?: string | null,
  /** Compare each tier with the one before it, or every tier with the entry tier. */
  against: 'previous' | 'entry' = 'previous'
): BreakEven[] {
  const usable = card.tiers.map((t, i) => ({ t, i })).filter(({ t }) => !t.comingSoon && (!country || tierOffered(t, country)));
  const at = (i: number, spend: number) => tierValue(card, card.tiers[i], { ...input, spend }, i, country).net;
  const out: BreakEven[] = [];
  for (let k = 1; k < usable.length; k++) {
    const a = against === 'entry' ? usable[0].i : usable[k - 1].i;
    const b = usable[k].i;
    const ahead = (s: number) => at(b, s) > at(a, s) + 0.005;
    const edge = (lo: number, hi: number, want: boolean) => {
      // First spend in (lo, hi] where ahead() === want.
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (ahead(mid) === want) hi = mid;
        else lo = mid;
      }
      return hi;
    };
    let beatsFrom: number | null = ahead(0) ? 0 : null;
    let until: number | null = null;
    let prev = 0;
    for (let s = 10; s <= BREAK_EVEN_LIMIT; s += s < 20_000 ? 10 : 100) {
      const now = ahead(s);
      if (beatsFrom == null && now) beatsFrom = edge(prev, s, true);
      else if (beatsFrom != null && until == null && !now) {
        until = edge(prev, s, false);
        break;
      }
      prev = s;
    }
    out.push({
      from: tierValue(card, card.tiers[a], input, a, country),
      to: tierValue(card, card.tiers[b], input, b, country),
      beatsFrom,
      until
    });
  }
  return out;
}
