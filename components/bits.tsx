import type { Availability, Market } from '@/lib/types';
import { MARKET_LABELS } from '@/lib/regions';

export function ScorePill({ value, showBar = true, label }: { value: number; showBar?: boolean; label?: string }) {
  return (
    <span className="score" aria-label={label ? `${label}: ${value}/100` : `G2M score ${value} out of 100`}>
      <span className="score-num">{value}</span>
      {showBar ? (
        <span className="score-bar" aria-hidden="true">
          <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
        </span>
      ) : null}
    </span>
  );
}

const AVAIL_TEXT: Record<Availability, string> = { yes: 'Available', no: 'Not available', unknown: 'Not confirmed' };

export function MarketBadge({
  value,
  market,
  where,
  short = false,
  words
}: {
  value: Availability;
  market?: Market;
  // Place name for the tooltip when it is a country rather than one of the five markets.
  where?: string;
  short?: boolean;
  /** Another language's words (lib/i18n/ui common); English when left out. */
  words?: { yes: string; no: string; unclear: string; available: string; notAvailable: string; notConfirmed: string };
}) {
  const full = words ? { yes: words.available, no: words.notAvailable, unknown: words.notConfirmed }[value] : AVAIL_TEXT[value];
  const text = short ? (value === 'yes' ? (words?.yes ?? 'Yes') : value === 'no' ? (words?.no ?? 'No') : (words?.unclear ?? 'Unclear')) : full;
  const place = where ?? (market ? MARKET_LABELS[market] : undefined);
  const label = place ? `${place}: ${full}` : full;
  return (
    <span className={`badge badge-${value}`} title={label} aria-label={label}>
      {value === 'yes' ? (
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 6.5 5 9l5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : value === 'no' ? (
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 3l6 6M9 3 3 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : null}
      {text}
    </span>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="eyebrow">[ {children} ]</span>;
}

export function ArrowIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--faint)' }}>
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.8-3.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
