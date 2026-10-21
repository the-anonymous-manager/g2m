import type { CardRow, Market } from '@/lib/types';
import { isMarket } from '@/lib/regions';

// Table engine: multi-column sorting + filters, all serialisable to the URL
// so any filtered view can be shared (e.g. on X) and reopened exactly.

export type SortKey = 'score' | 'name' | 'cashback' | 'max' | 'annual' | 'fx' | 'countries';
export type SortDir = 'asc' | 'desc';
export type SortRule = { key: SortKey; dir: SortDir };

export type Filters = {
  q: string;
  net: '' | 'visa' | 'mastercard' | 'amex';
  custody: '' | 'self' | 'custodial';
  market: Market | '';
  strict: boolean; // true: only "yes" for the market; false: also "unknown"
  nofee: boolean;
  physical: boolean;
  metal: boolean;
  lounge: boolean;
  min: number; // minimum typical cashback %
  sort: SortRule[];
};

export const DEFAULT_SORT: SortRule[] = [{ key: 'score', dir: 'desc' }];

export const DEFAULT_FILTERS: Filters = {
  q: '',
  net: '',
  custody: '',
  market: '',
  strict: false,
  nofee: false,
  physical: false,
  metal: false,
  lounge: false,
  min: 0,
  sort: DEFAULT_SORT
};

const typical = (c: CardRow) =>
  c.cashback.basePct ?? (c.cashback.maxPct != null ? c.cashback.maxPct * 0.4 : null);

export const COLUMNS: Record<SortKey, { label: string; get: (c: CardRow) => number | string | null; first: SortDir }> = {
  score: { label: 'G2M score', get: (c) => c.score.total, first: 'desc' },
  name: { label: 'Card', get: (c) => c.name.toLowerCase(), first: 'asc' },
  cashback: { label: 'Base cashback', get: (c) => c.cashback.basePct, first: 'desc' },
  max: { label: 'Max cashback', get: (c) => c.cashback.maxPct, first: 'desc' },
  annual: { label: 'Annual fee', get: (c) => c.fees.annualUsd, first: 'asc' },
  fx: { label: 'FX fee', get: (c) => c.fees.fxPct, first: 'asc' },
  countries: { label: 'Countries', get: (c) => c.coverage.countries, first: 'desc' }
};

const isSortKey = (v: string): v is SortKey => v in COLUMNS;

function compareValues(a: number | string | null, b: number | string | null, dir: SortDir): number {
  // Missing values always sink to the bottom, whatever the direction.
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const r = typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : (a as number) - (b as number);
  return dir === 'asc' ? r : -r;
}

export function sortRows(rows: CardRow[], rules: SortRule[]): CardRow[] {
  const active = rules.length ? rules : DEFAULT_SORT;
  return [...rows].sort((x, y) => {
    for (const rule of active) {
      const get = COLUMNS[rule.key].get;
      const r = compareValues(get(x), get(y), rule.dir);
      if (r !== 0) return r;
    }
    return y.score.total - x.score.total || x.name.localeCompare(y.name);
  });
}

const hasLounge = (c: CardRow) =>
  [...c.perks, ...c.tiers.flatMap((t) => t.perks)].some((p) => /lounge/i.test(p));

export function filterRows(rows: CardRow[], f: Filters): CardRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((c) => {
    if (q && !`${c.name} ${c.brand} ${c.coverage.scope}`.toLowerCase().includes(q)) return false;
    if (f.net && !c.network.toLowerCase().includes(f.net)) return false;
    if (f.custody === 'self' && c.custody !== 'self-custodial') return false;
    if (f.custody === 'custodial' && c.custody !== 'custodial') return false;
    if (f.market) {
      const a = c.coverage.markets[f.market];
      if (a === 'no' || (f.strict && a !== 'yes')) return false;
    }
    if (f.nofee && c.fees.annualUsd !== 0) return false;
    if (f.physical && !c.forms.some((x) => x === 'physical' || x === 'metal')) return false;
    if (f.metal && !c.forms.includes('metal')) return false;
    if (f.lounge && !hasLounge(c)) return false;
    if (f.min > 0 && (typical(c) ?? 0) < f.min) return false;
    return true;
  });
}

