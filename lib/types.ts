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
  ecosystem: number;
  control: number;
};

// rank: position by G2M score across all cards (1 = best), fixed whatever the view.
export type Card = CardData & { score: ScoreBreakdown; rank: number };

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
  | 'image'
  | 'ecosystem'
  | 'score'
  | 'bankRails'
  | 'bankForNonResidents'
  | 'kycRule'
  | 'restrictedPassports'
  | 'assets'
  | 'rank'
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
    image: c.image,
    ecosystem: c.ecosystem,
    score: c.score,
    bankRails: c.bankRails,
    bankForNonResidents: c.bankForNonResidents,
    kycRule: c.kycRule,
    restrictedPassports: c.restrictedPassports,
    assets: c.assets,
    rank: c.rank,
    perks: c.perks
  };
}
