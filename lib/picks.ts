import 'server-only';
import raw from '@/data/picks.json';
import { PicksSchema } from '@/lib/card-schema.mjs';
import type { Card } from '@/lib/types';

export type HomePick = {
  slot: number;
  card: Card;
  /**
   * featured = paid, shown as "Featured" with a "Sponsored" note; pick = chosen by G2M; new = a card added in the
   * last NEW_DAYS days; auto = filled in by the rules below.
   */
  kind: 'featured' | 'pick' | 'new' | 'auto';
  label: string;
  note: string | null;
};

/** How long a newly listed card (addedOn, set by the sheet sync on the day it first appears) gets an empty slot. */
export const NEW_DAYS = 30;

// When a slot has nothing booked and no new card is waiting, it shows these, skipping cards already on screen.
const AUTO: { label: string; note: (c: Card) => string; match: (c: Card) => boolean }[] = [
  { label: 'Top ranked', note: (c) => `The highest G2M score right now: ${c.score.total}.`, match: () => true },
  { label: 'Best with no annual fee', note: () => 'The best-scored card that costs nothing a year.', match: (c) => c.fees.annualUsd === 0 },
  {
    label: 'Best non-custodial',
    note: () => 'The best-scored card where you keep control of your funds.',
    match: (c) => c.custody === 'self-custodial' || c.custody === 'both'
  }
];

const daysBetween = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;

/**
 * The three "Our picks" slots for today. Bookings come from the sheet's Picks tab (data/picks.json): a slot's first
 * booking whose dates include today (UTC; no dates = always) wins. Slots left over go to cards added in the last
 * NEW_DAYS days (newest first), then to the automatic picks. Nothing here changes a card's score or rank.
 * `cards` must be in rank order.
 */
export function getPicks(cards: Card[], now = new Date()): HomePick[] {
  const parsed = PicksSchema.safeParse(raw);
  const bookings = parsed.success ? parsed.data : [];
  const today = now.toISOString().slice(0, 10);
  const live = (p: (typeof bookings)[number]) => (!p.start || today >= p.start) && (!p.end || today <= p.end);
  const bySlug = new Map(cards.map((c) => [c.slug, c]));

  const booked = new Map<number, HomePick>();
  for (const p of bookings) {
    const card = bySlug.get(p.slug);
    if (!card || booked.has(p.slot) || !live(p)) continue;
    booked.set(p.slot, {
      slot: p.slot,
      card,
      kind: p.type === 'sponsored' ? 'featured' : 'pick',
      label: p.type === 'sponsored' ? 'Featured' : 'Our pick',
      note: p.note ?? null
    });
  }

  const used = new Set([...booked.values()].map((p) => p.card.slug));
  // Newly listed cards, newest first (not dated in the future).
  const fresh = cards
    .filter((c) => c.addedOn && daysBetween(c.addedOn, today) >= 0 && daysBetween(c.addedOn, today) < NEW_DAYS)
    .sort((a, b) => b.addedOn!.localeCompare(a.addedOn!));
  const rules = [...AUTO];

  const out: HomePick[] = [];
  for (const slot of [1, 2, 3]) {
    const b = booked.get(slot);
    if (b) {
      out.push(b);
      continue;
    }
    const newCard = fresh.find((c) => !used.has(c.slug));
    if (newCard) {
      used.add(newCard.slug);
      out.push({ slot, card: newCard, kind: 'new', label: 'New on G2M', note: 'Just added to G2M.' });
      continue;
    }
    while (rules.length) {
      const rule = rules.shift()!;
      const card = cards.find((c) => rule.match(c) && !used.has(c.slug));
      if (!card) continue;
      used.add(card.slug);
      out.push({ slot, card, kind: 'auto', label: rule.label, note: rule.note(card) });
      break;
    }
  }
  return out;
}
