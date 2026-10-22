import 'server-only';
import raw from '@/data/cards.json';
import { validateCards } from '@/lib/card-schema.mjs';
import type { Card, CardData } from '@/lib/types';
import { scoreCard } from '@/lib/score';

// Validate once per server process. Invalid cards are skipped with a warning,
// so one bad edit in cards.json can never take the whole site down.
const { valid, errors } = validateCards(raw);
if (errors.length) {
  console.warn(`[g2m] Skipped ${errors.length} invalid card(s). Run "npm run validate" for details.`);
  for (const e of errors) console.warn(`[g2m]   ${e.card}: ${e.issues.join('; ')}`);
}

const cards: Card[] = (valid as CardData[])
  .map((card) => ({ ...card, score: scoreCard(card) }))
  .sort((a, b) => b.score.total - a.score.total)
  .map((card, i) => ({ ...card, rank: i + 1 }));

export function getCards(): Card[] {
  return cards;
}

export function getCard(slug: string): Card | undefined {
  return cards.find((c) => c.slug === slug);
}

export function getRank(slug: string): number {
  return cards.findIndex((c) => c.slug === slug) + 1;
}

export function lastUpdated(): string {
  return cards.reduce((latest, c) => (c.lastChecked > latest ? c.lastChecked : latest), '1970-01-01');
}
