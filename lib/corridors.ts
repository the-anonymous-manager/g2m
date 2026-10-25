import type { CardRow } from '@/lib/types';

// Bank rails a card supports (sheet "Banking rails"), and which cards can move a stablecoin to a bank on a chosen rail.

export type Rail = NonNullable<CardRow['bankRails']>[number];

/** Destinations shown first in the finder, in this order. Each matches every rail in that currency. */
export const MAIN_DESTINATIONS = [
  { id: 'EUR', label: 'EUR · SEPA (Europe)' },
  { id: 'USD', label: 'USD · ACH or US bank' },
  { id: 'GBP', label: 'GBP · Faster Payments (UK)' },
  { id: 'AED', label: 'AED · UAE bank' },
  { id: 'INR', label: 'INR · Indian bank or UPI' },
  { id: 'SWIFT', label: 'Global · SWIFT wire' }
] as const;

const METHOD: Record<string, string> = {
  SEPA: 'SEPA',
  ACH: 'ACH',
  WIRE: 'wire',
  FPS: 'Faster Payments',
  PIX: 'Pix',
  SPEI: 'SPEI',
  UPI: 'UPI',
  BANK: 'bank transfer'
};

/** "EUR_SEPA" -> "EUR SEPA", "INR_UPI" -> "INR UPI", "SWIFT" -> "SWIFT wire". */
export function railLabel(rail: string): string {
  if (rail === 'SWIFT') return 'SWIFT wire';
  const [cur, method] = rail.split('_');
  return `${cur} ${METHOD[method] ?? method.toLowerCase()}`;
}

/** Every destination in the data: the main six, then other currencies A to Z. */
export function destinations(cards: CardRow[]): { id: string; label: string }[] {
  const main = new Set<string>(MAIN_DESTINATIONS.map((d) => d.id));
  const others = new Set<string>();
  for (const c of cards) for (const r of c.bankRails ?? []) if (r.rail !== 'SWIFT' && !main.has(r.rail.slice(0, 3))) others.add(r.rail.slice(0, 3));
  return [...MAIN_DESTINATIONS, ...[...others].sort().map((cur) => ({ id: cur, label: `${cur} · local bank` }))];
}

const matches = (r: Rail, dest: string) => (dest === 'SWIFT' ? r.rail === 'SWIFT' : r.rail.startsWith(`${dest}_`));

export type CorridorMatch = {
  card: CardRow;
  rails: Rail[];
  /** A bank can send you money on this rail: account details in your name, shared (reference code), or not stated. */
  receive: 'named' | 'shared' | 'account' | null;
  /** You can cash out to a bank on this rail. */
  cashOut: boolean;
  fees: string[];
  /** On the card's list of supported coins; "no" when the list is known and leaves it out; "not stated" with no list. */
  coin: 'listed' | 'no' | 'not stated';
};

/** Cards that support a destination, cash-out first, then named accounts, then the G2M score. */
export function corridorMatches(cards: CardRow[], dest: string, coin: 'USDC' | 'USDT'): CorridorMatch[] {
  const out: CorridorMatch[] = [];
  for (const card of cards) {
    const rails = (card.bankRails ?? []).filter((r) => matches(r, dest));
    if (!rails.length) continue;
    const anyIn = rails.some((r) => r.in);
    const iban = card.ecosystem?.iban;
    out.push({
      card,
      rails,
      receive: anyIn ? (iban === 'named' ? 'named' : iban === 'shared' ? 'shared' : 'account') : null,
      cashOut: rails.some((r) => r.out),
      fees: rails.filter((r) => r.fee).map((r) => `${railLabel(r.rail)}: ${r.fee}`),
      coin: card.assets.includes(coin) ? 'listed' : card.assets.length ? 'no' : 'not stated'
    });
  }
  const rank = (m: CorridorMatch) => (m.cashOut ? 2 : 0) + (m.receive === 'named' ? 1 : 0);
  return out.sort((a, b) => rank(b) - rank(a) || b.card.score.total - a.card.score.total);
}
