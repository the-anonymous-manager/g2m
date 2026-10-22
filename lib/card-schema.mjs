// Card data schema. Plain ESM so both the Next.js app (TypeScript) and the
// standalone validator script (node scripts/validate-cards.mjs) share one source of truth.
import { z } from 'zod';

export const MARKETS = /** @type {const} */ (['IN', 'AE', 'US', 'GB', 'EU']);
export const METALS = /** @type {const} */ (['rose', 'gold', 'silver', 'black', 'champagne', 'gunmetal']);

const pct = z.number().min(0).max(100);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const availability = z.enum(['yes', 'no', 'unknown']);

export const BandSchema = z.object({
  // Cumulative monthly spend this band applies up to. null = no upper limit.
  uptoUsd: z.number().positive().nullable(),
  pct
});

export const StakeSchema = z.object({
  token: z.string().min(1),
  amount: z.number().positive().nullable(),
  // CoinGecko API id, used in v2 to show the live USD value of the stake.
  coingeckoId: z.string().optional()
});

export const TierSchema = z.object({
  name: z.string().min(1),
  // Yearly cost of the tier in USD (annual fee or subscription x 12). null = not published.
  feeUsdYear: z.number().min(0).nullable(),
  feeNote: z.string().optional(),
  // Flat cashback rate. Use `bands` when the rate changes with spend.
  cashbackPct: pct.nullable(),
  bands: z.array(BandSchema).optional(),
  capMonthlyUsd: z.number().positive().nullable().optional(),
  // Tier-specific FX fee, overrides the card-level value.
  fxPct: pct.nullable().optional(),
  requirement: z.string().optional(),
  stake: StakeSchema.optional(),
  perks: z.array(z.string()).default([]),
  comingSoon: z.boolean().default(false)
});

export const CardSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and dashes only'),
  name: z.string().min(1),
  brand: z.string().min(1),
  issuer: z.string().nullable(),
  network: z.enum(['Visa', 'Mastercard', 'Amex', 'Visa / Mastercard']),
  type: z.enum(['debit', 'credit', 'prepaid', 'spend', 'mixed']),
  forms: z.array(z.enum(['virtual', 'physical', 'metal'])).min(1),
  custody: z.enum(['custodial', 'self-custodial', 'unknown']),
  summary: z.string().min(1),
  cashback: z.object({
    basePct: pct.nullable(),
    maxPct: pct.nullable(),
    payout: z.string().nullable(),
    note: z.string().optional()
  }),
  fees: z.object({
    annualUsd: z.number().min(0).nullable(),
    fxPct: pct.nullable(),
    fxNote: z.string().optional(),
    topUpPct: pct.nullable(),
    // Fee charged on every purchase (not only foreign ones).
    txPct: pct.default(0),
    txFlatUsd: z.number().min(0).default(0),
    // Flat fee on purchases below a set amount. null = none listed.
    smallPurchase: z
      .object({ feeUsd: z.number().positive(), underUsd: z.number().positive(), foreignOnly: z.boolean().default(false) })
      .nullable()
      .default(null),
    atm: z.string().nullable(),
    other: z.array(z.string()).default([])
  }),
  tiers: z.array(TierSchema).min(1),
  coverage: z.object({
    countries: z.number().int().positive().nullable(),
    scope: z.string().min(1),
    examples: z.array(z.string()).default([]),
    markets: z.object({
      IN: availability,
      AE: availability,
      US: availability,
      GB: availability,
      EU: availability
    })
  }),
  wallets: z.object({
    applePay: z.boolean().nullable(),
    googlePay: z.boolean().nullable()
  }),
  assets: z.array(z.string()).default([]),
  perks: z.array(z.string()).default([]),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  links: z.object({
    official: z.string().url(),
    affiliate: z.string().url().optional()
  }),
  sources: z
    .array(z.object({ label: z.string().min(1), url: z.string().url(), verified: isoDate.optional() }))
    .min(1, 'Every card needs at least one source'),
  lastChecked: isoDate,
  metal: z.enum(METALS).default('black')
});

export const CardListSchema = z.array(CardSchema);

// The paid "Featured" spot on the home page (data/sponsor.json). slug null = no sponsor,
// and the top-ranked card shows instead. Dates are inclusive, in UTC.
export const SponsorSchema = z
  .object({ slug: z.string().nullable(), start: isoDate.nullable(), end: isoDate.nullable() })
  .refine((s) => s.slug == null || (s.start != null && s.end != null && s.start <= s.end), {
    message: 'A sponsor needs a start and an end date, with the end on or after the start'
  });

/**
 * Validate a raw list of cards. Never throws.
 * Invalid cards are returned in `errors` instead of crashing the build.
 * @param {unknown} raw
 */
export function validateCards(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const valid = [];
  const errors = [];
  const seen = new Set();
  list.forEach((item, index) => {
    const result = CardSchema.safeParse(item);
    const label = (item && typeof item === 'object' && 'slug' in item && item.slug) || `#${index}`;
    if (!result.success) {
      errors.push({
        card: String(label),
        issues: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      });
      return;
    }
    if (seen.has(result.data.slug)) {
      errors.push({ card: result.data.slug, issues: ['slug: duplicate slug'] });
      return;
    }
    seen.add(result.data.slug);
    valid.push(result.data);
  });
  if (!Array.isArray(raw)) errors.push({ card: '(file)', issues: ['cards.json must be an array'] });
  return { valid, errors };
}
