'use client';

import Link from 'next/link';
import type { CardRow, Market } from '@/lib/types';
import { MARKET_LABELS } from '@/lib/regions';
import { CardArt } from '@/components/CardArt';
import { ScorePill } from '@/components/bits';
import { useRegion } from '@/components/RegionContext';

export type MarketPanel = { market: Market; count: number; cards: CardRow[] };

// Cards confirmed in each market, with the visitor's own market first when we know it.
export function MarketPanels({ panels }: { panels: MarketPanel[] }) {
  const { market, ready } = useRegion();
  const mine = ready ? market : null;
  const ordered = mine ? [...panels].sort((a, b) => Number(b.market === mine) - Number(a.market === mine)) : panels;

  return (
    <div className="market-grid">
      {ordered.map(({ market: m, count, cards }) => (
        <div
          key={m}
          className="panel panel-pad stack"
          style={{ gap: 14, borderColor: m === mine ? 'var(--accent)' : undefined }}
        >
          <div className="stack" style={{ gap: 8, alignItems: 'flex-start' }}>
            {/* Same-height label row on every panel keeps the titles lined up. */}
            {mine ? (
              <span className="eyebrow" style={{ fontSize: 11, minHeight: 15 }}>
                {m === mine ? 'Your location' : '\u00a0'}
              </span>
            ) : null}
            <h3 className="h3">{MARKET_LABELS[m]}</h3>
            <span className="badge badge-yes">{count} confirmed</span>
          </div>
          {cards.length ? (
            <ul className="list-plain">
              {cards.map((c) => (
                <li key={c.slug} style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <Link
                    href={`/cards/${c.slug}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', fontWeight: 600 }}
                  >
                    <CardArt card={c} size="sm" />
                    {c.name}
                  </Link>
                  <ScorePill value={c.score.total} showBar={false} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No card has confirmed {MARKET_LABELS[m]} yet.</p>
          )}
          <Link href={`/cards?market=${m}`} className="muted" style={{ fontSize: 15 }}>
            All cards for {MARKET_LABELS[m]}
          </Link>
        </div>
      ))}
    </div>
  );
}
