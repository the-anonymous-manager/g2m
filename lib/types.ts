import type { z } from 'zod';
import type { CardSchema, TierSchema } from '@/lib/card-schema.mjs';

export type CardData = z.infer<typeof CardSchema>;
export type Tier = z.infer<typeof TierSchema>;
export type Market = 'IN' | 'AE' | 'US' | 'GB' | 'EU';
export type Availability = 'yes' | 'no' | 'unknown';

export type ScoreBreakdown = {
  total: number;
  rewards: number;
  fees: number;
  coverage: number;
  control: number;
};

export type Card = CardData & { score: ScoreBreakdown };

// The slimmed-down shape sent to client components (keeps page payloads small).
export type CardRow = Pick<
  Card,
  | 'slug'
  | 'name'
  | 'brand'
  | 'network'
  | 'type'
  | 'custody'
  | 'forms'
  | 'cashback'
  | 'fees'
  | 'coverage'
  | 'tiers'
  | 'wallets'
  | 'metal'
  | 'score'
  | 'perks'
>;

export function toRow(c: Card): CardRow {
  return {
    slug: c.slug,
    name: c.name,
    brand: c.brand,
    network: c.network,
    type: c.type,
    custody: c.custody,
    forms: c.forms,
    cashback: c.cashback,
    fees: c.fees,
    coverage: c.coverage,
    tiers: c.tiers,
    wallets: c.wallets,
    metal: c.metal,
    score: c.score,
    perks: c.perks
  };
}
