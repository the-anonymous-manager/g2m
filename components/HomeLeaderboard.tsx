'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { CardRow } from '@/lib/types';
import { availabilityIn, countryName } from '@/lib/regions';
import { rankIn } from '@/lib/score';
import { cashbackLabel, pct, usd } from '@/lib/format';
import { CardArt } from '@/components/CardArt';
import { MarketBadge, ScorePill } from '@/components/bits';
import { useRegion } from '@/components/RegionContext';

// Top 5 by G2M score: for the visitor's country when we know it, otherwise worldwide.
export function HomeLeaderboard({ rows }: { rows: CardRow[] }) {
  const { country, ready } = useRegion();
  const here = ready ? country : null;
  const ranked = useMemo(() => (here ? rankIn(rows, here) : rows), [rows, here]);
  const top = ranked.slice(0, 5);
  const confirmed = here ? ranked.filter((c) => availabilityIn(c, here) === 'yes').length : 0;
  const place = here ? countryName(here) : null;

  return (
    <div className="stack" style={{ gap: 10 }}>
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
              <th scope="col">{place ?? 'Countries'}</th>
            </tr>
          </thead>
          <tbody>
            {top.map((c) => (
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
                <td className={here ? undefined : 'num'}>
                  {here ? (
                    <MarketBadge value={availabilityIn(c, here)} where={place ?? undefined} short />
                  ) : (
                    <span title={c.coverage.scope}>{c.coverage.countries ?? '—'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {place ? (
        <p className="faint" style={{ fontSize: 14, margin: 0 }}>
          {confirmed
            ? `Ranked for ${place}, where ${confirmed} ${confirmed === 1 ? 'card is' : 'cards are'} confirmed.`
            : `No card has confirmed ${place} yet, so this is the global ranking. Check with the issuer before you apply.`}
        </p>
      ) : null}
    </div>
  );
}
