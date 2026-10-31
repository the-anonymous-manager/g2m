import 'server-only';
import raw from '@/data/sponsor.json';
import { SponsorSchema } from '@/lib/card-schema.mjs';
import { getCard } from '@/lib/cards';
import type { Card } from '@/lib/types';

// The top spot on the home page, booked in data/sponsor.json: a paid booking (type "sponsored", shown as Featured with
// a "Sponsored" note) between its start and end dates (UTC, inclusive), or G2M's own choice (type "pick", labelled
// "Our pick"; no dates = always). Never touches a card's score or rank.
export type TopSpot = { card: Card; paid: boolean };

export function getSponsor(now = new Date()): TopSpot | null {
  const parsed = SponsorSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { slug, start, end, type } = parsed.data;
  if (!slug) return null;
  const paid = type === 'sponsored';
  if (paid && (!start || !end)) return null;
  const today = now.toISOString().slice(0, 10);
  if ((start && today < start) || (end && today > end)) return null;
  const card = getCard(slug);
  return card ? { card, paid } : null;
}
