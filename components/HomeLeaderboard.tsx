'use client';

import Link from 'next/link';
import type { CardRow, Market } from '@/lib/types';
import { MARKET_LABELS } from '@/lib/regions';
import { cashbackLabel, pct, usd } from '@/lib/format';
import { CardArt } from '@/components/CardArt';
import { MarketBadge, ScorePill } from '@/components/bits';
import { useRegion } from '@/components/RegionContext';

export function HomeLeaderboard({ rows }: { rows: CardRow[] }) {
  const { market, ready } = useRegion();
  // The visitor's market when we know it; otherwise how many countries each card covers.
  const local: Market | null = ready ? market : null;

  return (
    <div className="table-wrap">
      <table className="table" style={{ minWidth: 760 }}>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Card</th>
            <th scope="col">G2M score</th>
            <th scope="col">Cashback</th>
            <th scope="col">Annual fee</th>
            <th scope="col">FX fee</th>
            <th scope="col">{local ? MARKET_LABELS[local] : 'Countries'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.slug}>
              <td className={`rank ${c.rank === 1 ? 'rank-1' : ''}`}>{c.rank}</td>
              <td>
                <div className="card-cell">
                  <CardArt card={c} size="sm" />
                  <Link href={`/cards/${c.slug}`}>{c.name}</Link>
                </div>
              </td>
              <td>
                <ScorePill value={c.score.total} />
              </td>
              <td className="num">{cashbackLabel(c.cashback.basePct, c.cashback.maxPct)}</td>
              <td className="num">{usd(c.fees.annualUsd, '—')}</td>
              <td className="num">{pct(c.fees.fxPct, '—')}</td>
              <td className={local ? undefined : 'num'}>
                {local ? (
                  <MarketBadge value={c.coverage.markets[local]} market={local} short />
                ) : (
                  <span title={c.coverage.scope}>{c.coverage.countries ?? '—'}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
