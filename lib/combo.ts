import type { CardRow } from '@/lib/types';
import { tierOffered } from '@/lib/regions';
import { buildSegments, isEntryTier, isOpenTier, tierValue, type CalcInput, type Segment, type TierResult } from '@/lib/calc';
import { FEATURES, featuresOf, type FeatureKey } from '@/lib/features';

// The best two-card wallet: one card for most spending, a second for the purchases it handles better (small
// purchases, US dollars, travel), and between them every feature the visitor must have (lounges, yield, borrowing,
// a bank account...). Every pair of cards is tried with several ways of splitting the spending and every tier
// combination; both cards' yearly fees are counted in full. Ranked by money kept a year.

export type ComboSide = { card: CardRow; result: TierResult; spendYear: number; features: Set<FeatureKey> };
export type Combo = {
  primary: ComboSide;
  second: ComboSide;
  /** Slices of spending that go on the second card. */
  toSecond: Segment[];
  total: number;
  /** Total minus the best single card's (can be negative when a must-have needs the second card). */
  extra: number;
};
export type SingleChoice = { card: CardRow; result: TierResult; features: Set<FeatureKey> };
export type WalletPlan = {
  combos: Combo[];
  /** The best single card for money, ignoring must-haves. */
  single: SingleChoice | null;
  /** The best single card that has every must-have on its own. */
  singleCovering: SingleChoice | null;
};

const sum = (segs: Segment[]) => segs.reduce((s, g) => s + g.spendYear, 0);
const covers = (have: Set<FeatureKey>, need: FeatureKey[]) => need.every((k) => have.has(k));

export function planWallet(cards: CardRow[], input: CalcInput, country?: string | null, need: FeatureKey[] = [], limit = 3): WalletPlan {
  const segs = buildSegments(input).filter((g) => g.spendYear > 0);
  const empty: WalletPlan = { combos: [], single: null, singleCovering: null };
  if (!cards.length || !segs.length) return empty;

  const tiersOf = (card: CardRow) =>
    card.tiers
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => !country || tierOffered(t, country))
      .filter(({ t, i }) => (input.tiers === 'entry' ? isEntryTier(t, i) : input.all ? !t.comingSoon : isOpenTier(t, i)));

  // Every allowed tier of one card on a set of slices (memoised by card and slice set).
  const memo = new Map<string, TierResult[]>();
  const options = (card: CardRow, subset: Segment[]): TierResult[] => {
    const k = `${card.slug}|${subset.map((g) => segs.indexOf(g)).join(',')}`;
    let out = memo.get(k);
    if (!out) {
      out = tiersOf(card).map(({ t, i }) => tierValue(card, t, input, i, country, subset));
      memo.set(k, out);
    }
    return out;
  };
  const feats = new Map<string, Set<FeatureKey>>();
  const featuresFor = (card: CardRow, r: TierResult) => {
    const k = `${card.slug}|${r.index}`;
    let f = feats.get(k);
    if (!f) feats.set(k, (f = featuresOf(card, r.tier)));
    return f;
  };

  // Best single card, overall and with every must-have.
  let single: SingleChoice | null = null;
  let singleCovering: SingleChoice | null = null;
  for (const card of cards) {
    for (const r of options(card, segs)) {
      const f = featuresFor(card, r);
      if (!single || r.net > single.result.net) single = { card, result: r, features: f };
      if (covers(f, need) && (!singleCovering || r.net > singleCovering.result.net)) singleCovering = { card, result: r, features: f };
    }
  }
  if (!single) return empty;
  if (cards.length < 2) return { combos: [], single, singleCovering };

  // Ways to split: by purchase size, by currency, both, and slice by slice (per pair).
  const rules: ((g: Segment) => boolean)[] = [
    (g) => g.size < 25,
    (g) => g.part !== 'home',
    (g) => g.size < 25 || g.part !== 'home',
    (g) => g.part === 'travel',
    (g) => g.part === 'usd',
    (g) => g.size < 50,
    (g) => g.size >= 100
  ];
  const splits = rules.map((rule) => segs.filter(rule)).filter((b) => b.length > 0 && b.length < segs.length);

  // Each card's value per slice on its own (yearly fee left out), to split a pair slice by slice.
  const marginal = new Map<string, number[]>();
  for (const card of cards) {
    const full = options(card, segs).reduce<TierResult | null>((a, r) => (!a || r.net > a.net ? r : a), null);
    if (!full) continue;
    marginal.set(
      card.slug,
      segs.map((g) => {
        const r = tierValue(card, full.tier, input, full.index, country, [g]);
        return r.net + r.fee + r.oneTime;
      })
    );
  }

  // Best combo per pair of cards.
  const bestPerPair = new Map<string, Combo>();
  const consider = (a: CardRow, b: CardRow, toB: Segment[]) => {
    const toA = segs.filter((g) => !toB.includes(g));
    if (!toA.length || !toB.length) return;
    const pairKey = [a.slug, b.slug].sort().join('+');
    for (const ra of options(a, toA)) {
      for (const rb of options(b, toB)) {
        const fa = featuresFor(a, ra);
        const fb = featuresFor(b, rb);
        if (need.length && !covers(new Set([...fa, ...fb]), need)) continue;
        const total = ra.net + rb.net;
        const prev = bestPerPair.get(pairKey);
        if (prev && total <= prev.total) continue;
        const sideA: ComboSide = { card: a, result: ra, spendYear: sum(toA), features: fa };
        const sideB: ComboSide = { card: b, result: rb, spendYear: sum(toB), features: fb };
        const aMain = sideA.spendYear >= sideB.spendYear;
        bestPerPair.set(pairKey, {
          primary: aMain ? sideA : sideB,
          second: aMain ? sideB : sideA,
          toSecond: aMain ? toB : toA,
          total,
          extra: total - single!.result.net
        });
      }
    }
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

  const combos = [...bestPerPair.values()].sort((p, q) => q.total - p.total).slice(0, limit);
  return { combos, single, singleCovering };
}

