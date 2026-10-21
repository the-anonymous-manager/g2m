import { z } from 'zod';
import type { CardRow, Tier } from '@/lib/types';

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

export function tierValue(card: CardRow, tier: Tier, input: CalcInput, index = 1): TierResult {
  const flags: string[] = [];
  const yearSpend = input.spend * 12;

  const monthly = monthlyCashback(tier, input.spend);
  if (monthly == null) flags.push('Cashback rate not published');
  const cashback = (monthly ?? 0) * 12;

  if (tier.feeUsdYear == null) flags.push('Tier price not published');
  const fee = tier.feeUsdYear ?? 0;

  const fxPct = tier.fxPct ?? card.fees.fxPct;
  if (fxPct == null && input.foreign > 0) flags.push('FX fee not published');
  const fx = (yearSpend * (input.foreign / 100) * (fxPct ?? 0)) / 100;

  const purchases = input.spend > 0 ? (input.spend / input.ticket) * 12 : 0;
  const tx = (yearSpend * card.fees.txPct) / 100 + card.fees.txFlatUsd * purchases;

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

/** Best tier per card for this spending profile, sorted by net yearly value. */
export function rankByValue(cards: CardRow[], input: CalcInput): CardResult[] {
  return cards
    .map((card) => {
      const options = card.tiers
        .map((t, i) => ({ t, i }))
        .filter(({ t, i }) => (input.all ? !t.comingSoon : isOpenTier(t, i)))
        .map(({ t, i }) => tierValue(card, t, input, i));
      const best = options.sort((a, b) => b.net - a.net)[0] ?? tierValue(card, card.tiers[0], input, 0);
      return { ...best, card };
    })
    .sort((a, b) => b.net - a.net);
}
