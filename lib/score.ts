import type { CardData, ScoreBreakdown, Tier } from '@/lib/types';
import { availabilityIn, tierOffered } from '@/lib/regions';
import { COUNTRY_CODES } from '@/lib/countries.mjs';
import { monthlyCashback } from '@/lib/calc';

// The G2M score (0 to 100). Data-driven and identical for every card: no paid placement.
// Anything the issuer does not publish scores 0 for that part, so publishing terms is rewarded.
//
//   Rewards  40  entry-tier ongoing cashback on the $1,000 basket, minus fees on every purchase, capped at 5%
//   Fees     30  annual and card-access costs 10 · FX fee 12 · other transaction costs on the basket 8
//   Coverage 20  confirmed countries 12 · Apple Pay 2 · Google Pay 2 · physical card 4
//   Control  10  self-custodial 10 · custodial 5 · not published 0
//
// For one country, the same formula uses the tiers offered there (cashback, annual fee, FX fee),
// and "countries" becomes: confirmed there 12, not confirmed 5. When no card is confirmed in that
// country, the worldwide country points are kept so the ranking still tells cards apart.
export const SCORE_WEIGHTS = { rewards: 40, fees: 30, coverage: 20, control: 10 } as const;

/**
 * The standard month of spending every card is scored on: $1,000 in five $200 buckets, 35 purchases.
 * Spending bands, caps, per-purchase fees and small-purchase fees are all worked out on it.
 */
export const BASKET = [
  { usd: 200, count: 1 },
  { usd: 100, count: 2 },
  { usd: 50, count: 4 },
  { usd: 25, count: 8 },
  { usd: 10, count: 20 }
] as const;
export const BASKET_USD = BASKET.reduce((s, b) => s + b.usd * b.count, 0); // 1,000
export const BASKET_PURCHASES = BASKET.reduce((s, b) => s + b.count, 0); // 35

export type ScoreInput = Pick<CardData, 'cashback' | 'fees' | 'tiers' | 'coverage' | 'wallets' | 'forms' | 'custody'>;

/** A country to score for, and whether any card is confirmed there. */
export type ScorePlace = { country: string; anyConfirmed: boolean };

type Terms = {
  /** The entry tier: the first plan open to this person (not a "coming soon" one). */
  entry: Tier | undefined;
  /** Its verified ongoing cashback rate, or null when only an "up to" rate is published. */
  basePct: number | null;
  maxPct: number | null;
  annualUsd: number | null;
  fxPct: number | null;
};

const tierRate = (t: Tier) => t.cashbackPct ?? t.bands?.[0]?.pct ?? null;

/** The entry tier, cashback, annual fee and FX fee someone living in `country` actually gets. */
export function termsIn(c: Pick<CardData, 'cashback' | 'fees' | 'tiers'>, country?: string | null): Terms {
  const open = c.tiers.filter((t) => !t.comingSoon);
  const regional = c.tiers.some((t) => t.countries || t.exceptCountries);
  if (!country || !regional) {
    return { entry: open[0], basePct: c.cashback.basePct, maxPct: c.cashback.maxPct, annualUsd: c.fees.annualUsd, fxPct: c.fees.fxPct };
  }
  const offered = open.filter((t) => tierOffered(t, country));
  const rates = offered.map(tierRate).filter((r): r is number => r != null);
  const entry = offered[0];
  return {
    entry,
    // A plan only for some countries (e.g. MEXC Thailand) states its own rate.
    basePct: entry ? tierRate(entry) : null,
    maxPct: rates.length ? Math.max(...rates) : null,
    annualUsd: entry ? entry.feeUsdYear : c.fees.annualUsd,
    fxPct: entry?.fxPct ?? c.fees.fxPct
  };
}

/**
 * Cashback rate (%) on the $1,000 basket from the entry tier: its spending bands and monthly cap apply.
 * No verified entry rate (only an "up to" headline rate) means 0.
 */
function basketRate(terms: Terms): number {
  if (terms.basePct == null) return 0;
  const tier = terms.entry?.bands?.length ? terms.entry : ({ ...terms.entry, bands: undefined, cashbackPct: terms.basePct } as Tier);
  return ((monthlyCashback(tier, BASKET_USD) ?? 0) / BASKET_USD) * 100;
}

/** The entry-tier cashback rate on the basket, before per-purchase fees. */
export function typicalRate(c: Pick<CardData, 'cashback' | 'fees' | 'tiers'>): number {
  return basketRate(termsIn(c));
}

/** What you keep: the basket cashback rate minus any fee charged on every purchase. */
export function netRate(c: Pick<CardData, 'cashback' | 'fees' | 'tiers'>): number {
  return Math.max(typicalRate(c) - c.fees.txPct, 0);
}

