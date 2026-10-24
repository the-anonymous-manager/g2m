'use client';

/** A labelled row of toggle chips: pick one option. */
export function Chips<T extends string | number>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="chip-row" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" className="chip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
