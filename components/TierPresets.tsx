'use client';

import type { CardRow } from '@/lib/types';
import { PRESET_LABEL, presetNames, type TierPreset } from '@/lib/tierpick';

type PresetWords = { heading: string; all: string; entry: string; next: string; top: string };

/**
 * One click to show the same kind of tier on every compared card, with the real tier names it picks:
 * "Next tier up · Premium · Pro · Luxe". `allLabel` names the "no single tier" option; `words` gives another
 * language (English when left out).
 */
export function TierPresets({
  cards,
  value,
  onPick,
  country,
  allLabel,
  words
}: {
  cards: CardRow[];
  value: TierPreset | null;
  onPick: (p: TierPreset) => void;
  country?: string | null;
  allLabel?: string;
  words?: PresetWords;
}) {
  if (!cards.length) return null;
  const heading = words?.heading ?? 'Tiers to compare';
  const label = (p: TierPreset) => (p === 'all' ? (allLabel ?? words?.all ?? PRESET_LABEL.all) : words ? words[p] : PRESET_LABEL[p]);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="field-label">{heading}</span>
      <div className="chip-row" role="group" aria-label={heading}>
        {(['all', 'entry', 'next', 'top'] as TierPreset[]).map((p) => {
          const names = presetNames(cards, p, country);
          return (
            <button key={p} type="button" className="chip chip-wrap" aria-pressed={value === p} onClick={() => onPick(p)}>
              <span>
                {label(p)}
                {names ? <span className="tier-preset-names"> · {names}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
