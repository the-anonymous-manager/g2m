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

/**
 * Whether the card bills in `currency`, so spending in it is not a foreign purchase on this card (no FX fee and no
 * foreign-only fees). True for currencies the issuer lists at 0% FX, and for the holder's own currency on cards
 * billed in it. Unknown (no list) counts as foreign, so a card never looks cheaper for leaving it out.
 */
export function billedIn(card: FxCard, currency: string | null | undefined, homeCurrency?: string | null): boolean {
  if (!currency) return false;
  if (card.fees.fxHome && currency === homeCurrency) return true;
  return card.fees.fxByCurrency?.[currency] === 0;
}

/** FX % on spending in `currency` by someone whose own currency is `homeCurrency`. null = not published. */
export function fxIn(
  card: FxCard,
  tier: Pick<Tier, 'fxPct'> | null | undefined,
  currency: string | null | undefined,
  homeCurrency?: string | null
): number | null {
  const other = otherFxPct(card, tier);
  if (other === 0) return 0;
  if (!currency) return other;
  if (card.fees.fxHome && currency === homeCurrency) return 0;
  const byCurrency = card.fees.fxByCurrency;
  if (byCurrency && currency in byCurrency) return byCurrency[currency];
  return other;
}
