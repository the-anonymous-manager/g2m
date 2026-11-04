import type { CardData, ScoreBreakdown, Tier } from '@/lib/types';
import { availabilityIn, tierOffered } from '@/lib/regions';
import { COUNTRY_CODES } from '@/lib/countries.mjs';
import { cashbackBreakdown, isSmallPurchase, perPurchaseCut } from '@/lib/calc';
import { billedIn, homeFx } from '@/lib/fx';
import { currencyOf } from '@/lib/currencies.mjs';
import { BASKET, BASKET_USD, BASKET_PURCHASES } from '@/lib/basket';

// The G2M score (0 to 100). Data-driven and identical for every card: no paid placement.
// Anything the issuer does not publish scores 0 for that part, so publishing terms is rewarded.
//
//   Rewards    25  entry-tier ongoing cashback on the $1,000 basket (bands and caps applied); 3.5% = full marks
//   Fees       30  annual and card-access costs 10 · FX fee 12 · other transaction costs on the basket 8
//   Coverage   20  confirmed countries 12 · Apple Pay 2 · Google Pay 2 · physical card 3 (+1 under $50)
//   Ecosystem  15  bank account 3 · bank payouts 3 · fiat on/off-ramp 3 · crypto-backed credit 3 · yield 3
//   Control    10  non-custodial (stored as "self-custodial") 10 · custodial 5 · not published 0
//
// Rewards and fees are kept apart: cashback always earns rewards points, and every fee charged on purchases
// costs fees points. For one country, the same formula uses the tiers offered there; when the card does not bill
// in that country's currency, its FX fee and foreign-only small-purchase fees are added to the basket cost; and
// "countries" becomes: confirmed there 12, not confirmed 5. When no card is confirmed in that country, the
// worldwide country points are kept so the ranking still tells cards apart.
export const SCORE_WEIGHTS = { rewards: 25, fees: 30, coverage: 20, ecosystem: 15, control: 10 } as const;

/** Basket cashback rate that earns full rewards points. */
export const FULL_REWARDS_PCT = 3.5;

// The standard month of spending every card is scored on: $1,000 in five $200 buckets, 35 purchases.
// Spending bands, caps, per-purchase fees and small-purchase fees are all worked out on it.
export { BASKET, BASKET_USD, BASKET_PURCHASES } from '@/lib/basket';

export type ScoreInput = Pick<CardData, 'cashback' | 'fees' | 'tiers' | 'coverage' | 'wallets' | 'forms' | 'custody' | 'ecosystem'>;

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
function basketRate(terms: Terms, maxPerTxUsd?: number | null): number {
  if (terms.basePct == null) return 0;
  const tier = terms.entry?.bands?.length ? terms.entry : ({ ...terms.entry, bands: undefined, cashbackPct: terms.basePct } as Tier);
  // A per-purchase cap first (e.g. Kolo's $1 caps the $200 purchase), then the monthly cap.
  const cut = BASKET.reduce((s, b) => s + b.count * perPurchaseCut(tier, maxPerTxUsd, b.usd), 0);
  let month = Math.max(0, (cashbackBreakdown(tier, BASKET_USD).gross ?? 0) - cut);
  if (tier.capMonthlyUsd != null) month = Math.min(month, tier.capMonthlyUsd);
  return (month / BASKET_USD) * 100;
}

/** The entry-tier cashback rate on the basket, before per-purchase fees. */
export function typicalRate(c: Pick<CardData, 'cashback' | 'fees' | 'tiers'>): number {
  return basketRate(termsIn(c), c.cashback.maxPerTxUsd);
}

/** What you keep: the basket cashback rate minus any fee charged on every purchase. */
export function netRate(c: Pick<CardData, 'cashback' | 'fees' | 'tiers'>): number {
  return Math.max(typicalRate(c) - c.fees.txPct, 0);
}

