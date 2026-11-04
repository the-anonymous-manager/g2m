import type { CardRow, Tier } from '@/lib/types';

// Things beyond cashback a wallet can need. Each comes from published card data; anything not confirmed counts as
// missing. `tierLevel` features depend on the plan (e.g. lounge access only on paid tiers).

export const FEATURE_KEYS = ['lounge', 'yield', 'borrow', 'iban', 'payout', 'selfCustody', 'physical', 'mobilePay'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

type Feature = { key: FeatureKey; label: string; short: string; tierLevel?: boolean; has: (card: CardRow, tier: Tier) => boolean };

export const FEATURES: Feature[] = [
  {
    key: 'lounge',
    label: 'Airport lounge access',
    short: 'Lounges',
    tierLevel: true,
    has: (_c, t) => (t.perks ?? []).some((p) => /lounge/i.test(p))
  },
  { key: 'yield', label: 'Yield on your balance', short: 'Yield', has: (c) => c.ecosystem?.yield === true },
  { key: 'borrow', label: 'Borrow against crypto', short: 'Borrow', has: (c) => c.ecosystem?.credit === true },
  {
    key: 'iban',
    label: 'Bank account number (IBAN)',
    short: 'Bank account',
    has: (c) => c.ecosystem?.iban === 'named' || c.ecosystem?.iban === 'shared'
  },
  { key: 'payout', label: 'Send money to a bank', short: 'Bank payouts', has: (c) => (c.ecosystem?.payoutCorridors ?? 0) >= 1 },
  { key: 'selfCustody', label: 'Non-custodial', short: 'Non-custodial', has: (c) => c.custody === 'self-custodial' || c.custody === 'both' },
  { key: 'physical', label: 'Physical card', short: 'Physical card', has: (c) => c.forms.includes('physical') || c.forms.includes('metal') },
  { key: 'mobilePay', label: 'Apple Pay or Google Pay', short: 'Apple/Google Pay', has: (c) => Boolean(c.wallets.applePay || c.wallets.googlePay) }
];

export const FEATURE: Record<FeatureKey, Feature> = Object.fromEntries(FEATURES.map((f) => [f.key, f])) as Record<FeatureKey, Feature>;

/** The features one card gives you on one tier. */
export function featuresOf(card: CardRow, tier: Tier): Set<FeatureKey> {
  return new Set(FEATURES.filter((f) => f.has(card, tier)).map((f) => f.key));
}
