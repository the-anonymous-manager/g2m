import type { CardRow, Market } from '@/lib/types';
import { MARKET_LABELS } from '@/lib/regions';
import { CUSTODY_LABEL, NP, TYPE_LABEL, ecosystemFeatures, pct, perPurchaseFee, usd } from '@/lib/format';
import { MarketBadge, ScorePill } from '@/components/bits';

// The card rows of the side-by-side table, shared by the /compare tool and the "X vs Y" pages.

const MARKETS: Market[] = ['IN', 'AE', 'US', 'GB', 'EU'];
export type Row = {
  label: string;
  render: (c: CardRow) => React.ReactNode;
  /** Returns a number to compare; the best value(s) get highlighted. */
  value?: (c: CardRow) => number | null;
  better?: 'high' | 'low';
};

export const ROWS: Row[] = [
  { label: 'G2M score', render: (c) => <ScorePill value={c.score.total} />, value: (c) => c.score.total, better: 'high' },
  { label: 'Base cashback', render: (c) => pct(c.cashback.basePct), value: (c) => c.cashback.basePct, better: 'high' },
  { label: 'Max cashback', render: (c) => pct(c.cashback.maxPct), value: (c) => c.cashback.maxPct, better: 'high' },
  { label: 'Paid in', render: (c) => c.cashback.payout ?? NP },
  { label: 'Annual fee', render: (c) => usd(c.fees.annualUsd), value: (c) => c.fees.annualUsd, better: 'low' },
  { label: 'FX fee', render: (c) => pct(c.fees.fxPct), value: (c) => c.fees.fxPct, better: 'low' },
  { label: 'Top-up fee', render: (c) => pct(c.fees.topUpPct), value: (c) => c.fees.topUpPct, better: 'low' },
  { label: 'Per-purchase fee', render: (c) => perPurchaseFee(c.fees) },
  { label: 'ATM', render: (c) => c.fees.atm ?? NP },
  { label: 'Network', render: (c) => c.network },
  { label: 'Card type', render: (c) => TYPE_LABEL[c.type] },
  { label: 'Custody', render: (c) => CUSTODY_LABEL[c.custody] },
  { label: 'Formats', render: (c) => <span style={{ textTransform: 'capitalize' }}>{c.forms.join(', ')}</span> },
  {
    label: 'Apple / Google Pay',
    render: (c) =>
      `${c.wallets.applePay == null ? '?' : c.wallets.applePay ? 'Yes' : 'No'} / ${c.wallets.googlePay == null ? '?' : c.wallets.googlePay ? 'Yes' : 'No'}`
  },
  ...MARKETS.map<Row>((m) => ({
    label: MARKET_LABELS[m],
    render: (c) => <MarketBadge value={c.coverage.markets[m]} market={m} short />
  })),
  { label: 'Countries', render: (c) => (c.coverage.countries != null ? String(c.coverage.countries) : c.coverage.scope) },
  ...[0, 1, 2, 3, 4].map<Row>((i) => ({
    label: ecosystemFeatures(undefined)[i].label,
    render: (c) => ecosystemFeatures(c.ecosystem)[i].value
  })),
  { label: 'Tiers', render: (c) => c.tiers.map((t) => t.name).join(' · ') },
  {
    label: 'Perks',
    render: (c) => {
      const perks = Array.from(new Set([...c.perks, ...c.tiers.flatMap((t) => t.perks)])).slice(0, 5);
      return perks.length ? perks.join(' · ') : '—';
    }
  }
];

export function best(cards: CardRow[], row: Row): Set<string> {
  if (!row.value || !row.better || cards.length < 2) return new Set();
  const vals = cards.map((c) => ({ slug: c.slug, v: row.value!(c) })).filter((x) => x.v != null) as { slug: string; v: number }[];
  if (vals.length < 2) return new Set();
  const target = row.better === 'high' ? Math.max(...vals.map((x) => x.v)) : Math.min(...vals.map((x) => x.v));
  if (vals.every((x) => x.v === target)) return new Set();
  return new Set(vals.filter((x) => x.v === target).map((x) => x.slug));
}
