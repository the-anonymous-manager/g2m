// "X vs Y" comparison pages: one address per pair of cards, with the two card IDs in alphabetical order.

/** The page for two cards, e.g. /compare/kast-vs-tria (same page whichever order they are given in). */
export function versusPath(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return `/compare/${x}-vs-${y}`;
}

/** The two card IDs in a "kast-vs-tria" address, or null when it is not one. */
export function parseVersus(pair: string): [string, string] | null {
  const parts = pair.toLowerCase().split('-vs-');
  if (parts.length !== 2 || !parts[0] || !parts[1] || parts[0] === parts[1]) return null;
  return [parts[0], parts[1]];
}

/** Every pair of cards once, in the order given (rank order keeps the best-known pairs first). */
export function allPairs<T extends { slug: string }>(cards: T[]): [T, T][] {
  return cards.flatMap((a, i) => cards.slice(i + 1).map((b): [T, T] => [a, b]));
}

/** A card's short name for titles: "ether.fi Cash Card" → "ether.fi", "Krak Card" → "Krak", "Ethena Pay" stays. */
export const shortName = (name: string) => name.replace(/ (Visa |Cash )?Card$/, '');

/**
 * The search-result title of an "X vs Y" page. Search results cut titles at about 60 characters, so the longest
 * wording that fits (with the " · G2M" the site adds) is used.
 */
export function versusTitle(a: string, b: string, year: number): string {
  const pair = `${shortName(a)} vs ${shortName(b)}`;
  const options = [`${pair} Card: Fees & Cashback (${year})`, `${pair}: Fees & Cashback (${year})`, `${pair} (${year})`];
  return options.find((t) => t.length + ' · G2M'.length <= 60) ?? options[options.length - 1];
}
