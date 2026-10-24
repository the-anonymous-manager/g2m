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
  // The sharer's own currency, for cards billed in it.
  home: z
    .string()
    .transform((s) => s.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/))
    .nullable()
    .catch(null)
});
export type ReceiptParams = z.infer<typeof ReceiptParamsSchema>;

const DEFAULTS = { card: null, tier: 0, amt: 10, cur: 'USD', what: 'Coffee', home: null };

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
  if (p.home) q.set('home', p.home);
  return q.toString();
}
