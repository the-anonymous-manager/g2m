import 'server-only';
import raw from '@/data/cards.json';
import { validateCards } from '@/lib/card-schema.mjs';
import type { Card, CardData } from '@/lib/types';
import { rankIn, scoreCard } from '@/lib/score';
import { availabilityIn } from '@/lib/regions';
import { COUNTRY_CODES } from '@/lib/countries.mjs';

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

// A limited-time bonus replaces the regular sign-up bonus while it runs (checked against today's date on every
// request, so card pages drop it the day after it ends even before the next sync redeploys the site).
let viewDay = '';
let view: Card[] = cards;
function current(): Card[] {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== viewDay) {
    viewDay = today;
    view = cards.map((c) =>
      c.limitedBonus && c.limitedBonus.ends >= today ? { ...c, signupBonus: c.limitedBonus.text, bonusEnds: c.limitedBonus.ends } : c
    );
  }
  return view;
}

export function getCards(): Card[] {
  return current();
}

export function getCard(slug: string): Card | undefined {
  return current().find((c) => c.slug === slug);
}

/**
 * The card a broken address most likely meant, or null. Links cut off by email apps arrive as e.g.
 * "/cards/ethena-pa=" (a line break marked with "="): keep the part up to the first character a card ID
 * can't have, then accept it if it is the start of exactly one card ID.
 */
export function guessCard(raw: string): Card | null {
  let s = raw;
  try {
    s = decodeURIComponent(raw);
  } catch {
    // keep it as it came
  }
  const start = s.toLowerCase().match(/^[a-z0-9-]*/)![0].replace(/-+$/, '');
  if (start.length < 2) return null;
  const exact = getCard(start);
  if (exact) return exact;
  const matches = cards.filter((c) => c.slug.startsWith(start));
  return matches.length === 1 ? matches[0] : null;
}

export function getRank(slug: string): number {
  return cards.findIndex((c) => c.slug === slug) + 1;
}

export function lastUpdated(): string {
  return cards.reduce((latest, c) => (c.lastChecked > latest ? c.lastChecked : latest), '1970-01-01');
}

const rankedByCountry = new Map<string, Card[]>();
function rankedIn(cc: string): Card[] {
  let ranked = rankedByCountry.get(cc);
  if (!ranked) rankedByCountry.set(cc, (ranked = rankIn(cards, cc)));
  return ranked;
}

/** A card's standing in one country: score, rank, how many cards rank there, and y = confirmed or u = not confirmed. */
export type Standing = [score: number, rank: number, of: number, here: 'y' | 'u'];

/** One card's standing in every country where it is not ruled out (worked out at build time). */
export function standings(slug: string): Record<string, Standing> {
  const out: Record<string, Standing> = {};
  for (const cc of COUNTRY_CODES) {
    const ranked = rankedIn(cc);
    const card = ranked.find((c) => c.slug === slug);
    if (card) out[cc] = [card.score.total, card.rank, ranked.length, availabilityIn(card, cc) === 'yes' ? 'y' : 'u'];
  }
  return out;
}
