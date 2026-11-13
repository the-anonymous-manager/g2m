import { getCards } from '@/lib/cards';
import { basketCosts } from '@/lib/score';

// The numbers on the fees guide (/guides/crypto-card-fees-explained and its translations): how common each fee is across
// the listed cards, and what the fees cost every card on the same $1,000 test month.

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

export function feesStats() {
  const cards = getCards();
  const n = cards.length;
  const known = <T,>(xs: (T | null | undefined)[]) => xs.filter((x): x is T => x != null);

  const annual = known(cards.map((c) => c.fees.annualUsd));
  const paidAnnual = annual.filter((x) => x > 0);
  const fx = known(cards.map((c) => c.fees.fxPct));
  const topUp = known(cards.map((c) => c.fees.topUpPct));
  const perPurchase = cards.filter((c) => c.fees.txPct > 0 || c.fees.txFlatUsd > 0).length;
  const small = cards.filter((c) => c.fees.smallPurchase);
  const smallForeign = small.filter((c) => c.fees.smallPurchase!.foreignOnly).length;
  const smallFree = small.filter((c) => c.fees.smallPurchase!.freePerMonth).length;

  // What every card's fees cost on the same $1,000 month: in the card's own currency, then all in another currency.
  const rows = cards
    .map((c) => ({ c, home: basketCosts(c), abroad: basketCosts(c, { fxPct: c.fees.fxPct }) }))
    .sort((a, b) => (a.abroad ?? Infinity) - (b.abroad ?? Infinity) || (a.home ?? Infinity) - (b.home ?? Infinity) || a.c.rank - b.c.rank);
  const cheapest = rows.filter((r) => r.abroad != null).slice(0, 3);
  const checked = cards.reduce((d, c) => (c.lastChecked > d ? c.lastChecked : d), '1970-01-01');
  return { cards, n, annual, paidAnnual, fx, fxMedian: median(fx), topUp, perPurchase, small, smallForeign, smallFree, rows, cheapest, checked };
}