/** Back-compat: the single best combo when it beats the best single card by $1 or more. */
export function bestCombo(cards: CardRow[], input: CalcInput, country?: string | null) {
  const plan = planWallet(cards, input, country, [], 1);
  const top = plan.combos[0];
  return top && top.extra >= 1 ? { ...top, single: plan.single! } : null;
}

const PART_LABEL: Record<Segment['part'], string> = {
  home: 'your own currency',
  usd: 'US dollars online',
  travel: 'other currencies'
};

/**
 * The slices that go on the second card, as facts: all of one part (`all`), purchases up to (`max`) or from (`min`) a
 * size, or a list of sizes (`list`, in US dollars). `describeSlices` words them in English; other languages use these.
 */
export type SlicePart = { part: Segment['part']; kind: 'all' | 'max' | 'min' | 'list'; sizes: number[] };

export function sliceParts(toSecond: Segment[], all: Segment[]): SlicePart[] {
  const out: SlicePart[] = [];
  const sizes = [...new Set(all.map((g) => g.size))].sort((a, b) => a - b);
  for (const part of ['home', 'usd', 'travel'] as const) {
    const mine = toSecond.filter((g) => g.part === part).map((g) => g.size);
    const ofPart = all.filter((g) => g.part === part && g.spendYear > 0).map((g) => g.size);
    if (!mine.length) continue;
    if (mine.length === ofPart.length) {
      out.push({ part, kind: 'all', sizes: [] });
      continue;
    }
    const max = Math.max(...mine);
    const min = Math.min(...mine);
    const below = sizes.filter((z) => z <= max).every((z) => mine.includes(z) || !ofPart.includes(z));
    const above = sizes.filter((z) => z >= min).every((z) => mine.includes(z) || !ofPart.includes(z));
    out.push(below ? { part, kind: 'max', sizes: [max] } : above ? { part, kind: 'min', sizes: [min] } : { part, kind: 'list', sizes: mine });
  }
  return out;
}

/** Plain words for the slices that go on the second card, e.g. "purchases under $25 · all spending in other currencies". */
export function describeSlices(toSecond: Segment[], all: Segment[]): string[] {
  return sliceParts(toSecond, all).map(({ part, kind, sizes }) =>
    kind === 'all'
      ? `all spending in ${PART_LABEL[part]}`
      : kind === 'max'
        ? `purchases of $${sizes[0]} or less in ${PART_LABEL[part]}`
        : kind === 'min'
          ? `purchases of $${sizes[0]} or more in ${PART_LABEL[part]}`
          : `${sizes.map((z) => `$${z}`).join(', ')} purchases in ${PART_LABEL[part]}`
  );
}

/** Features a combo gives you that the other card does not, for "what each card brings". */
export function brings(side: ComboSide, other: ComboSide): FeatureKey[] {
  return FEATURES.map((f) => f.key).filter((k) => side.features.has(k) && !other.features.has(k));
}
