import type { CardData, ScoreBreakdown, Tier } from '@/lib/types';
import { availabilityIn, tierOffered } from '@/lib/regions';

// The G2M score (0 to 100). Data-driven and identical for every card: no paid placement.
// Unknown values score below known good values, so publishing terms is rewarded.
//
//   Rewards  40  typical cashback rate minus per-purchase fees, capped at 5%
//   Fees     30  annual fee 10 · FX fee 12 · top-up, uncovered per-purchase, flat and small-purchase fees 8
//   Coverage 20  countries 12 · Apple/Google Pay 4 · physical card 4
//   Control  10  self-custodial 10 · custodial 5 · unknown 4
//
// For one country, the same formula uses the tiers offered there (cashback, annual fee, FX fee),
// and "countries" becomes: confirmed there 12, not confirmed 5. When no card is confirmed in that
// country, the global country count is kept so the ranking still tells cards apart.
export const SCORE_WEIGHTS = { rewards: 40, fees: 30, coverage: 20, control: 10 } as const;

export type ScoreInput = Pick<CardData, 'cashback' | 'fees' | 'tiers' | 'coverage' | 'wallets' | 'forms' | 'custody'>;

/** A country to score for, and whether any card is confirmed there. */
export type ScorePlace = { country: string; anyConfirmed: boolean };

type Terms = { basePct: number | null; maxPct: number | null; annualUsd: number | null; fxPct: number | null };

const tierRate = (t: Tier) => t.cashbackPct ?? t.bands?.[0]?.pct ?? null;

/** The cashback, annual fee and FX fee someone living in `country` actually gets. */
export function termsIn(c: Pick<CardData, 'cashback' | 'fees' | 'tiers'>, country?: string | null): Terms {
  const card: Terms = { basePct: c.cashback.basePct, maxPct: c.cashback.maxPct, annualUsd: c.fees.annualUsd, fxPct: c.fees.fxPct };
  if (!country || !c.tiers.some((t) => t.countries || t.exceptCountries)) return card;
  const offered = c.tiers.filter((t) => !t.comingSoon && tierOffered(t, country));
  const rates = offered.map(tierRate).filter((r): r is number => r != null);
  const entry = offered[0];
  return {
    basePct: entry ? tierRate(entry) : null,
    maxPct: rates.length ? Math.max(...rates) : null,
    annualUsd: entry ? entry.feeUsdYear : card.annualUsd,
    fxPct: entry?.fxPct ?? card.fxPct
  };
}

function typicalOf(basePct: number | null, maxPct: number | null): number {
  if (basePct != null) return basePct;
  // Only a headline "up to" rate: count 40% of it, since it usually needs a top tier.
  if (maxPct != null) return maxPct * 0.4;
  return 0;
}

/** The cashback rate we treat as "typical" for scoring. */
export function typicalRate(c: Pick<CardData, 'cashback'>): number {
  return typicalOf(c.cashback.basePct, c.cashback.maxPct);
}

/** What you keep: the typical rate minus any fee charged on every purchase. */
export function netRate(c: Pick<CardData, 'cashback' | 'fees'>): number {
  return Math.max(typicalRate(c) - c.fees.txPct, 0);
}

/** The G2M score worldwide, or for one country when `place` is given. */
export function scoreCard(c: ScoreInput, place?: ScorePlace | null): ScoreBreakdown {
  const terms = termsIn(c, place?.country);
  const typical = typicalOf(terms.basePct, terms.maxPct);
  const rewards = Math.min(Math.max(typical - c.fees.txPct, 0) / 5, 1) * SCORE_WEIGHTS.rewards;

  const annual = terms.annualUsd;
  const annualPts = annual == null ? 5 : annual === 0 ? 10 : annual <= 100 ? 6 : annual <= 300 ? 3 : 0;
  const fx = terms.fxPct;
  const fxPts = fx == null ? 4 : fx === 0 ? 12 : fx <= 1 ? 9 : fx <= 2 ? 5 : 2;
  // A per-purchase fee already comes off rewards; only the part larger than the cashback counts here.
  const uncovered = Math.max(c.fees.txPct - typical, 0);
  const flat = c.fees.txFlatUsd > 0 || c.fees.smallPurchase != null;
  const extra = (c.fees.topUpPct ?? 0) + uncovered + (flat ? 0.5 : 0);
  const extraPts = c.fees.topUpPct == null && uncovered === 0 && !flat ? 5 : extra === 0 ? 8 : extra <= 1 ? 4 : 1;
  const fees = annualPts + fxPts + extraPts;

  const n = c.coverage.countries;
  let countryPts = n == null ? 5 : n >= 100 ? 12 : n >= 40 ? 9 : n >= 10 ? 6 : 3;
  if (place?.anyConfirmed) {
    const here = availabilityIn(c, place.country);
    countryPts = here === 'yes' ? 12 : here === 'unknown' ? 5 : 0;
  }
  const walletPts = (c.wallets.applePay ? 2 : 0) + (c.wallets.googlePay ? 2 : 0);
  const physicalPts = c.forms.includes('physical') || c.forms.includes('metal') ? 4 : 0;
  const coverage = countryPts + walletPts + physicalPts;

  const control = c.custody === 'self-custodial' ? 10 : c.custody === 'custodial' ? 5 : 4;

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
