import 'server-only';
import raw from '@/data/picks.json';
import { PicksSchema } from '@/lib/card-schema.mjs';
import type { Card } from '@/lib/types';

export type HomePick = {
  slot: number;
  card: Card;
  /** sponsored = paid and labelled; pick = chosen by G2M; auto = filled in by the rules below. */
  kind: 'sponsored' | 'pick' | 'auto';
  label: string;
  note: string | null;
};

// When a slot has nothing booked today, it shows these, skipping cards already on screen.
const AUTO: { label: string; note: (c: Card) => string; match: (c: Card) => boolean }[] = [
  { label: 'Top ranked', note: (c) => `The highest G2M score right now: ${c.score.total}.`, match: () => true },
  { label: 'Best with no annual fee', note: () => 'The best-scored card that costs nothing a year.', match: (c) => c.fees.annualUsd === 0 },
  {
    label: 'Best self-custodial',
    note: () => 'The best-scored card where you keep control of your funds.',
    match: (c) => c.custody === 'self-custodial' || c.custody === 'both'
  }
];

/**
 * The three "Our picks" slots for today. Bookings come from the sheet's Picks tab (data/picks.json): a slot's first
 * booking whose dates include today (UTC; no dates = always) wins. Picks never change a card's score or rank.
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
      kind: p.type,
      label: p.type === 'sponsored' ? 'Sponsored' : 'Our pick',
      note: p.note ?? null
    });
  }

  const used = new Set([...booked.values()].map((p) => p.card.slug));
  const out: HomePick[] = [];
  for (const slot of [1, 2, 3]) {
    const b = booked.get(slot);
    if (b) {
      out.push(b);
      continue;
    }
    const rule = AUTO[slot - 1];
    const card = cards.find((c) => rule.match(c) && !used.has(c.slug)) ?? cards.find((c) => !used.has(c.slug));
    if (!card) continue;
    used.add(card.slug);
    out.push({ slot, card, kind: 'auto', label: rule.label, note: rule.note(card) });
  }
  return out;
}