/** Click on a header: replace the sort. Shift-click: add, flip, then remove a secondary sort. */
export function toggleSort(rules: SortRule[], key: SortKey, additive: boolean): SortRule[] {
  const existing = rules.find((r) => r.key === key);
  if (!additive) {
    if (existing && rules.length === 1) return [{ key, dir: existing.dir === 'asc' ? 'desc' : 'asc' }];
    return [{ key, dir: COLUMNS[key].first }];
  }
  if (!existing) return [...rules, { key, dir: COLUMNS[key].first }].slice(0, 3);
  if (existing.dir === COLUMNS[key].first) {
    return rules.map((r) => (r.key === key ? { key, dir: r.dir === 'asc' ? 'desc' : 'asc' } : r));
  }
  const rest = rules.filter((r) => r.key !== key);
  return rest.length ? rest : DEFAULT_SORT;
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;
const read = (p: ParamSource, k: string): string => {
  if (p instanceof URLSearchParams) return p.get(k) ?? '';
  const v = p[k];
  return (Array.isArray(v) ? v[0] : v) ?? '';
};

export function parseFilters(p: ParamSource): Filters {
  const sort = read(p, 'sort')
    .split(',')
    .map((s) => s.split(':'))
    .filter(([k, d]) => isSortKey(k) && (d === 'asc' || d === 'desc'))
    .slice(0, 3)
    .map(([k, d]) => ({ key: k as SortKey, dir: d as SortDir }));
  const net = read(p, 'net');
  const custody = read(p, 'custody');
  const market = read(p, 'market').toUpperCase();
  const min = Number(read(p, 'min'));
  return {
    q: read(p, 'q').slice(0, 80),
    net: net === 'visa' || net === 'mastercard' || net === 'amex' ? net : '',
    custody: custody === 'self' || custody === 'custodial' ? custody : '',
    market: isMarket(market) ? market : '',
    strict: read(p, 'strict') === '1',
    nofee: read(p, 'nofee') === '1',
    physical: read(p, 'physical') === '1',
    metal: read(p, 'metal') === '1',
    lounge: read(p, 'lounge') === '1',
    min: Number.isFinite(min) && min > 0 && min <= 20 ? min : 0,
    sort: sort.length ? sort : DEFAULT_SORT
  };
}

export function serializeFilters(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.net) p.set('net', f.net);
  if (f.custody) p.set('custody', f.custody);
  if (f.market) p.set('market', f.market);
  if (f.strict) p.set('strict', '1');
  if (f.nofee) p.set('nofee', '1');
  if (f.physical) p.set('physical', '1');
  if (f.metal) p.set('metal', '1');
  if (f.lounge) p.set('lounge', '1');
  if (f.min) p.set('min', String(f.min));
  const sort = f.sort.map((r) => `${r.key}:${r.dir}`).join(',');
  if (sort !== 'score:desc') p.set('sort', sort);
  return p.toString();
}

export function describeFilters(f: Filters, marketLabel?: string): string {
  const parts: string[] = [];
  if (f.market) parts.push(`available in ${marketLabel ?? f.market}`);
  if (f.custody === 'self') parts.push('self-custodial');
  if (f.custody === 'custodial') parts.push('custodial');
  if (f.nofee) parts.push('no annual fee');
  if (f.lounge) parts.push('with lounge access');
  if (f.metal) parts.push('metal');
  if (f.net) parts.push(f.net === 'amex' ? 'Amex' : f.net === 'visa' ? 'Visa' : 'Mastercard');
  if (f.min) parts.push(`${f.min}%+ cashback`);
  if (f.q) parts.push(`matching “${f.q}”`);
  return parts.length ? parts.join(', ') : 'all cards';
}
