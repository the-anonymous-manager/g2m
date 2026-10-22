import type { CardRow, Market } from '@/lib/types';
import { isMarket, MARKET_LABELS } from '@/lib/regions';
import { cashbackLabel, pct } from '@/lib/format';
import { netRate } from '@/lib/score';

export type Hold = 'self' | 'exchange' | 'any';
export type Priority = 'cashback' | 'fees' | 'travel' | 'perks';
export type FinderAnswers = { market: Market | 'OTHER'; hold: Hold; priority: Priority };

export type Pick = { card: CardRow; fit: number; reasons: string[]; caution: string | null };

const allPerks = (c: CardRow) => Array.from(new Set([...c.perks, ...c.tiers.flatMap((t) => t.perks)]));
const hasLounge = (c: CardRow) => allPerks(c).some((p) => /lounge/i.test(p));

export function parseAnswers(p: Record<string, string | string[] | undefined>): FinderAnswers | null {
  const one = (k: string) => {
    const v = p[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const m = one('m').toUpperCase();
  const h = one('h');
  const pr = one('p');
  const market = m === 'OTHER' ? 'OTHER' : isMarket(m) ? m : null;
  const hold = h === 'self' || h === 'exchange' || h === 'any' ? h : null;
  const priority = pr === 'cashback' || pr === 'fees' || pr === 'travel' || pr === 'perks' ? pr : null;
  if (!market || !hold || !priority) return null;
  return { market, hold, priority };
}

/** Three cards that fit the answers, with plain reasons. Cards not available in the market are left out. */
export function recommend(cards: CardRow[], a: FinderAnswers, count = 3): Pick[] {
  const picks: Pick[] = [];
  for (const c of cards) {
    const reasons: string[] = [];
    let caution: string | null = null;
    let fit = c.score.total * 0.4;

    if (a.market !== 'OTHER') {
      const av = c.coverage.markets[a.market];
      if (av === 'no') continue;
      if (av === 'yes') {
        fit += 20;
        reasons.push(`Confirmed for ${MARKET_LABELS[a.market]}`);
      } else {
        fit -= 20;
        caution = `${MARKET_LABELS[a.market]} is not confirmed by the issuer yet. Check before you apply.`;
      }
    }

    if (a.hold === 'self') {
      if (c.custody === 'self-custodial') {
        fit += 15;
        reasons.push('You keep control of your funds');
      } else if (c.custody === 'custodial') fit -= 15;
    } else if (a.hold === 'exchange' && c.custody === 'custodial') {
      fit += 4;
    }

    const typical = netRate(c);
    if (a.priority === 'cashback') {
      fit += Math.min(typical * 8, 40) + Math.min(c.cashback.maxPct ?? 0, 10);
      if (c.cashback.basePct != null || c.cashback.maxPct != null) {
        reasons.push(`${cashbackLabel(c.cashback.basePct, c.cashback.maxPct)} back`);
      }
    } else if (a.priority === 'fees') {
      fit += c.score.fees * 1.2 + (c.fees.annualUsd === 0 ? 5 : 0);
      if (c.fees.annualUsd === 0) reasons.push('No annual fee');
      if (c.fees.fxPct != null) reasons.push(`${pct(c.fees.fxPct)} FX fee`);
    } else if (a.priority === 'travel') {
      const fx = c.fees.fxPct;
      fit += fx == null ? 0 : fx === 0 ? 20 : fx <= 1 ? 12 : fx <= 1.5 ? 8 : fx <= 2 ? 4 : 0;
      if (fx != null) reasons.push(fx === 0 ? 'No FX fee abroad' : `${pct(fx)} FX fee abroad`);
      if (hasLounge(c)) {
        fit += 10;
        reasons.push('Airport lounge access');
      }
      if ((c.coverage.countries ?? 0) >= 80) {
        fit += 6;
        reasons.push(`Issued in ${c.coverage.countries} countries`);
      }
    } else {
      const perks = allPerks(c);
      fit += Math.min(perks.length * 2, 10) + (hasLounge(c) ? 12 : 0) + (c.forms.includes('metal') ? 6 : 0);
      if (hasLounge(c)) reasons.push('Airport lounge access');
      if (c.forms.includes('metal')) reasons.push('Metal card available');
      if (perks.length && !hasLounge(c)) reasons.push(perks[0]);
    }

    if (!reasons.length) reasons.push(`G2M score ${c.score.total}`);
    picks.push({ card: c, fit, reasons: reasons.slice(0, 3), caution });
  }
  return picks.sort((x, y) => y.fit - x.fit || y.card.score.total - x.card.score.total).slice(0, count);
}
