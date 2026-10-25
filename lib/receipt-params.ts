import { z } from 'zod';

// The settings of a shared swipe receipt, from the link (/receipt?card=kast&tier=0&amt=840&cur=INR&what=Coffee&home=INR).
// Bad values fall back to defaults, so a mangled link still opens a receipt.
export const ReceiptParamsSchema = z.object({
  card: z.string().regex(/^[a-z0-9-]{1,60}$/).nullable().catch(null),
  tier: z.coerce.number().int().min(0).max(50).catch(0),
  amt: z.coerce.number().finite().min(0).max(1_000_000).catch(10),
  cur: z
    .string()
    .transform((s) => s.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/))
    .catch('USD'),
  what: z.string().trim().max(40).catch('Purchase'),
  // The card's base (billing) currency, and the currency the receipt is shown in.
  base: z
    .string()
    .transform((s) => s.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/))
    .nullable()
    .catch(null),
  show: z
    .string()
    .transform((s) => s.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/))
    .nullable()
    .catch(null),
  // Matching a real app screenshot (amounts in the card's base currency): the cleared amount (price + FX), the total
  // charged, or the exchange rate used (shop currency per 1 base currency). Empty = live mid-market rate.
  cleared: z.coerce.number().finite().positive().max(10_000_000).nullable().catch(null),
  total: z.coerce.number().finite().positive().max(10_000_000).nullable().catch(null),
  rate: z.coerce.number().finite().positive().max(10_000_000).nullable().catch(null),
  // The sharer's own currency, for cards billed in it.
  home: z
    .string()
    .transform((s) => s.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/))
    .nullable()
    .catch(null)
});
export type ReceiptParams = z.infer<typeof ReceiptParamsSchema>;

const DEFAULTS = { card: null, tier: 0, amt: 10, cur: 'USD', what: 'Coffee', base: null, show: null, cleared: null, total: null, rate: null, home: null };

export function parseReceiptParams(raw: Record<string, string | string[] | undefined>): ReceiptParams {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const given = Object.fromEntries(
    Object.keys(DEFAULTS)
      .map((k) => [k, one(raw[k])])
      .filter(([, v]) => v != null && v !== '')
  );
  return ReceiptParamsSchema.parse({ ...DEFAULTS, ...given });
}

export function receiptQuery(p: ReceiptParams): string {
  const q = new URLSearchParams();
  if (p.card) q.set('card', p.card);
  q.set('tier', String(p.tier));
  q.set('amt', String(p.amt));
  q.set('cur', p.cur);
  q.set('what', p.what);
  if (p.base) q.set('base', p.base);
  if (p.show && p.show !== p.cur) q.set('show', p.show);
  if (p.cleared) q.set('cleared', String(p.cleared));
  else if (p.total) q.set('total', String(p.total));
  else if (p.rate) q.set('rate', String(p.rate));
  if (p.home) q.set('home', p.home);
  return q.toString();
}
