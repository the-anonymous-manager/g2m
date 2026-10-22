import type { CardData, ScoreBreakdown } from '@/lib/types';

// The G2M score (0 to 100). Data-driven and identical for every card: no paid placement.
// Unknown values score below known good values, so publishing terms is rewarded.
//
//   Rewards  40  typical cashback rate minus per-purchase fees, capped at 5%
//   Fees     30  annual fee 10 · FX fee 12 · top-up, uncovered per-purchase, flat and small-purchase fees 8
//   Coverage 20  countries 12 · Apple/Google Pay 4 · physical card 4
//   Control  10  self-custodial 10 · custodial 5 · unknown 4
export const SCORE_WEIGHTS = { rewards: 40, fees: 30, coverage: 20, control: 10 } as const;

/** The cashback rate we treat as "typical" for scoring. */
export function typicalRate(c: Pick<CardData, 'cashback'>): number {
  const { basePct, maxPct } = c.cashback;
  if (basePct != null) return basePct;
  // Only a headline "up to" rate: count 40% of it, since it usually needs a top tier.
  if (maxPct != null) return maxPct * 0.4;
  return 0;
}

/** What you keep: the typical rate minus any fee charged on every purchase. */
export function netRate(c: Pick<CardData, 'cashback' | 'fees'>): number {
  return Math.max(typicalRate(c) - c.fees.txPct, 0);
}

export function scoreCard(c: CardData): ScoreBreakdown {
  const rewards = Math.min(netRate(c) / 5, 1) * SCORE_WEIGHTS.rewards;

  const annual = c.fees.annualUsd;
  const annualPts = annual == null ? 5 : annual === 0 ? 10 : annual <= 100 ? 6 : annual <= 300 ? 3 : 0;
  const fx = c.fees.fxPct;
  const fxPts = fx == null ? 4 : fx === 0 ? 12 : fx <= 1 ? 9 : fx <= 2 ? 5 : 2;
  // A per-purchase fee already comes off rewards; only the part larger than the cashback counts here.
  const uncovered = Math.max(c.fees.txPct - typicalRate(c), 0);
  const flat = c.fees.txFlatUsd > 0 || c.fees.smallPurchase != null;
  const extra = (c.fees.topUpPct ?? 0) + uncovered + (flat ? 0.5 : 0);
  const extraPts = c.fees.topUpPct == null && uncovered === 0 && !flat ? 5 : extra === 0 ? 8 : extra <= 1 ? 4 : 1;
  const fees = annualPts + fxPts + extraPts;

  const n = c.coverage.countries;
  const countryPts = n == null ? 5 : n >= 100 ? 12 : n >= 40 ? 9 : n >= 10 ? 6 : 3;
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