/**
 * Other transaction costs on the basket, in USD a month, or null when not published (the top-up fee, or the FX fee
 * for spending in a currency the card does not bill in). Counts the per-purchase % fee, flat fees on all 35
 * purchases, the top-up (funding) fee and small-purchase fees on basket purchases below the limit.
 *
 * `foreign`: the basket is spent in a currency the card does not bill in, at this FX %. The FX fee then applies to
 * every purchase too, and so do small-purchase fees charged only on foreign purchases.
 */
export function basketCosts(c: Pick<CardData, 'fees'>, foreign?: { fxPct: number | null } | null): number | null {
  const f = c.fees;
  if (f.topUpPct == null) return null;
  if (foreign && foreign.fxPct == null) return null;
  const pct = f.txPct + f.topUpPct + (foreign?.fxPct ?? 0);
  const sp = f.smallPurchase;
  // Basket purchases under the limit (or at it, when inclusive), less any free ones each month.
  const small =
    sp && (!sp.foreignOnly || foreign)
      ? Math.max(0, BASKET.filter((b) => isSmallPurchase(sp, b.usd)).reduce((s, b) => s + b.count, 0) - (sp.freePerMonth ?? 0)) * sp.feeUsd
      : 0;
  const usd = (pct / 100) * BASKET_USD + f.txFlatUsd * BASKET_PURCHASES + small;
  return Math.round(usd * 100) / 100;
}

/** Points for other transaction costs on the basket ($ a month). */
export const costPoints = (usd: number | null) =>
  usd == null ? 0 : usd === 0 ? 8 : usd <= 10 ? 6 : usd <= 20 ? 3 : usd <= 30 ? 1 : 0;

/** Ecosystem and banking points, 3 for each of five features. */
export function ecosystemPoints(e: CardData['ecosystem']): number {
  if (!e) return 0;
  const iban = e.iban === 'named' ? 3 : e.iban === 'shared' ? 2 : 0;
  const payouts = e.payoutCorridors == null ? 0 : e.payoutCorridors >= 2 ? 3 : e.payoutCorridors === 1 ? 1.5 : 0;
  const ramps = e.ramps === 'both' ? 3 : e.ramps === 'on' || e.ramps === 'off' ? 1.5 : 0;
  return iban + payouts + ramps + (e.credit ? 3 : 0) + (e.yield ? 3 : 0);
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
  const rate = basketRate(terms, c.cashback.maxPerTxUsd);
  const rewards = Math.min(rate / FULL_REWARDS_PCT, 1) * SCORE_WEIGHTS.rewards;

  // Mandatory entry-tier yearly cost plus a one-off fee to get the card (not optional physical card shipping).
  const annual = terms.annualUsd == null ? null : terms.annualUsd + (c.fees.cardFeeUsd ?? 0);
  const annualPts = annual == null ? 0 : annual === 0 ? 10 : annual <= 100 ? 6 : annual <= 300 ? 3 : 0;
  const fx = terms.fxPct;
  const fxPts = fx == null ? 0 : fx === 0 ? 12 : fx <= 1 ? 9 : fx <= 2 ? 5 : 2;
  // Worldwide, the basket is spent in the card's own currency. For one country, in that country's currency.
  // A card that does not bill in that currency charges its FX fee (if any) and its foreign-only fees on every purchase.
  const home = place ? homeFx(c, terms.entry, place.country) : null;
  const local = place ? currencyOf(place.country) : null;
  const foreignHere = Boolean(home && home.pct !== 0) || (place != null && !billedIn(c, local, local));
  const costs = basketCosts(c, home && foreignHere ? { fxPct: home.pct } : null);
  const costPts = costPoints(costs);
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

  const ecosystem = ecosystemPoints(c.ecosystem);

  const control = c.custody === 'self-custodial' || c.custody === 'both' ? 10 : c.custody === 'custodial' ? 5 : 0;

  const round = (x: number) => Math.round(x * 10) / 10;
  return {
    total: Math.round(rewards + fees + coverage + ecosystem + control),
    rewards: round(rewards),
    fees: round(fees),
    coverage: round(coverage),
    ecosystem: round(ecosystem),
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
