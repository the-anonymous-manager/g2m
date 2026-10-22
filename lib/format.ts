import type { CardData } from '@/lib/types';

export const NP = 'Not published';

export function pct(n: number | null | undefined, empty = NP): string {
  if (n == null) return empty;
  return `${Number.isInteger(n) ? n : n.toFixed(n < 1 ? 2 : 1).replace(/\.?0+$/, '')}%`;
}

export function usd(n: number | null | undefined, empty = NP): string {
  if (n == null) return empty;
  if (n === 0) return 'Free';
  const abs = Math.abs(n);
  const s = abs >= 1000 ? Math.round(abs).toLocaleString('en-US') : abs % 1 === 0 ? String(abs) : abs.toFixed(2);
  return `${n < 0 ? '−' : ''}$${s}`;
}

export function money(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1000 ? Math.round(abs).toLocaleString('en-US') : abs.toFixed(0);
  return `${n < 0 ? '−' : ''}$${s}`;
}

/** Every per-purchase cost as one label: percentage, flat fee and any small-purchase fee. */
export function perPurchaseFee(f: Pick<CardData['fees'], 'txPct' | 'txFlatUsd' | 'smallPurchase'>): string {
  const small = f.smallPurchase;
  const parts = [
    f.txPct ? pct(f.txPct) : null,
    f.txFlatUsd ? `$${f.txFlatUsd}` : null,
    small ? `${usd(small.feeUsd)} under ${usd(small.underUsd)}${small.foreignOnly ? ' (non-USD)' : ''}` : null
  ];
  return parts.filter(Boolean).join(' + ') || 'None listed';
}

export function cashbackLabel(base: number | null, max: number | null): string {
  if (base == null && max == null) return NP;
  if (base != null && max != null && max > base) return `${pct(base)} to ${pct(max)}`;
  if (base != null) return pct(base);
  return `Up to ${pct(max)}`;
}

export function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export const CUSTODY_LABEL = {
  'self-custodial': 'Self-custodial',
  custodial: 'Custodial',
  unknown: 'Not published'
} as const;

export const TYPE_LABEL = {
  debit: 'Debit',
  credit: 'Credit',
  prepaid: 'Prepaid',
  spend: 'Spend',
  mixed: 'Varies by region'
} as const;
