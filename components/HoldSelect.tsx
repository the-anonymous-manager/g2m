'use client';

import { FEE_ANY, FEE_STEPS, HOLD_ANY, HOLD_STEPS } from '@/lib/calc';
import { fillText } from '@/lib/i18n/clientFormat';

type Words = { label: string; help: string; none: string; upTo: string; any: string };

/** A "how much will you allow" choice: nothing, up to an amount, or any. */
function LimitSelect({ id, value, onChange, steps, anyValue, w, money }: { id: string; value: number; onChange: (v: number) => void; steps: number[]; anyValue: number; w: Words; money: (n: number) => string }) {
  const current = steps.includes(value) ? value : (steps.filter((s) => s <= value).pop() ?? 0);
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {w.label}
      </label>
      <select id={id} className="select" value={current} onChange={(e) => onChange(Number(e.target.value))} aria-describedby={`${id}-help`}>
        {steps.map((s) => (
          <option key={s} value={s}>
            {s === 0 ? w.none : s === anyValue ? w.any : fillText(w.upTo, { x: money(s) })}
          </option>
        ))}
      </select>
      <span id={`${id}-help`} className="faint" style={{ fontSize: 13 }}>
        {w.help}
      </span>
    </div>
  );
}

type HoldWords = { holdLabel: string; holdHelp: string; holdNone: string; holdUpTo: string; holdAny: string };
type FeeWords = { feeLabel: string; feeHelp: string; feeNone: string; feeUpTo: string; feeAny: string };
type Common = { id: string; value: number; onChange: (v: number) => void; money: (n: number) => string };

/**
 * "Money you will keep with a card company": tiers that need an average balance, a portfolio or US$-priced locked
 * tokens are only used within this amount (Akash, 25 Nov 2026: Infini Elite, ether.fi VIP and Hyperbeat's trader tiers
 * were picked for people who hold nothing). Shared by the wallet builder and the rewards calculator.
 */
export function HoldSelect({ w, ...p }: Common & { w: HoldWords }) {
  return <LimitSelect {...p} steps={HOLD_STEPS} anyValue={HOLD_ANY} w={{ label: w.holdLabel, help: w.holdHelp, none: w.holdNone, upTo: w.holdUpTo, any: w.holdAny }} />;
}

/**
 * "Card fees you will pay a year": a tier's yearly fee plus any one-off fee to get the card. None = free cards only
 * (Akash, 25 Nov 2026: someone who pays no fees at all and someone who can pay $50 get different answers).
 */
export function FeeSelect({ w, ...p }: Common & { w: FeeWords }) {
  return <LimitSelect {...p} steps={FEE_STEPS} anyValue={FEE_ANY} w={{ label: w.feeLabel, help: w.feeHelp, none: w.feeNone, upTo: w.feeUpTo, any: w.feeAny }} />;
}
