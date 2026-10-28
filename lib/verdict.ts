import 'server-only';
import type { Card, Market } from '@/lib/types';
import { CUSTODY_LABEL, pct, usd } from '@/lib/format';
import { confirmedCountries } from '@/lib/score';
import { MARKET_LABELS } from '@/lib/regions';

// The plain-words verdict on the "X vs Y" pages, worked out from the card data only (no opinions typed by hand).

export type Point = { topic: string; text: string; winner: Card | null };

const MARKETS: Market[] = ['US', 'GB', 'EU', 'IN', 'AE'];
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Which of two numbers wins (`high` or `low`), or null when they are equal or one is missing. */
function winner(a: Card, b: Card, va: number | null | undefined, vb: number | null | undefined, better: 'high' | 'low') {
  if (va == null || vb == null || va === vb) return null;
  return (better === 'high' ? va > vb : va < vb) ? a : b;
}

export function versusPoints(a: Card, b: Card, total: number): Point[] {
  const points: Point[] = [];
  const other = (w: Card) => (w === a ? b : a);

  // Score
  {
    const w = winner(a, b, a.score.total, b.score.total, 'high');
    points.push({
      topic: 'score',
      winner: w,
      text: w
        ? `${w.name} scores higher on the G2M score: ${w.score.total}/100 against ${other(w).score.total}/100 (#${w.rank} and #${other(w).rank} of ${total} cards).`
        : `${a.name} and ${b.name} have the same G2M score: ${a.score.total}/100.`
    });
  }

  // Cashback on the entry tier (publishing a rate beats not publishing one, as in the score)
  {
    const [x, y] = [a.cashback.basePct, b.cashback.basePct];
    let text: string;
    let w: Card | null = null;
    if (x == null && y == null) text = 'Neither card publishes a cashback rate for its entry tier.';
    else if (x == null || y == null) {
      w = x == null ? b : a;
      text = `${w.name} pays ${pct(w.cashback.basePct)} cashback on its entry tier; ${other(w).name} does not publish a rate.`;
    } else if (x === y) text = `Both pay ${pct(x)} cashback on their entry tier.`;
    else {
      w = winner(a, b, x, y, 'high');
      text = `${w!.name} pays more cashback on its entry tier: ${pct(w!.cashback.basePct)} against ${pct(other(w!).cashback.basePct)}.`;
    }
    const tops = [a, b].filter((c) => c.cashback.maxPct != null && c.cashback.maxPct > (c.cashback.basePct ?? 0));
    if (tops.length) text += ` Higher tiers go up to ${list(tops.map((c) => `${pct(c.cashback.maxPct)} on ${c.name}`))}.`;
    points.push({ topic: 'cashback', winner: w, text });
  }

  // Annual fee
  {
    const [x, y] = [a.fees.annualUsd, b.fees.annualUsd];
    const w = winner(a, b, x, y, 'low');
    let text: string;
    if (x == null && y == null) text = 'Neither card publishes its annual fee.';
    else if (x == null || y == null) {
      const known = x == null ? b : a;
      text = `${known.name} ${known.fees.annualUsd === 0 ? 'has no annual fee' : `costs ${usd(known.fees.annualUsd)} a year`}; ${other(known).name} does not publish its annual fee.`;
    } else if (!w) text = x === 0 ? 'Neither card has an annual fee.' : `Both cost ${usd(x)} a year.`;
    else
      text =
        w.fees.annualUsd === 0
          ? `${w.name} has no annual fee; ${other(w).name} costs ${usd(other(w).fees.annualUsd)} a year.`
          : `${w.name} costs less a year: ${usd(w.fees.annualUsd)} against ${usd(other(w).fees.annualUsd)}.`;
    points.push({ topic: 'annual', winner: w, text });
  }

  // FX fee
  {
    const [x, y] = [a.fees.fxPct, b.fees.fxPct];
    const w = winner(a, b, x, y, 'low');
    let text: string;
    if (x == null && y == null) text = 'Neither card publishes its FX fee.';
    else if (x == null || y == null) {
      const known = x == null ? b : a;
      text = `${known.name} charges ${pct(known.fees.fxPct)} on foreign currency; ${other(known).name} does not publish its FX fee.`;
    } else if (!w) text = x === 0 ? 'Neither card charges an FX fee.' : `Both charge a ${pct(x)} FX fee on foreign currency.`;
    else text = `${w.name} charges less on foreign currency: a ${pct(w.fees.fxPct)} FX fee against ${pct(other(w).fees.fxPct)}.`;
    points.push({ topic: 'fx', winner: w, text });
  }

  // Countries
  {
    const [x, y] = [confirmedCountries(a), confirmedCountries(b)];
    const w = winner(a, b, x, y, 'high');
    // A card without a complete country list is only counted where it has confirmed so far, so "229 against 2" would mislead.
    const listed = (c: Card) => c.coverage.countryList?.others === 'no';
    let text =
      listed(a) !== listed(b)
        ? (() => {
            const l = listed(a) ? a : b;
            const n = confirmedCountries(other(l));
            return `${l.name} lists ${confirmedCountries(l)} countries where it works; ${other(l).name} does not publish a full country list${n ? ` (${n} confirmed so far)` : ''}.`;
          })()
        : x === 0 && y === 0
          ? 'Neither card has confirmed a country we can count yet.'
          : w
            ? `${w.name} is confirmed in more countries: ${w === a ? x : y} against ${w === a ? y : x}${listed(a) ? '' : ', though neither publishes a full list'}.`
            : `Both are confirmed in ${x} countries.`;
    const only = (c: Card) => MARKETS.filter((m) => c.coverage.markets[m] === 'yes' && other(c).coverage.markets[m] !== 'yes');
    const [oa, ob] = [only(a), only(b)];
    const names = (ms: Market[]) => list(ms.map((m) => MARKET_LABELS[m]));
    if (oa.length || ob.length)
      text += ` Of the markets we check for every card, ${[
        oa.length ? `only ${a.name} is confirmed in ${names(oa)}` : null,
        ob.length ? `only ${b.name} is confirmed in ${names(ob)}` : null
      ]
        .filter(Boolean)
        .join(', and ')}.`;
    points.push({ topic: 'countries', winner: w, text });
  }

  // Custody
  {
    const w = winner(a, b, a.score.control, b.score.control, 'high');
    const label = (c: Card) => CUSTODY_LABEL[c.custody].toLowerCase();
    const text =
      a.custody === b.custody
        ? a.custody === 'unknown'
          ? 'Neither card says who holds your funds.'
          : `Both are ${label(a)}.`
        : `${a.name} is ${label(a)}; ${b.name} is ${label(b)}.`;
    points.push({ topic: 'custody', winner: w, text });
  }

  return points;
}

const WIN_WORDS: Record<string, string> = {
  cashback: 'cashback',
  annual: 'a lower annual fee',
  fx: 'a lower FX fee',
  countries: 'more countries',
  custody: 'control of your funds'
};

/** One or two sentences for the top of the page and the search result: who scores higher and where each one wins. */
export function versusSummary(a: Card, b: Card, points: Point[]): string {
  const wins = (c: Card) => points.filter((p) => p.topic !== 'score' && p.winner === c).map((p) => WIN_WORDS[p.topic]);
  const [wa, wb] = [wins(a), wins(b)];
  const lead = points[0].text;
  if (wa.length && wb.length) return `${lead} Pick ${a.name} for ${list(wa)}; pick ${b.name} for ${list(wb)}.`;
  const w = wa.length ? a : wb.length ? b : null;
  if (w) return `${lead} ${w.name} ${points[0].winner === w ? 'also comes' : 'still comes'} out ahead on ${list(w === a ? wa : wb)}.`;
  return lead;
}
