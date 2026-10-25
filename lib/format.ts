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
    small
      ? `${usd(small.feeUsd)} ${small.inclusive ? 'at or under' : 'under'} ${usd(small.underUsd)}${small.foreignOnly ? ' (non-USD)' : ''}${small.freePerMonth ? `, first ${small.freePerMonth} a month free` : ''}`
      : null
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
  both: 'Custodial or self-custodial',
  unknown: 'Not published'
} as const;

export const TYPE_LABEL = {
  debit: 'Debit',
  credit: 'Credit',
  prepaid: 'Prepaid',
  spend: 'Spend',
  mixed: 'Varies by region'
} as const;

/** The five ecosystem and banking features in plain words, with whether each is confirmed. */
export function ecosystemFeatures(e: CardData['ecosystem']): { label: string; value: string; on: boolean }[] {
  const yesNo = (v: boolean | null | undefined) => (v == null ? 'Not confirmed' : v ? 'Yes' : 'No');
  const n = e?.payoutCorridors;
  return [
    {
      label: 'Bank account (IBAN or account number)',
      value: e?.iban === 'named' ? 'In your name' : e?.iban === 'shared' ? 'Shared, with a reference code' : e?.iban === 'none' ? 'No' : 'Not confirmed',
      on: e?.iban === 'named' || e?.iban === 'shared'
    },
    {
      label: 'Send money to a bank account',
      value: n == null ? 'Not confirmed' : n === 0 ? 'No' : `${n} ${n === 1 ? 'currency' : 'currencies'}`,
      on: (n ?? 0) > 0
    },
    {
      label: 'Buy and sell crypto with fiat',
      value: e?.ramps === 'both' ? 'Buy and sell' : e?.ramps === 'on' ? 'Buy only' : e?.ramps === 'off' ? 'Sell only' : e?.ramps === 'none' ? 'No' : 'Not confirmed',
      on: e?.ramps === 'both' || e?.ramps === 'on' || e?.ramps === 'off'
    },
    { label: 'Spend against crypto without selling', value: yesNo(e?.credit), on: Boolean(e?.credit) },
    { label: 'Yield on your balance', value: yesNo(e?.yield), on: Boolean(e?.yield) }
  ];
}
