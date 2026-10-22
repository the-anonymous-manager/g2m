// Card data schema. Plain ESM so both the Next.js app (TypeScript) and the
// standalone validator script (node scripts/validate-cards.mjs) share one source of truth.
import { z } from 'zod';
import { EEA, isCountry } from './countries.mjs';

export const MARKETS = /** @type {const} */ (['IN', 'AE', 'US', 'GB', 'EU']);
export const METALS = /** @type {const} */ (['rose', 'gold', 'silver', 'black', 'champagne', 'gunmetal']);

const pct = z.number().min(0).max(100);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const availability = z.enum(['yes', 'no', 'unknown']);
const countryCode = z.string().refine(isCountry, 'Unknown country code (use ISO 3166-1 alpha-2, e.g. JP)');
// A tier can be limited to some countries. "EEA" stands for all 30 EEA countries.
const tierPlace = z.union([countryCode, z.literal('EEA')]);

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
  comingSoon: z.boolean().default(false),
  // Only offered to residents of these countries (e.g. MEXC's Thailand tiers).
  countries: z.array(tierPlace).min(1).optional(),
  // Offered everywhere except these countries (e.g. a "Global" tier when the US has its own).
  exceptCountries: z.array(tierPlace).min(1).optional()
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
    }),
    // The issuer's own country list, when it publishes one. Countries in neither list take `others`.
    countryList: z
      .object({
        yes: z.array(countryCode).default([]),
        no: z.array(countryCode).default([]),
        // Countries the issuer's own pages contradict each other on: shown as not confirmed.
        unclear: z.array(countryCode).default([]),
        others: availability.default('unknown')
      })
      .optional()
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
  metal: z.enum(METALS).default('black'),
  // A real picture of the card. `source` is the link pasted in the sheet; the sync downloads it to `file`
  // (plus a small "-sm.webp" and a ".png" for share images). Without one, the metal art in `metal` shows.
  image: z
    .object({
      source: z.string().url(),
      file: z.string().regex(/^\/card-images\/[a-z0-9-]+\.webp$/, 'Use /card-images/<name>.webp')
    })
    .optional()
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
 * coverage.countryList and coverage.markets must agree wherever both give a firm answer.
 * @param {z.infer<typeof CardSchema>} card
 */
function marketClashes(card) {
  const list = card.coverage.countryList;
  if (!list) return [];
  const verdict = (cc) =>
    list.yes.includes(cc) ? 'yes' : list.no.includes(cc) ? 'no' : list.unclear.includes(cc) ? 'unknown' : list.others;
  const issues = [];
  for (const m of ['IN', 'AE', 'US', 'GB']) {
    const said = card.coverage.markets[m];
    const v = verdict(m);
    if (said !== 'unknown' && v !== 'unknown' && v !== said) {
      issues.push(`coverage: countryList says ${m} is "${v}" but markets.${m} is "${said}"`);
    }
  }
  // markets.EU means "available in the EEA" broadly; the list holds the country-by-country detail.
  const eea = EEA.map(verdict);
  const eu = card.coverage.markets.EU;
  if (eu === 'yes' && !eea.includes('yes')) issues.push('coverage: markets.EU is "yes" but countryList has no EEA country');
  if (eu === 'no' && eea.includes('yes')) issues.push('coverage: markets.EU is "no" but countryList includes EEA countries');
  return issues;
}

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
    const clash = marketClashes(result.data);
    if (clash.length) {
      errors.push({ card: result.data.slug, issues: clash });
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