/**
 * Other transaction costs on the basket, in USD a month, or null when the top-up (funding) fee is not published.
 * Counts the part of a per-purchase % fee larger than the cashback, flat fees on all 35 purchases, the top-up fee,
 * and small-purchase fees on basket purchases below the limit (not ones charged only on foreign purchases).
 */
export function basketCosts(c: Pick<CardData, 'fees'>, ratePct: number): number | null {
  const f = c.fees;
  if (f.topUpPct == null) return null;
  const uncovered = (Math.max(f.txPct - ratePct, 0) / 100) * BASKET_USD;
  const flat = f.txFlatUsd * BASKET_PURCHASES;
  const topUp = (f.topUpPct / 100) * BASKET_USD;
  const small = f.smallPurchase && !f.smallPurchase.foreignOnly
    ? BASKET.filter((b) => b.usd < f.smallPurchase!.underUsd).reduce((s, b) => s + b.count * f.smallPurchase!.feeUsd, 0)
    : 0;
  return uncovered + flat + topUp + small;
}

// Confirmed countries per card, worked out once: the issuer's list, else the five checked markets (the EU counts
// all 30 EEA countries).
const confirmedCache = new WeakMap<object, number>();
export function confirmedCountries(c: Pick<CardData, 'coverage'>): number {
  let n = confirmedCache.get(c.coverage);
  if (n == null) {
    n = COUNTRY_CODES.filter((cc: string) => availabilityIn(c, cc) === 'yes').length;
    confirmedCache.set(c.coverage, n);
  }
  return n;
}

/** The G2M score worldwide, or for one country when `place` is given. */
export function scoreCard(c: ScoreInput, place?: ScorePlace | null): ScoreBreakdown {
  const terms = termsIn(c, place?.country);
  const rate = basketRate(terms);
  const net = Math.max(rate - c.fees.txPct, 0);
  const rewards = Math.min(net / 5, 1) * SCORE_WEIGHTS.rewards;

  // Mandatory entry-tier yearly cost plus a one-off fee to get the card (not optional physical card shipping).
  const annual = terms.annualUsd == null ? null : terms.annualUsd + (c.fees.cardFeeUsd ?? 0);
  const annualPts = annual == null ? 0 : annual === 0 ? 10 : annual <= 100 ? 6 : annual <= 300 ? 3 : 0;
  const fx = terms.fxPct;
  const fxPts = fx == null ? 0 : fx === 0 ? 12 : fx <= 1 ? 9 : fx <= 2 ? 5 : 2;
  const costs = basketCosts(c, rate);
  const costPts = costs == null ? 0 : costs === 0 ? 8 : costs <= 10 ? 4 : 1;
  const fees = annualPts + fxPts + costPts;

  const n = confirmedCountries(c);
  let countryPts = n >= 100 ? 12 : n >= 50 ? 10 : n >= 20 ? 8 : n >= 5 ? 5 : n >= 1 ? 2 : 0;
  if (place?.anyConfirmed) {
    const here = availabilityIn(c, place.country);
    countryPts = here === 'yes' ? 12 : here === 'unknown' ? 5 : 0;
  }
  const walletPts = (c.wallets.applePay ? 2 : 0) + (c.wallets.googlePay ? 2 : 0);
  const physical = c.forms.includes('physical') || c.forms.includes('metal');
  const cardCost = c.fees.physicalCardFeeUsd;
  const physicalPts = physical ? 3 + (cardCost != null && cardCost < 50 ? 1 : 0) : 0;
  const coverage = countryPts + walletPts + physicalPts;

  const control = c.custody === 'self-custodial' ? 10 : c.custody === 'custodial' ? 5 : 0;

  const round = (x: number) => Math.round(x * 10) / 10;
  return {
    total: Math.round(rewards + fees + coverage + control),
    rewards: round(rewards),
    fees: round(fees),
    coverage: round(coverage),
    control: round(control)
  };
}

/**
 * Score and rank cards for one country. Cards not available there drop out; ties keep the
 * worldwide order. # in a country view is this rank.
 */
export function rankIn<T extends ScoreInput & { score: ScoreBreakdown; rank: number }>(rows: T[], country: string): T[] {
  const open = rows.filter((r) => availabilityIn(r, country) !== 'no');
  const anyConfirmed = open.some((r) => availabilityIn(r, country) === 'yes');
  return open
    .map((r) => ({ ...r, score: scoreCard(r, { country, anyConfirmed }) }))
    .sort((a, b) => b.score.total - a.score.total || a.rank - b.rank)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
