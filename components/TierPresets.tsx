'use client';

import type { CardRow } from '@/lib/types';
import { PRESET_LABEL, presetNames, type TierPreset } from '@/lib/tierpick';

/**
 * One click to show the same kind of tier on every compared card, with the real tier names it picks:
 * "Next tier up · Premium · Pro · Luxe". `allLabel` names the "no single tier" option.
 */
export function TierPresets({
  cards,
  value,
  onPick,
  country,
  allLabel = PRESET_LABEL.all
}: {
  cards: CardRow[];
  value: TierPreset | null;
  onPick: (p: TierPreset) => void;
  country?: string | null;
  allLabel?: string;
}) {
  if (!cards.length) return null;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="field-label">Tiers to compare</span>
      <div className="chip-row" role="group" aria-label="Tiers to compare">
        {(['all', 'entry', 'next', 'top'] as TierPreset[]).map((p) => {
          const names = presetNames(cards, p, country);
          return (
            <button key={p} type="button" className="chip chip-wrap" aria-pressed={value === p} onClick={() => onPick(p)}>
              <span>
                {p === 'all' ? allLabel : PRESET_LABEL[p]}
                {names ? <span className="tier-preset-names"> · {names}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
