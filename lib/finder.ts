import type { CardRow } from '@/lib/types';
import { availabilityIn, countryName, isCountry } from '@/lib/regions';
import { cashbackLabel, pct } from '@/lib/format';
import { netRate, rankIn } from '@/lib/score';
import { homeFx } from '@/lib/fx';
import { nomadFit, type NomadFit } from '@/lib/nomad';

export type Hold = 'self' | 'exchange' | 'any';
export type Priority = 'cashback' | 'fees' | 'travel' | 'perks';
/** How the visitor wants to use the card or balance (question 4). Empty = no preference. */
export type Use = 'wallets' | 'physical' | 'credit' | 'yield';
/** Fees, staking and banking (question 5): free tiers only, open to paid or staking tiers, a bank account needed. */
export type Money = 'free' | 'paid' | 'bank';
/**
 * country: where the visitor lives (ISO code), or 'ALL' when they would rather not say. passport: the passport they
 * hold when it is from another country (nomad mode). priorities: one or more. uses and money: empty = no preference
 * (links made before questions 4 and 5 existed).
 */
export type FinderAnswers = { country: string; hold: Hold; priorities: Priority[]; uses: Use[]; money: Money[]; passport?: string };

/**
 * Why a card was picked, as facts rather than sentences, so every language can word them (`whyEn` is the English).
 * `cc`: country code; `cur`: currency code; `p`: a percentage; `text`: a perk as typed in the sheet.
 */
export type Why =
  | { k: 'confirmed'; cc: string }
  | { k: 'self' | 'free' | 'ibanNamed' | 'ibanShared' | 'payout' | 'noAnnual' | 'fxAbroadNone' | 'lounge' | 'metal' }
  | { k: 'use'; use: Use }
  | { k: 'cashback'; base: number | null; max: number | null }
  | { k: 'fxHome'; p: number; cur: string }
  | { k: 'fx' | 'fxAbroad' | 'paid'; p: number }
  | { k: 'countries' | 'score'; n: number }
  | { k: 'perk'; text: string };

/** caution: the country (code) the issuer has not confirmed yet. */
export type Pick = { card: CardRow; fit: number; reasons: string[]; why: Why[]; caution: string | null; cautionCc: string | null; nomad: NomadFit | null };

/** One reason in English, as the finder has always written it. */
export function whyEn(w: Why): string {
  switch (w.k) {
    case 'confirmed':
      return `Confirmed for ${countryName(w.cc)}`;
    case 'self':
      return 'You keep control of your funds';
    case 'free':
      return 'Free, with no token to stake';
    case 'ibanNamed':
      return 'A bank account (IBAN) in your name';
    case 'ibanShared':
      return 'A bank account (IBAN) to receive money';
    case 'payout':
      return 'Sends money to your bank';
    case 'use':
      return USE_REASON[w.use];
    case 'cashback':
      return `${w.max == null && w.base != null ? pct(w.base) : cashbackLabel(w.base, w.max)} back`;
    case 'noAnnual':
      return 'No annual fee';
    case 'fxHome':
      return w.p === 0 ? `No FX fee on your ${w.cur} spending` : `${pct(w.p)} FX fee on your ${w.cur} spending`;
    case 'fx':
      return `${pct(w.p)} FX fee`;
    case 'fxAbroadNone':
      return 'No FX fee abroad';
    case 'fxAbroad':
      return `${pct(w.p)} FX fee abroad`;
    case 'lounge':
      return 'Airport lounge access';
    case 'countries':
      return `Issued in ${w.n} countries`;
    case 'metal':
      return 'Metal card available';
    case 'perk':
      return w.text;
    case 'paid':
      return `Up to ${pct(w.p)} on a paid or staking tier`;
    case 'score':
      return `G2M score ${w.n}`;
  }
}

export const PRIORITIES: Priority[] = ['cashback', 'fees', 'travel', 'perks'];
export const USES: Use[] = ['wallets', 'physical', 'credit', 'yield'];
export const MONEY: Money[] = ['free', 'paid', 'bank'];

const allPerks = (c: CardRow) => Array.from(new Set([...c.perks, ...c.tiers.flatMap((t) => t.perks)]));
const hasLounge = (c: CardRow) => allPerks(c).some((p) => /lounge/i.test(p));

/** A comma list from the link, keeping only known values, in their usual order. */
const listOf = <T extends string>(raw: string, known: readonly T[]): T[] => {
  const got = new Set(raw.split(',').map((s) => s.trim()));
  return known.filter((k) => got.has(k));
};

/** The finder's answers as link params (m, h, p, u, f, pp), so a shared link reopens the same matches. */
export function finderParams(a: FinderAnswers): string {
  const p = new URLSearchParams({ m: a.country, h: a.hold, p: a.priorities.join(','), u: a.uses.length ? a.uses.join(',') : 'none' });
  if (a.money.length) p.set('f', a.money.join(','));
  if (a.passport) p.set('pp', a.passport);
  return p.toString().replace(/%2C/g, ',');
}

