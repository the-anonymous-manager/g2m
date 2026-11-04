import 'server-only';
import type { Card, Market } from '@/lib/types';

// "Best X alternatives": the best-scored other cards that are not ruled out in the markets where X is confirmed.
// Used by the card page ("Also worth a look") and the /cards/[slug]/alternatives page, so both agree.

const MARKETS: Market[] = ['IN', 'AE', 'US', 'GB', 'EU'];

/** Other cards in rank order, keeping those not marked unavailable in at least one market where `card` is confirmed. */
export function alternativesTo(card: Card, all: Card[], n: number): Card[] {
  const mine = MARKETS.filter((m) => card.coverage.markets[m] === 'yes');
  return all
    .filter((c) => c.slug !== card.slug)
    .filter((c) => !mine.length || mine.some((m) => c.coverage.markets[m] !== 'no'))
    .slice(0, n);
}

export const alternativesPath = (slug: string) => `/cards/${slug}/alternatives`;
