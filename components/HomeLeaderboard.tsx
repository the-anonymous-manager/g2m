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
import { englishFmt, fillText, intlFmt } from '@/lib/i18n/clientFormat';
import { uiEn, type Ui } from '@/lib/i18n/ui/en';

// Top 5 by G2M score: for the visitor's country when we know it, otherwise worldwide.
export function HomeLeaderboard({
  rows,
  ui = uiEn,
  tag,
  prefix = '',
  countryNames
}: {
  rows: CardRow[];
  /** Another language: its pack, BCP 47 tag, address prefix and country names (see RankingsTable). */
  ui?: Ui;
  tag?: string;
  prefix?: string;
  countryNames?: Record<string, string>;
}) {
  const english = !tag;
  const t = ui.table;
  const fmt = useMemo(() => (tag ? intlFmt(tag, ui, countryNames) : englishFmt), [tag, ui, countryNames]);
  const range = (base: number | null, max: number | null) =>
    english
      ? cashbackLabel(base, max)
      : base == null && max == null
        ? ui.common.notPublished
        : base != null && max != null && max > base
          ? fillText(ui.home.range, { a: fmt.pct(base), b: fmt.pct(max) })
          : base != null
            ? fmt.pct(base)
            : fillText(ui.common.upTo, { x: fmt.pct(max) });
  const { country, ready } = useRegion();
  const here = ready ? country : null;
  const ranked = useMemo(() => (here ? rankIn(rows, here) : rows), [rows, here]);
  const top = ranked.slice(0, 5);
  const confirmed = here ? ranked.filter((c) => availabilityIn(c, here) === 'yes').length : 0;
  const place = here ? (english ? countryName(here) : fmt.country(here)) : null;

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="table-wrap">
        <table className="table leaderboard" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">{english ? 'Card' : t.colCard}</th>
              <th scope="col">{english ? 'G2M score' : t.colScore}</th>
              <th scope="col">{english ? 'Cashback' : t.cashback}</th>
              <th scope="col">{english ? 'Annual fee' : t.colAnnual}</th>
              <th scope="col">{english ? 'FX fee' : t.colFx}</th>
              <th scope="col">{place ?? (english ? 'Countries' : t.colCountries)}</th>
            </tr>
          </thead>
          <tbody>
            {top.map((c) => (
              <tr key={c.slug}>
                <td className={`rank ${c.rank === 1 ? 'rank-1' : ''}`}>{c.rank}</td>
                <td>
                  <div className="card-cell">
                    <CardArt card={c} size="sm" />
                    <Link href={`${prefix}/cards/${c.slug}`}>{c.name}</Link>
                  </div>
                </td>
                <td>
                  <ScorePill value={c.score.total} label={english ? undefined : t.colScore} />
                </td>
                <td className="num">{range(c.cashback.basePct, c.cashback.maxPct)}</td>
                <td className="num">{english ? usd(c.fees.annualUsd, '—') : fmt.usd(c.fees.annualUsd, '—')}</td>
                <td className="num">{english ? pct(c.fees.fxPct, '—') : fmt.pct(c.fees.fxPct, '—')}</td>
                <td className={here ? undefined : 'num'}>
                  {here ? (
                    <MarketBadge value={availabilityIn(c, here)} where={place ?? undefined} short words={english ? undefined : ui.common} />
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
          {english
            ? confirmed
              ? `Ranked for ${place}, where ${confirmed} ${confirmed === 1 ? 'card is' : 'cards are'} confirmed.`
              : `No card has confirmed ${place} yet, so this is the global ranking. Check with the issuer before you apply.`
            : confirmed
              ? fillText(ui.home.rankedFor, { place, n: confirmed })
              : fillText(t.noneConfirmed, { place })}
        </p>
      ) : null}
    </div>
  );
}