export function parseAnswers(p: Record<string, string | string[] | undefined>): FinderAnswers | null {
  const one = (k: string) => {
    const v = p[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const m = one('m').toUpperCase();
  const h = one('h');
  // Older links used OTHER for "somewhere else" and EU for the whole EU (not one country, so asked again).
  const country = m === 'ALL' || m === 'OTHER' ? 'ALL' : isCountry(m) ? m : null;
  const hold = h === 'self' || h === 'exchange' || h === 'any' ? h : null;
  const priorities = listOf(one('p'), PRIORITIES);
  if (!country || !hold || !priorities.length) return null;
  // Links from the three-question finder have no u or f: no preference on either.
  const uses = listOf(one('u'), USES);
  let money = listOf(one('f'), MONEY);
  if (money.includes('free') && money.includes('paid')) money = money.filter((x) => x !== 'paid');
  const pp = one('pp').toUpperCase();
  return { country, hold, priorities, uses, money, ...(isCountry(pp) && pp !== country ? { passport: pp } : {}) };
}

/**
 * Three cards that fit the answers, with plain reasons. With a country, cards not available there are left out,
 * scores are the ones for that country, and fees include FX on everyday spending in its currency.
 */
export function recommend(cards: CardRow[], a: FinderAnswers, count = 3): Pick[] {
  const here = a.country === 'ALL' ? null : a.country;
  const place = here ? countryName(here) : null;
  const pool = here ? rankIn(cards, here) : cards;
  const picks: Pick[] = [];
  for (const c of pool) {
    // Nomad mode: leave out cards whose ID rules the passport cannot pass.
    const nomad = here ? nomadFit(c, a.passport ?? '', here) : null;
    if (nomad && !nomad.ok) continue;
    const reasons: Why[] = [];
    let caution: string | null = null;
    let fit = c.score.total * 0.4;

    if (here) {
      if (availabilityIn(c, here) === 'yes') {
        fit += 20;
        reasons.push({ k: 'confirmed', cc: here });
      } else {
        fit -= 20;
        caution = `${place} is not confirmed by the issuer yet. Check before you apply.`;
      }
    }
    // FX on everyday spending at home: none when the card bills in the local currency.
    const home = here ? homeFx(c, null, here) : null;

    if (a.hold === 'self') {
      if (c.custody === 'self-custodial' || c.custody === 'both') {
        fit += 15;
        reasons.push({ k: 'self' });
      } else if (c.custody === 'custodial') fit -= 15;
    } else if (a.hold === 'exchange' && (c.custody === 'custodial' || c.custody === 'both')) {
      fit += 4;
    }

    // Question 3: each chosen priority counts equally (their average), so picking two never doubles its weight.
    const freeOnly = a.money.includes('free');
    const parts = a.priorities.map((p) => priorityFit(c, p, home, freeOnly));
    fit += parts.reduce((s, x) => s + x.fit, 0) / Math.max(parts.length, 1);
    // Shown after what the visitor asked the card to have (questions 4 and 5), taking turns so every priority shows.
    const priorityReasons: Why[] = [];
    for (let k = 0; k < Math.max(0, ...parts.map((x) => x.reasons.length)); k++) {
      for (const x of parts) if (x.reasons[k]) priorityReasons.push(x.reasons[k]);
    }
    let paidReason: Why | null = null;

    // Question 4: what the card must do. Each one asked for and missing counts against the card.
    for (const u of a.uses) {
      const has = USE_CHECK[u](c);
      fit += has ? USE_WEIGHT[u].yes : -USE_WEIGHT[u].no;
      if (has) reasons.push({ k: 'use', use: u });
    }

    // Question 5: fees, staking and banking.
    const entry = c.tiers.find((t) => !t.comingSoon) ?? c.tiers[0];
    if (freeOnly) {
      const freeEntry = c.fees.annualUsd === 0 && !entry?.stake;
      if (freeEntry) {
        fit += 10;
        reasons.push({ k: 'free' });
      } else fit -= c.fees.annualUsd == null ? 6 : entry?.stake ? 14 : 20;
    } else if (a.money.includes('paid')) {
      // Higher tiers count: the best published rate weighs more than for a free-tiers-only visitor.
      const extra = (c.cashback.maxPct ?? 0) - (c.cashback.basePct ?? 0);
      if (extra > 0) {
        fit += Math.min(extra * 2, 10);
        if (c.cashback.maxPct != null) paidReason = { k: 'paid', p: c.cashback.maxPct };
      }
    }
    if (a.money.includes('bank')) {
      const eco = c.ecosystem;
      const iban = eco?.iban === 'named' || eco?.iban === 'shared';
      const payout = (eco?.payoutCorridors ?? 0) >= 1;
      if (iban || payout) {
        fit += iban ? 14 : 10;
        reasons.push({ k: iban ? (eco?.iban === 'named' ? 'ibanNamed' : 'ibanShared') : 'payout' });
      } else fit -= 12;
    }

    reasons.push(...priorityReasons);
    if (paidReason) reasons.push(paidReason);
    if (!reasons.length) reasons.push({ k: 'score', n: c.score.total });
    // The same sentence twice (e.g. lounge access from two priorities) shows once.
    const seen = new Set<string>();
    const why = reasons.filter((r) => !seen.has(whyEn(r)) && Boolean(seen.add(whyEn(r)))).slice(0, 5);
    picks.push({ card: c, fit, reasons: why.map(whyEn), why, caution, cautionCc: caution ? here : null, nomad });
  }
  return picks.sort((x, y) => y.fit - x.fit || y.card.score.total - x.card.score.total).slice(0, count);
}

const hasPhysicalCard = (c: CardRow) => c.forms.includes('physical') || c.forms.includes('metal');
const USE_CHECK: Record<Use, (c: CardRow) => boolean> = {
  wallets: (c) => Boolean(c.wallets.applePay || c.wallets.googlePay),
  physical: hasPhysicalCard,
  credit: (c) => c.ecosystem?.credit === true,
  yield: (c) => c.ecosystem?.yield === true
};
// A plastic card or phone payments are basics (a card without them hardly works for you); credit and yield are bonuses.
const USE_WEIGHT: Record<Use, { yes: number; no: number }> = {
  wallets: { yes: 6, no: 14 },
  physical: { yes: 6, no: 18 },
  credit: { yes: 12, no: 8 },
  yield: { yes: 12, no: 8 }
};
const USE_REASON: Record<Use, string> = {
  wallets: 'Works with Apple Pay or Google Pay',
  physical: 'Physical card available',
  credit: 'Borrow against your crypto without selling',
  yield: 'Earns yield on your balance'
};

/** How well a card fits one priority from question 3, with the reasons to show. */
function priorityFit(c: CardRow, p: Priority, home: ReturnType<typeof homeFx> | null, freeOnly: boolean): { fit: number; reasons: Why[] } {
  const reasons: Why[] = [];
  let fit = 0;
  if (p === 'cashback') {
    // Free tiers only: the best rate (usually a paid or staking tier) does not count.
    fit += Math.min(netRate(c) * 8, 40) + (freeOnly ? 0 : Math.min(c.cashback.maxPct ?? 0, 10));
    // An FX fee on every purchase at home eats into the cashback.
    if (home?.known && home.pct) fit -= Math.min(home.pct * 8, 16);
    if (c.cashback.basePct != null || c.cashback.maxPct != null) {
      reasons.push(freeOnly && c.cashback.basePct != null ? { k: 'cashback', base: c.cashback.basePct, max: null } : { k: 'cashback', base: c.cashback.basePct, max: c.cashback.maxPct });
    }
  } else if (p === 'fees') {
    fit += c.score.fees * 1.2 + (c.fees.annualUsd === 0 ? 5 : 0);
    if (c.fees.annualUsd === 0) reasons.push({ k: 'noAnnual' });
    if (home?.currency && home.known && home.pct != null) {
      // Everyday spending matters more than travel here.
      fit += home.pct === 0 ? 10 : home.pct <= 1 ? 4 : 0;
      reasons.push({ k: 'fxHome', p: home.pct, cur: home.currency });
    } else if (c.fees.fxPct != null) reasons.push({ k: 'fx', p: c.fees.fxPct });
  } else if (p === 'travel') {
    const fx = c.fees.fxPct;
    fit += fx == null ? 0 : fx === 0 ? 20 : fx <= 1 ? 12 : fx <= 1.5 ? 8 : fx <= 2 ? 4 : 0;
    if (fx != null) reasons.push(fx === 0 ? { k: 'fxAbroadNone' } : { k: 'fxAbroad', p: fx });
    if (hasLounge(c)) {
      fit += 10;
      reasons.push({ k: 'lounge' });
    }
    if ((c.coverage.countries ?? 0) >= 80) {
      fit += 6;
      reasons.push({ k: 'countries', n: c.coverage.countries ?? 0 });
    }
  } else {
    const perks = allPerks(c);
    fit += Math.min(perks.length * 2, 10) + (hasLounge(c) ? 12 : 0) + (c.forms.includes('metal') ? 6 : 0);
    if (hasLounge(c)) reasons.push({ k: 'lounge' });
    if (c.forms.includes('metal')) reasons.push({ k: 'metal' });
    if (perks.length && !hasLounge(c)) reasons.push({ k: 'perk', text: perks[0] });
  }
  return { fit, reasons };
}
