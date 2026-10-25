'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardRow } from '@/lib/types';
import {
  COLUMNS,
  DEFAULT_FILTERS,
  describeFilters,
  filterRows,
  serializeFilters,
  sortRows,
  toggleSort,
  type Filters,
  type SortKey
} from '@/lib/table';
import { availabilityIn, countryName } from '@/lib/regions';
import { nomadFit } from '@/lib/nomad';
import { NomadBadge, NomadBar } from '@/components/NomadBar';
import { rankIn } from '@/lib/score';
import { CUSTODY_LABEL, NP, pct, usd } from '@/lib/format';
import { CardArt } from '@/components/CardArt';
import { MarketBadge, ScorePill, SearchIcon } from '@/components/bits';
import { ShareBar } from '@/components/ShareBar';
import { useRegion } from '@/components/RegionContext';
import { track } from '@/lib/analytics';

const MAX_COMPARE = 3;

type Props = { rows: CardRow[]; initial: Filters; hadMarketParam: boolean };

export function RankingsTable({ rows, initial, hadMarketParam }: Props) {
  const [f, setF] = useState<Filters>(initial);
  const [picked, setPicked] = useState<string[]>([]);
  const { country: myCountry, ready } = useRegion();
  const firstRun = useRef(true);
  const appliedRegion = useRef(false);
  // True while the country filter is the one we detected, not one the viewer picked.
  const [autoCountry, setAutoCountry] = useState(false);

  // Default the country filter to the viewer's country once, unless the link already set one.
  useEffect(() => {
    if (!ready || appliedRegion.current || hadMarketParam) return;
    appliedRegion.current = true;
    if (myCountry) {
      setF((prev) => ({ ...prev, country: myCountry }));
      setAutoCountry(true);
    }
  }, [ready, myCountry, hadMarketParam]);

  // Keep the URL in sync so any view can be shared and reopened exactly.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    // A detected country stays out of the URL, so a shared link follows each reader's own location.
    const qs = serializeFilters(autoCountry ? { ...f, country: '' } : f);
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    window.history.replaceState(window.history.state, '', url);
  }, [f, autoCountry]);

  // In a country view every card is scored and ranked for that country.
  const ranked = useMemo(() => (f.country ? rankIn(rows, f.country) : rows), [rows, f.country]);
  const visible = useMemo(() => sortRows(filterRows(ranked, f), f.sort), [ranked, f]);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const onSort = (key: SortKey, additive: boolean) => {
    setF((prev) => ({ ...prev, sort: toggleSort(prev.sort, key, additive) }));
  };

  const togglePick = (slug: string) => {
    setPicked((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_COMPARE) return prev;
      track('Compare add', { card: slug });
      return [...prev, slug];
    });
  };

  const sortState = (key: SortKey) => {
    const i = f.sort.findIndex((r) => r.key === key);
    if (i === -1) return null;
    return { dir: f.sort[i].dir, order: i + 1 };
  };

  const place = f.country ? countryName(f.country) : undefined;
  const description = describeFilters(f, place);
  const confirmed = f.country ? ranked.filter((c) => availabilityIn(c, f.country) === 'yes').length : 0;
  const isDefault = serializeFilters(f) === serializeFilters(DEFAULT_FILTERS);

  const sortHead = (k: SortKey, label?: string, style?: React.CSSProperties) => {
    const s = sortState(k);
    const ariaSort = s && s.order === 1 ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return (
      <th scope="col" aria-sort={ariaSort} key={k} style={style}>
        <button
          type="button"
          className="sort-btn"
          data-active={s ? 'true' : 'false'}
          onClick={(e) => onSort(k, e.shiftKey)}
          title="Click to sort. Shift-click to add a second sort."
        >
          {label ?? COLUMNS[k].label}
          <span aria-hidden="true" style={{ fontSize: 10 }}>
            {s ? (s.dir === 'asc' ? '▲' : '▼') : '↕'}
            {s && f.sort.length > 1 ? s.order : ''}
          </span>
        </button>
      </th>
    );
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      {/* Filters */}
      <div className="panel panel-pad stack" style={{ gap: 16 }}>
        <NomadBar
          idPrefix="f"
          passport={f.passport}
          home={f.country}
          myCountry={myCountry}
          onPassport={(v) => set('passport', v)}
          onHome={(v) => {
            setAutoCountry(false);
            set('country', v);
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '2 1 260px' }}>
            <label className="field-label" htmlFor="f-q">
              Search
            </label>
            <div className="search" style={{ maxWidth: 'none', borderRadius: 12, padding: '0 14px' }}>
              <SearchIcon />
              <input
                id="f-q"
                type="search"
                value={f.q}
                placeholder="Card, brand or region"
                onChange={(e) => set('q', e.target.value.slice(0, 80))}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="field" style={{ flex: '1 1 160px' }}>
            <label className="field-label" htmlFor="f-custody">
              Custody
            </label>
            <select
              id="f-custody"
              className="select"
              value={f.custody}
              onChange={(e) => set('custody', e.target.value as Filters['custody'])}
            >
              <option value="">Any</option>
              <option value="self">Self-custodial</option>
              <option value="custodial">Custodial</option>
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 140px' }}>
            <label className="field-label" htmlFor="f-net">
              Network
            </label>
            <select
              id="f-net"
              className="select"
              value={f.net}
              onChange={(e) => set('net', e.target.value as Filters['net'])}
            >
              <option value="">Any</option>
              <option value="visa">Visa</option>
              <option value="mastercard">Mastercard</option>
              <option value="amex">Amex</option>
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 140px' }}>
            <label className="field-label" htmlFor="f-min">
              Typical cashback
            </label>
            <select
              id="f-min"
              className="select"
              value={String(f.min)}
              onChange={(e) => set('min', Number(e.target.value))}
            >
              <option value="0">Any</option>
              <option value="1">1%+</option>
              <option value="2">2%+</option>
              <option value="3">3%+</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button type="button" className="chip" aria-pressed={f.nofee} onClick={() => set('nofee', !f.nofee)}>
            No annual fee
          </button>
          <button type="button" className="chip" aria-pressed={f.physical} onClick={() => set('physical', !f.physical)}>
            Physical card
          </button>
          <button type="button" className="chip" aria-pressed={f.metal} onClick={() => set('metal', !f.metal)}>
            Metal card
          </button>
          <button type="button" className="chip" aria-pressed={f.lounge} onClick={() => set('lounge', !f.lounge)}>
            Lounge access
          </button>
          {f.country ? (
            <label className="check" style={{ marginLeft: 4 }}>
              <input type="checkbox" checked={f.strict} onChange={(e) => set('strict', e.target.checked)} />
              Only cards confirmed in {place}
            </label>
          ) : null}
          {!isDefault ? (
            <button type="button" className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setF(DEFAULT_FILTERS)}>
              Reset filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="pager">
        <p className="muted" aria-live="polite">
          <b style={{ color: 'var(--text)' }}>{visible.length}</b> of {rows.length} cards · {description}
          {f.country && !f.strict ? ` (${confirmed} confirmed)` : ''}
          {f.country && confirmed === 0 && visible.length ? (
            <>
              <br />
              No card has confirmed {place} yet, so this is the global ranking. Check with the issuer before you apply.
            </>
          ) : null}
        </p>
        <ShareBar text={`Crypto cards ${description === 'all cards' ? 'ranked' : `${description}, ranked`} on G2M`} />
      </div>

      {visible.length === 0 ? (
        <div className="panel panel-pad stack" style={{ gap: 10, alignItems: 'flex-start' }}>
          <h2 className="h3">No cards match these filters</h2>
          <p className="muted">Try another country, or allow cards whose availability is not confirmed yet.</p>
          <button type="button" className="btn btn-sm" onClick={() => setF(DEFAULT_FILTERS)}>
            Show all cards
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="table-wrap rank-table">
            <table className="table">
              <caption className="sr-only">Crypto cards ranked by G2M score</caption>
              <thead>
                <tr>
                  {sortHead('rank', '#', { width: 64 })}
                  {sortHead('name')}
                  {sortHead('score')}
                  {sortHead('cashback', 'Base back')}
                  {sortHead('max', 'Max back')}
                  {sortHead('annual')}
                  {sortHead('fx')}
                  <th scope="col">Custody</th>
                  {f.country ? <th scope="col">In {place}</th> : sortHead('countries')}
                  <th scope="col">
                    <span className="sr-only">Compare</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => {
                  // Overall rank never changes with sorting or filtering, like a market-cap rank.
                  const rank = c.rank;
                  const on = picked.includes(c.slug);
                  return (
                    <tr key={c.slug}>
                      <td className={`rank ${rank === 1 ? 'rank-1' : ''}`}>{rank}</td>
                      <td>
                        <div className="card-cell">
                          <CardArt card={c} size="sm" />
                          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                            <Link href={`/cards/${c.slug}`}>{c.name}</Link>
                            <span className="faint" style={{ fontSize: 13 }}>
                              {c.network} · {c.forms.includes('metal') ? 'Metal available' : c.forms.includes('physical') ? 'Physical + virtual' : 'Virtual'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <ScorePill value={c.score.total} />
                      </td>
                      <td className="num">{pct(c.cashback.basePct, '—')}</td>
                      <td className="num">
                        {c.cashback.maxPct != null ? pct(c.cashback.maxPct) : '—'}
                        {c.cashback.payout ? (
                          <span className="faint" style={{ display: 'block', fontSize: 12 }}>
                            in {c.cashback.payout.split(',')[0]}
                          </span>
                        ) : null}
                      </td>
                      <td className="num">{usd(c.fees.annualUsd, '—')}</td>
                      <td className="num">{pct(c.fees.fxPct, '—')}</td>
                      <td>
                        <span className={`badge ${c.custody === 'self-custodial' ? 'badge-accent' : 'badge-unknown'}`}>
                          {CUSTODY_LABEL[c.custody]}
                        </span>
                      </td>
                      <td>
                        {f.country ? (
                          <div className="stack" style={{ gap: 4, alignItems: 'flex-start' }}>
                            <MarketBadge value={availabilityIn(c, f.country)} where={place} />
                            <NomadBadge fit={nomadFit(c, f.passport, f.country)} />
                          </div>
                        ) : (
                          <span className="num" title={c.coverage.scope}>
                            {c.coverage.countries ?? '—'}
                          </span>
                        )}
                      </td>
                      <td>
                        <label className="check" title={on ? 'Remove from compare' : 'Add to compare'}>
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={!on && picked.length >= MAX_COMPARE}
                            onChange={() => togglePick(c.slug)}
                          />
                          <span className="sr-only">Compare {c.name}</span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Phone list */}
          <ol className="rank-list" aria-label="Crypto cards ranked by G2M score">
            {visible.map((c) => {
              const rank = c.rank;
              const on = picked.includes(c.slug);
              return (
                <li key={c.slug} className="panel rank-item">
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className={`rank ${rank === 1 ? 'rank-1' : ''}`} style={{ width: 24 }}>
                      {rank}
                    </span>
                    <CardArt card={c} size="sm" />
                    <div className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                      <Link href={`/cards/${c.slug}`} style={{ fontWeight: 650, textDecoration: 'none' }}>
                        {c.name}
                      </Link>
                      <span className="faint" style={{ fontSize: 13 }}>
                        {c.network} · {c.custody === 'unknown' ? 'Custody not published' : CUSTODY_LABEL[c.custody]}
                      </span>
                    </div>
                    <ScorePill value={c.score.total} showBar={false} />
                  </div>
                  <dl className="rank-item-facts">
                    <div>
                      <dt>Cashback</dt>
                      <dd>
                        {c.cashback.basePct != null
                          ? pct(c.cashback.basePct)
                          : c.cashback.maxPct != null
                            ? `Up to ${pct(c.cashback.maxPct)}`
                            : NP}
                      </dd>
                    </div>
                    <div>
                      <dt>Annual fee</dt>
                      <dd>{usd(c.fees.annualUsd, '—')}</dd>
                    </div>
                    <div>
                      <dt>FX fee</dt>
                      <dd>{pct(c.fees.fxPct, '—')}</dd>
                    </div>
                    <div>
                      <dt>{f.country ? `In ${place}` : 'Countries'}</dt>
                      <dd>
                        {f.country ? (
                          <MarketBadge value={availabilityIn(c, f.country)} short />
                        ) : (
                          c.coverage.countries ?? '—'
                        )}
                      </dd>
                    </div>
                  </dl>
                  <NomadBadge fit={nomadFit(c, f.passport, f.country)} />
                  <label className="check" style={{ fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!on && picked.length >= MAX_COMPARE}
                      onChange={() => togglePick(c.slug)}
                    />
                    Compare
                  </label>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <p className="faint" style={{ fontSize: 13 }}>
        “—” means the issuer does not publish that figure. Max cashback usually needs a top tier, staking or a paid plan.
        Click a column to sort; shift-click to add a second sort.
      </p>

      {picked.length > 0 ? (
        <div className="compare-bar" role="region" aria-label="Compare selection">
          <div className="wrap" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>
              {picked.length} of {MAX_COMPARE} selected
            </span>
            <span className="faint" style={{ fontSize: 14, flex: 1, minWidth: 0 }}>
              {picked.map((s) => rows.find((r) => r.slug === s)?.brand).join(' · ')}
            </span>
            <button type="button" className="btn btn-sm" onClick={() => setPicked([])}>
              Clear
            </button>
            <Link
              href={`/compare?c=${picked.join(',')}`}
              className="btn btn-sm btn-metal"
              aria-disabled={picked.length < 2}
              onClick={(e) => {
                if (picked.length < 2) e.preventDefault();
                else track('Compare open', { n: picked.length });
              }}
            >
              {picked.length < 2 ? 'Pick one more' : `Compare ${picked.length} cards`}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
