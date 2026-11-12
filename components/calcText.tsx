'use client';

import { createContext, useContext } from 'react';
import { COUNTRIES, countryName } from '@/lib/regions';
import { approxUsd, money } from '@/lib/format';
import { calcEn } from '@/lib/i18n/ui/calc/en';
import { fillText, intlFmt } from '@/lib/i18n/clientFormat';
import type { Ui } from '@/lib/i18n/ui/en';
import type { TierResult } from '@/lib/calc';

// Words and numbers for the rewards calculator, in English (exactly as the site always showed it) or another
// language. Amounts and percentages are formatted here; the templates in lib/i18n/ui/calc only place them.

export type CalcText = ReturnType<typeof calcText>;

/** `ui`, `tag`: another language; `names`: country names from the server; `sheet`: sheet text English → that language. */
export function calcText(ui?: Ui, tag?: string, names?: Record<string, string>, sheet?: Record<string, string>) {
  const w = ui ? ui.calc : calcEn;
  const preset = ui ? { heading: ui.compare.tiersToCompare, all: ui.compare.presetAll, entry: ui.compare.presetEntry, next: ui.compare.presetNext, top: ui.compare.presetTop } : undefined;
  if (!ui || !tag) {
    /** Dollars with cents for small amounts, whole dollars from $100. */
    const cash = (n: number) => {
      const abs = Math.abs(n);
      if (abs >= 100 || abs === 0) return money(n);
      return `${n < 0 ? '−' : ''}$${abs.toFixed(2)}`;
    };
    return {
      w,
      english: true,
      preset,
      share: undefined,
      money,
      cash,
      minus: (n: number) => (n > 0.004 ? `−${cash(n)}` : '$0'),
      approx: approxUsd,
      /** "3%", as the calculator always wrote a rate. */
      pct: (n: number | null | undefined) => `${n}%`,
      yieldPct: (n: number) => `${n.toFixed(2)}%`,
      num: (n: number) => n.toLocaleString('en-US'),
      count: (n: number) => String(n),
      country: countryName,
      countries: () => COUNTRIES.map((c) => ({ code: c.code, name: c.name })),
      /** "A, B and C". */
      and: (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`),
      tx: (s: string) => s
    };
  }
  const fmt = intlFmt(tag, ui, names);
  // In right-to-left text an amount keeps its own order.
  const iso = (s: string) => (tag.startsWith('ar') ? `⁦${s}⁩` : s);
  const usd = (n: number, digits: number) =>
    new Intl.NumberFormat(tag, { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
  const whole = (n: number) => iso(`${n < 0 ? '−' : ''}${usd(Math.round(Math.abs(n)), 0)}`);
  const cash = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 100 || abs === 0) return whole(n);
    return iso(`${n < 0 ? '−' : ''}${usd(abs, 2)}`);
  };
  const pctF = new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 2 });
  const yieldF = new Intl.NumberFormat(tag, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let listF: Intl.ListFormat | null = null;
  try {
    listF = new Intl.ListFormat(tag, { type: 'conjunction' });
  } catch {
    listF = null;
  }
  return {
    w,
    english: false,
    preset,
    share: ui.common,
    money: whole,
    cash,
    minus: (n: number) => (n > 0.004 ? cash(-n) : whole(0)),
    approx: (n: number) => iso(`~${usd(n, n >= 100 ? 0 : 2)}`),
    pct: (n: number | null | undefined) => (n == null ? ui.common.notPublished : pctF.format(n / 100)),
    yieldPct: (n: number) => yieldF.format(n / 100),
    num: (n: number) => n.toLocaleString(tag),
    count: (n: number) => n.toLocaleString(tag),
    country: fmt.country,
    countries: fmt.countries,
    and: (xs: string[]) => (listF ? listF.format(xs) : xs.join(', ')),
    tx: (s: string) => sheet?.[s] ?? s
  };
}

export const CalcTextContext = createContext<CalcText | null>(null);
export const useCalcText = () => useContext(CalcTextContext) ?? calcText();

/**
 * One note worked out by lib/calc.ts, in the page's language. The notes are English sentences there (the calculator
 * also reads them); here each one is recognised and written again from the language's words. `r` gives the stake.
 */
export function noteText(L: CalcText, f: string, r: TierResult, i: number): string {
  if (L.english) return f;
  const w = L.w;
  const known: Record<string, string> = {
    'Cashback rate not published': w.fCbNP,
    'Reward currency not published': w.fRewardNP,
    'Tier price not published': w.fTierNP,
    'Physical card price not published': w.fPhysNP,
    'FX fee not published': w.fFxNP,
    'Top-up fee not published': w.fTopUpNP,
    'How to qualify is not published': w.fQualifyNP,
    'Not offered where you live': w.fNotOffered
  };
  if (known[f]) return known[f];
  const billing = f.match(/^Billing currency not published, so FX is counted on your (.+) spending too$/);
  if (billing) return fillText(w.fBilling, { cur: billing[1] === 'local' ? w.fLocal : billing[1] });
  const stake = r.tier.stake;
  const hold = f.match(/^(Or hold|Hold) /);
  if (hold && i === r.stakeFlag && stake) {
    const amount = stake.amount != null ? L.num(stake.amount) : w.fSome;
    return fillText(hold[1] === 'Or hold' ? w.fOrHold : w.fHold, { amount, token: stake.token });
  }
  const needs = f.match(/^Needs: (.*)$/s);
  if (needs) return fillText(w.fNeeds, { x: L.tx(needs[1]) });
  // The tier's requirement on its own (entry tier): sheet text.
  return L.tx(f);
}
