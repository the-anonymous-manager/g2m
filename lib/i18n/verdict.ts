import 'server-only';
import type { Card } from '@/lib/types';
import { confirmedCountries } from '@/lib/score';
import { versusPoints } from '@/lib/verdict';
import { fill } from './locales';
import type { Dict } from './dict';
import type { Fmt } from './format';

// The "X vs Y" verdict in another language. Who wins each point comes from lib/verdict.ts, so the translated pages
// always agree with the English ones; only the sentences are built here, from the dictionary.

export type IntlPoint = { topic: string; text: string; winner: Card | null };

export function intlVersusPoints(a: Card, b: Card, total: number, d: Dict, f: Fmt): IntlPoint[] {
  const winners = Object.fromEntries(versusPoints(a, b, total).map((p) => [p.topic, p.winner]));
  const other = (w: Card) => (w === a ? b : a);
  const n = f.name;
  const points: IntlPoint[] = [];

  {
    const w = winners.score;
    points.push({
      topic: 'score',
      winner: w,
      text: w ? fill(d.vsScoreWin, { w: n(w.name), x: w.score.total, y: other(w).score.total }) : fill(d.vsScoreTie, { x: a.score.total })
    });
  }

  {
    const [x, y] = [a.cashback.basePct, b.cashback.basePct];
    const w = winners.cashback;
    let text: string;
    if (x == null && y == null) text = d.vsCbNone;
    else if (x == null || y == null) {
      const k = x == null ? b : a;
      text = fill(d.vsCbOne, { w: n(k.name), x: f.pct(k.cashback.basePct!) });
    } else if (x === y) text = fill(d.vsCbTie, { x: f.pct(x) });
    else text = fill(d.vsCbWin, { w: n(w!.name), x: f.pct(w!.cashback.basePct!), y: f.pct(other(w!).cashback.basePct!) });
    points.push({ topic: 'cashback', winner: w, text });
  }

  const fee = (
    topic: 'annual' | 'fx',
    get: (c: Card) => number | null | undefined,
    fmt: (v: number) => string,
    k: { none: string; one: string; tieNone: string; tie: string; free: string; win: string }
  ) => {
    const [x, y] = [get(a), get(b)];
    const w = winners[topic];
    let text: string;
    if (x == null && y == null) text = k.none;
    else if (x == null || y == null) {
      const known = x == null ? b : a;
      text = fill(k.one, { w: n(known.name), x: get(known) === 0 ? d.free : fmt(get(known)!) });
    } else if (!w) text = x === 0 ? k.tieNone : fill(k.tie, { x: fmt(x) });
    else if (get(w) === 0) text = fill(k.free, { w: n(w.name), y: fmt(get(other(w))!) });
    else text = fill(k.win, { w: n(w.name), x: fmt(get(w)!), y: fmt(get(other(w))!) });
    points.push({ topic, winner: w, text });
  };
  fee('annual', (c) => c.fees.annualUsd, f.usd, {
    none: d.vsFeeNone,
    one: d.vsFeeOne,
    tieNone: d.vsFeeTieNone,
    tie: d.vsFeeTie,
    free: d.vsFeeFree,
    win: d.vsFeeWin
  });
  fee('fx', (c) => c.fees.fxPct, f.pct, { none: d.vsFxNone, one: d.vsFxOne, tieNone: d.vsFxTieNone, tie: d.vsFxTie, free: d.vsFxFree, win: d.vsFxWin });

  points.push({
    topic: 'countries',
    winner: winners.countries,
    text: fill(d.vsCountries, { a: n(a.name), x: f.num(confirmedCountries(a)), b: n(b.name), y: f.num(confirmedCountries(b)) })
  });
  points.push({
    topic: 'custody',
    winner: winners.custody,
    text:
      a.custody === b.custody
        ? fill(d.vsCustodySame, { x: f.custody(a) })
        : fill(d.vsCustodyDiff, { a: n(a.name), x: f.custody(a), b: n(b.name), y: f.custody(b) })
  });
  return points;
}

/** The words for what a card does better, for "Better on: ..." on the alternatives pages. */
export function winWords(d: Dict): Record<string, string> {
  return { cashback: d.winCashback, annual: d.winAnnual, fx: d.winFx, countries: d.winCountries, custody: d.winCustody };
}
