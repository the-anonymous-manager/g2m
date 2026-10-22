import { z } from 'zod';
import type { CardRow, Tier } from '@/lib/types';
import { tierOffered } from '@/lib/regions';
import { homeFx, otherFxPct } from '@/lib/fx';

// Calculator inputs are validated and clamped, so bad URL params or typed values
// can never break the page: anything invalid falls back to a sensible default.
export const CalcInputSchema = z.object({
  spend: z.coerce.number().finite().min(0).max(1_000_000).catch(1000),
  foreign: z.coerce.number().finite().min(0).max(100).catch(20),
  ticket: z.coerce.number().finite().min(1).max(10_000).catch(40),
  all: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === '1' || v === 'true')
    .catch(false)
});

export type CalcInput = z.infer<typeof CalcInputSchema>;
export const DEFAULT_INPUT: CalcInput = { spend: 1000, foreign: 20, ticket: 40, all: false };

export function parseCalcInput(raw: Record<string, unknown>): CalcInput {
  return CalcInputSchema.parse({ ...DEFAULT_INPUT, ...raw });
}

/** Monthly cashback in USD for one tier at a given monthly spend. null = no published rate. */
export function monthlyCashback(tier: Tier, spend: number): number | null {
  let value: number | null = null;
  if (tier.bands && tier.bands.length) {
    let remaining = spend;
    let floor = 0;
    value = 0;
    for (const band of tier.bands) {
      const ceiling = band.uptoUsd ?? Infinity;
      const portion = Math.max(0, Math.min(remaining, ceiling - floor));
      value += (portion * band.pct) / 100;
      remaining -= portion;
      floor = ceiling;
      if (remaining <= 0) break;
    }
  } else if (tier.cashbackPct != null) {
    value = (spend * tier.cashbackPct) / 100;
  }
  if (value != null && tier.capMonthlyUsd != null) value = Math.min(value, tier.capMonthlyUsd);
  return value;
}

/** Tiers shown by default: the entry tier, open tiers, and tiers you can simply pay for. */
export function isOpenTier(tier: Tier, index: number): boolean {
  if (tier.comingSoon) return false;
  if (index === 0) return true;
  if (!tier.requirement && !tier.stake) return true;
  return Boolean(tier.requirement?.trim().startsWith('$'));
}

export type TierResult = {
  tier: Tier;
  cashback: number;
  fee: number;
  fx: number;
  tx: number;
  net: number;
  flags: string[];
};

/**
 * One tier's yearly value. With `country`, spending at home is in that country's currency: no FX fee when the card
 * bills in it, the card's FX fee otherwise. `input.foreign` is the share spent in other currencies (travel, foreign
 * shops), which pays the card's usual FX fee.
 */
export function tierValue(card: CardRow, tier: Tier, input: CalcInput, index = 1, country?: string | null): TierResult {
  const flags: string[] = [];
  const yearSpend = input.spend * 12;

  const monthly = monthlyCashback(tier, input.spend);
  if (monthly == null) flags.push('Cashback rate not published');
  const cashback = (monthly ?? 0) * 12;

  if (tier.feeUsdYear == null) flags.push('Tier price not published');
  const fee = tier.feeUsdYear ?? 0;

  const foreignShare = input.foreign / 100;
  const otherPct = otherFxPct(card, tier);
  const home = country ? homeFx(card, tier, country) : null;
  const homePct = home ? home.pct : 0;
  if ((otherPct == null && foreignShare > 0) || (home && homePct == null && foreignShare < 1)) flags.push('FX fee not published');
  if (home && !home.known && homePct && foreignShare < 1) {
    flags.push(`Billing currency not published, so FX is counted on your ${home.currency ?? 'local'} spending too`);
  }
  const fx = (yearSpend * ((1 - foreignShare) * (homePct ?? 0) + foreignShare * (otherPct ?? 0))) / 100;

  const purchases = input.spend > 0 ? (input.spend / input.ticket) * 12 : 0;
  const small = card.fees.smallPurchase;
  const smallCount = small && input.ticket < small.underUsd ? purchases * (small.foreignOnly ? input.foreign / 100 : 1) : 0;
  const tx = (yearSpend * card.fees.txPct) / 100 + card.fees.txFlatUsd * purchases + (small ? small.feeUsd * smallCount : 0);

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

  return { tier, cashback, fee, fx, tx, net: cashback - fee - fx - tx, flags };
}

export type CardResult = TierResult & { card: CardRow };

/**
 * Best tier per card for this spending profile, sorted by net yearly value. With a country, tiers only offered
 * elsewhere (e.g. a US-only plan for someone in India) are left out and FX follows that country's currency.
 */
export function rankByValue(cards: CardRow[], input: CalcInput, country?: string | null): CardResult[] {
  return cards
    .map((card) => {
      const options = card.tiers
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => !country || tierOffered(t, country))
        .filter(({ t, i }) => (input.all ? !t.comingSoon : isOpenTier(t, i)))
        .map(({ t, i }) => tierValue(card, t, input, i, country));
      const fallback = card.tiers.find((t) => !country || tierOffered(t, country)) ?? card.tiers[0];
      const best = options.sort((a, b) => b.net - a.net)[0] ?? tierValue(card, fallback, input, card.tiers.indexOf(fallback), country);
      return { ...best, card };
    })
    .sort((a, b) => b.net - a.net);
}
