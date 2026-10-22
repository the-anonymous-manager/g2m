import 'server-only';
import raw from '@/data/sponsor.json';
import { SponsorSchema } from '@/lib/card-schema.mjs';
import { getCard } from '@/lib/cards';
import type { Card } from '@/lib/types';

// The paid "Featured" spot on the home page, booked in data/sponsor.json. It only shows
// between its start and end dates (UTC, inclusive) and never touches a card's score or rank.
export function getSponsor(now = new Date()): Card | null {
  const parsed = SponsorSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { slug, start, end } = parsed.data;
  if (!slug || !start || !end) return null;
  const today = now.toISOString().slice(0, 10);
  if (today < start || today > end) return null;
  return getCard(slug) ?? null;
}
