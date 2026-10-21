'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardRow, Market } from '@/lib/types';
import { MARKET_LABELS } from '@/lib/regions';
import { CUSTODY_LABEL, NP, TYPE_LABEL, cashbackLabel, pct, usd } from '@/lib/format';
import { CardArt } from '@/components/CardArt';
import { MarketBadge, ScorePill } from '@/components/bits';
import { OutboundLink } from '@/components/OutboundLink';
import { ShareBar } from '@/components/ShareBar';

const MARKETS: Market[] = ['IN', 'AE', 'US', 'GB', 'EU'];
const SLOTS = 3;

type Row = {
  label: string;
  render: (c: CardRow) => React.ReactNode;
  /** Returns a number to compare; the best value(s) get highlighted. */
  value?: (c: CardRow) => number | null;
  better?: 'high' | 'low';
};

const ROWS: Row[] = [
  { label: 'G2M score', render: (c) => <ScorePill value={c.score.total} />, value: (c) => c.score.total, better: 'high' },
  { label: 'Base cashback', render: (c) => pct(c.cashback.basePct), value: (c) => c.cashback.basePct, better: 'high' },
  { label: 'Max cashback', render: (c) => pct(c.cashback.maxPct), value: (c) => c.cashback.maxPct, better: 'high' },
  { label: 'Paid in', render: (c) => c.cashback.payout ?? NP },
  { label: 'Annual fee', render: (c) => usd(c.fees.annualUsd), value: (c) => c.fees.annualUsd, better: 'low' },
  { label: 'FX fee', render: (c) => pct(c.fees.fxPct), value: (c) => c.fees.fxPct, better: 'low' },
  { label: 'Top-up fee', render: (c) => pct(c.fees.topUpPct), value: (c) => c.fees.topUpPct, better: 'low' },
  {
    label: 'Per-purchase fee',
    render: (c) =>
      c.fees.txPct === 0 && c.fees.txFlatUsd === 0
        ? 'None listed'
        : [c.fees.txPct ? pct(c.fees.txPct) : null, c.fees.txFlatUsd ? `$${c.fees.txFlatUsd}` : null].filter(Boolean).join(' + ')
  },
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
  { label: 'Tiers', render: (c) => c.tiers.map((t) => t.name).join(' · ') },
  {
    label: 'Perks',
    render: (c) => {
      const perks = Array.from(new Set([...c.perks, ...c.tiers.flatMap((t) => t.perks)])).slice(0, 5);
      return perks.length ? perks.join(' · ') : '—';
    }
  }
];

function best(cards: CardRow[], row: Row): Set<string> {
  if (!row.value || !row.better || cards.length < 2) return new Set();
  const vals = cards.map((c) => ({ slug: c.slug, v: row.value!(c) })).filter((x) => x.v != null) as { slug: string; v: number }[];
  if (vals.length < 2) return new Set();
  const target = row.better === 'high' ? Math.max(...vals.map((x) => x.v)) : Math.min(...vals.map((x) => x.v));
  if (vals.every((x) => x.v === target)) return new Set();
  return new Set(vals.filter((x) => x.v === target).map((x) => x.slug));
}

export function CompareClient({ rows, initial }: { rows: CardRow[]; initial: string[] }) {
  const [slots, setSlots] = useState<string[]>(() => {
    const valid = initial.filter((s) => rows.some((r) => r.slug === s)).slice(0, SLOTS);
    return valid.length ? valid : rows.slice(0, 2).map((r) => r.slug);
  });
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const url = `${window.location.pathname}${slots.length ? `?c=${slots.join(',')}` : ''}`;
    window.history.replaceState(window.history.state, '', url);
  }, [slots]);

  const chosen = useMemo(() => slots.map((s) => rows.find((r) => r.slug === s)).filter((c): c is CardRow => Boolean(c)), [slots, rows]);

  const setSlot = (i: number, slug: string) => {
    setSlots((prev) => {
      const next = [...prev];
      if (!slug) next.splice(i, 1);
      else next[i] = slug;
      return Array.from(new Set(next.filter(Boolean)));
    });
  };

  const pickers = Array.from({ length: Math.min(SLOTS, chosen.length + 1) }, (_, i) => i);
  const columns = `minmax(130px, 170px) repeat(${Math.max(chosen.length, 1)}, minmax(210px, 1fr))`;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="panel panel-pad" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        {pickers.map((i) => (
          <div className="field" key={i} style={{ flex: '1 1 200px' }}>
            <label className="field-label" htmlFor={`slot-${i}`}>
              Card {i + 1}
            </label>
            <select id={`slot-${i}`} className="select" value={slots[i] ?? ''} onChange={(e) => setSlot(i, e.target.value)}>
              <option value="">{slots[i] ? 'Remove this card' : 'Add a card'}</option>
              {rows.map((r) => (
                <option key={r.slug} value={r.slug} disabled={slots.includes(r.slug) && slots[i] !== r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        ))}
        {chosen.length >= 2 ? (
          <ShareBar text={`${chosen.map((c) => c.brand).join(' vs ')}: crypto cards compared on G2M`} />
        ) : null}
      </div>

      {chosen.length === 0 ? (
        <p className="muted">Pick a card above to start comparing.</p>
      ) : (
        <div className="table-wrap">
          <div role="table" aria-label="Card comparison" style={{ minWidth: 170 + chosen.length * 220 }}>
            <div role="row" className="cmp-row cmp-head" style={{ gridTemplateColumns: columns }}>
              <div role="columnheader" className="cmp-label">
                <span className="sr-only">Detail</span>
              </div>
              {chosen.map((c) => (
                <div role="columnheader" key={c.slug} className="cmp-cell stack" style={{ gap: 12 }}>
                  <CardArt card={c} width={150} />
                  <Link href={`/cards/${c.slug}`} style={{ fontWeight: 700, fontSize: 17, textDecoration: 'none' }}>
                    {c.name}
                  </Link>
                  <span className="faint" style={{ fontSize: 14 }}>
                    {cashbackLabel(c.cashback.basePct, c.cashback.maxPct)} back
                  </span>
                </div>
              ))}
            </div>
            {ROWS.map((row) => {
              const winners = best(chosen, row);
              return (
                <div role="row" key={row.label} className="cmp-row" style={{ gridTemplateColumns: columns }}>
                  <div role="rowheader" className="cmp-label">
                    {row.label}
                  </div>
                  {chosen.map((c) => (
                    <div role="cell" key={c.slug} className={`cmp-cell ${winners.has(c.slug) ? 'cmp-best' : ''}`}>
                      {row.render(c)}
                      {winners.has(c.slug) ? <span className="sr-only"> (best)</span> : null}
                    </div>
                  ))}
                </div>
              );
            })}
            <div role="row" className="cmp-row" style={{ gridTemplateColumns: columns }}>
              <div role="rowheader" className="cmp-label">
                <span className="sr-only">Apply</span>
              </div>
              {chosen.map((c) => (
                <div role="cell" key={c.slug} className="cmp-cell">
                  <OutboundLink slug={c.slug} name={c.brand} placement="compare" className="btn btn-metal btn-sm">
                    Get {c.brand}
                  </OutboundLink>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <p className="faint" style={{ fontSize: 13 }}>
        Highlighted values are the best among the cards shown. “Not published” means the issuer does not state it.
      </p>
    </div>
  );
}
