import type { CardRow } from '@/lib/types';
import { tierOffered } from '@/lib/regions';
import { buildSegments, isEntryTier, isOpenTier, tierValue, type CalcInput, type Segment, type TierResult } from '@/lib/calc';

// The best two-card wallet: one card for most spending, a second for the purchases it handles better (small
// purchases, US dollars, travel). Every pair of cards is tried with a few ways of splitting the spending, each card at
// its best tier for its share, and both cards' yearly fees are counted in full.

export type ComboSide = { card: CardRow; result: TierResult; spendYear: number };
export type Combo = {
  primary: ComboSide;
  second: ComboSide;
  /** Slices of spending that go on the second card. */
  toSecond: Segment[];
  total: number;
  single: { card: CardRow; result: TierResult };
  extra: number;
};

const sum = (segs: Segment[]) => segs.reduce((s, g) => s + g.spendYear, 0);

export function bestCombo(cards: CardRow[], input: CalcInput, country?: string | null): Combo | null {
  const segs = buildSegments(input).filter((g) => g.spendYear > 0);
  if (cards.length < 2 || !segs.length) return null;

  const tiersOf = (card: CardRow) =>
    card.tiers
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => !country || tierOffered(t, country))
      .filter(({ t, i }) => (input.tiers === 'entry' ? isEntryTier(t, i) : input.all ? !t.comingSoon : isOpenTier(t, i)));

  // Best tier of one card for a set of slices (memoised by card and slice set).
  const memo = new Map<string, TierResult | null>();
  const key = (subset: Segment[]) => subset.map((g) => segs.indexOf(g)).join(',');
  const best = (card: CardRow, subset: Segment[]): TierResult | null => {
    const k = `${card.slug}|${key(subset)}`;
    if (memo.has(k)) return memo.get(k)!;
    let top: TierResult | null = null;
    for (const { t, i } of tiersOf(card)) {
      const r = tierValue(card, t, input, i, country, subset);
      if (!top || r.net > top.net) top = r;
    }
    memo.set(k, top);
    return top;
  };

  // The best single card, for comparison.
  let single: { card: CardRow; result: TierResult } | null = null;
  for (const card of cards) {
    const r = best(card, segs);
    if (r && (!single || r.net > single.result.net)) single = { card, result: r };
  }
  if (!single) return null;

  // Ways to split: by purchase size, by currency, and both.
  const rules: ((g: Segment) => boolean)[] = [
    (g) => g.size < 25,
    (g) => g.part !== 'home',
    (g) => g.size < 25 || g.part !== 'home',
    (g) => g.part === 'travel',
    (g) => g.part === 'usd',
    (g) => g.size < 50
  ];
  const splits = rules
    .map((rule) => segs.filter(rule))
    .filter((b) => b.length > 0 && b.length < segs.length);

  // Each card's value per slice on its own (no yearly fee), to split a pair slice by slice.
  const fixedOf = (r: TierResult) => r.fee + r.oneTime;
  const marginal = new Map<string, number[]>();
  for (const card of cards) {
    const full = best(card, segs);
    if (!full) continue;
    const t = card.tiers[full.index];
    marginal.set(
      card.slug,
      segs.map((g) => {
        const r = tierValue(card, t, input, full.index, country, [g]);
        return r.net + fixedOf(r);
      })
    );
  }

  let top: Combo | null = null;
  const consider = (a: CardRow, b: CardRow, toB: Segment[]) => {
    const toA = segs.filter((g) => !toB.includes(g));
    if (!toA.length || !toB.length) return;
    const ra = best(a, toA);
    const rb = best(b, toB);
    if (!ra || !rb) return;
    const total = ra.net + rb.net;
    if (top && total <= top.total) return;
    const [primary, second, toSecond] =
      sum(toA) >= sum(toB)
        ? [{ card: a, result: ra, spendYear: sum(toA) }, { card: b, result: rb, spendYear: sum(toB) }, toB]
        : [{ card: b, result: rb, spendYear: sum(toB) }, { card: a, result: ra, spendYear: sum(toA) }, toA];
    top = { primary, second, toSecond, total, single: single!, extra: total - single!.result.net };
  };

  for (let x = 0; x < cards.length; x++) {
    for (let y = 0; y < cards.length; y++) {
      if (x === y) continue;
      const a = cards[x];
      const b = cards[y];
      for (const toB of splits) consider(a, b, toB);
      if (x < y) {
        const ma = marginal.get(a.slug);
        const mb = marginal.get(b.slug);
        if (ma && mb) consider(a, b, segs.filter((_, i) => mb[i] > ma[i]));
      }
    }
  }
  const found = top as Combo | null;
  return found && found.extra >= 1 ? found : null;
}

const PART_LABEL: Record<Segment['part'], string> = {
  home: 'your own currency',
  usd: 'US dollars online',
  travel: 'other currencies'
};

/** Plain words for the slices that go on the second card, e.g. "purchases under $25 · all spending in other currencies". */
export function describeSlices(toSecond: Segment[], all: Segment[]): string[] {
  const out: string[] = [];
  const sizes = [...new Set(all.map((g) => g.size))].sort((a, b) => a - b);
  for (const part of ['home', 'usd', 'travel'] as const) {
    const mine = toSecond.filter((g) => g.part === part).map((g) => g.size);
    const ofPart = all.filter((g) => g.part === part && g.spendYear > 0).map((g) => g.size);
    if (!mine.length) continue;
    if (mine.length === ofPart.length) {
      out.push(`all spending in ${PART_LABEL[part]}`);
      continue;
    }
    const max = Math.max(...mine);
    const contiguous = sizes.filter((z) => z <= max).every((z) => mine.includes(z) || !ofPart.includes(z));
    out.push(
      contiguous
        ? `purchases of $${max} or less in ${PART_LABEL[part]}`
        : `${mine.map((z) => `$${z}`).join(', ')} purchases in ${PART_LABEL[part]}`
    );
  }
  return out;
}
