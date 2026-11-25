'use client';

import { HOLD_ANY, HOLD_STEPS } from '@/lib/calc';
import { fillText } from '@/lib/i18n/clientFormat';

type Words = { holdLabel: string; holdHelp: string; holdNone: string; holdUpTo: string; holdAny: string };

/**
 * "Money you will keep with a card company": tiers that need an average balance, a portfolio or US$-priced locked
 * tokens are only used within this amount (Akash, 25 Nov 2026: Infini Elite, ether.fi VIP and Hyperbeat's trader tiers
 * were picked for people who hold nothing). Shared by the wallet builder and the rewards calculator.
 */
export function HoldSelect({ id, value, onChange, w, money }: { id: string; value: number; onChange: (v: number) => void; w: Words; money: (n: number) => string }) {
  const current = HOLD_STEPS.includes(value) ? value : HOLD_STEPS.filter((s) => s <= value).pop() ?? 0;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {w.holdLabel}
      </label>
      <select id={id} className="select" value={current} onChange={(e) => onChange(Number(e.target.value))} aria-describedby={`${id}-help`}>
        {HOLD_STEPS.map((s) => (
          <option key={s} value={s}>
            {s === 0 ? w.holdNone : s === HOLD_ANY ? w.holdAny : fillText(w.holdUpTo, { x: money(s) })}
          </option>
        ))}
      </select>
      <span id={`${id}-help`} className="faint" style={{ fontSize: 13 }}>
        {w.holdHelp}
      </span>
    </div>
  );
}
