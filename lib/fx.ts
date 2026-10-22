import type { CardRow, Tier } from '@/lib/types';
import { currencyOf } from '@/lib/currencies.mjs';

type FxCard = Pick<CardRow, 'fees'>;

/** FX % on purchases in a currency the card is not billed in (spending abroad). null = not published. */
export const otherFxPct = (card: FxCard, tier?: Pick<Tier, 'fxPct'> | null): number | null =>
  tier?.fxPct ?? card.fees.fxPct;

export type HomeFx = {
  /** The visitor's everyday currency, e.g. "INR". */
  currency: string | null;
  /** FX % on everyday spending at home. null = not published. */
  pct: number | null;
  /** false when the issuer does not say which currency it bills in, so `pct` assumes the worst case. */
  known: boolean;
};

/**
 * The FX fee on spending at home for someone living in `cc`: none when the card bills in their currency
 * (or in the holder's own currency), otherwise the card's usual FX fee. When the issuer does not say which
 * currency it bills in, the usual fee is assumed, so a card never looks cheaper for leaving it out.
 */
export function homeFx(card: FxCard, tier: Pick<Tier, 'fxPct'> | null | undefined, cc: string | null | undefined): HomeFx {
  const currency = currencyOf(cc);
  const other = otherFxPct(card, tier);
  if (other === 0) return { currency, pct: 0, known: true };
  if (card.fees.fxHome) return { currency, pct: 0, known: true };
  const byCurrency = card.fees.fxByCurrency;
  if (currency && byCurrency && currency in byCurrency) return { currency, pct: byCurrency[currency], known: true };
  return { currency, pct: other, known: Boolean(byCurrency) };
}
