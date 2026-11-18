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
import { REGIONS, availabilityIn, availabilityInRegion, confirmedCountriesIn, isCountry } from '@/lib/regions';
import { nomadFit } from '@/lib/nomad';
import { NomadBadge, NomadBar } from '@/components/NomadBar';
import { rankIn } from '@/lib/score';
import { CUSTODY_LABEL } from '@/lib/format';
import { englishFmt, fillNodes, fillText, intlFmt } from '@/lib/i18n/clientFormat';
import { uiEn, type Ui } from '@/lib/i18n/ui/en';
import { CardArt } from '@/components/CardArt';
import { MarketBadge, ScorePill, SearchIcon } from '@/components/bits';
import { ShareBar } from '@/components/ShareBar';
import { useRegion } from '@/components/RegionContext';
import { track } from '@/lib/analytics';

const MAX_COMPARE = 3;

// The viewer's own "Where I live" choice ("ALL" = all countries), kept for this visit so going back to the
// rankings, or opening them again, does not put the detected country back over it.
const HOME_KEY = 'g2m_rankings_home';
const savedHome = () => {
  try {
    return sessionStorage.getItem(HOME_KEY);
  } catch {
    return null;
  }
};
const saveHome = (v: string | null) => {
  try {
    if (v == null) sessionStorage.removeItem(HOME_KEY);
    else sessionStorage.setItem(HOME_KEY, v);
  } catch {
    // private mode or blocked storage: the choice just lasts until the page changes
  }
};

type Props = {
  rows: CardRow[];
  initial: Filters;
  hadMarketParam: boolean;
  allCountries?: boolean;
  /** Another language: its tool pack, its BCP 47 tag (for Intl) and its address prefix ("/de"). English when left out. */
  ui?: Ui;
  tag?: string;
  prefix?: string;
  /** Country names in that language, from the server (see intlFmt). */
  countryNames?: Record<string, string>;
};

export function RankingsTable({ rows, initial, hadMarketParam, allCountries = false, ui = uiEn, tag, prefix = '', countryNames }: Props) {
  const t = ui.table;
  const c0 = ui.common;
  const fmt = useMemo(() => (tag ? intlFmt(tag, ui, countryNames) : englishFmt), [tag, ui, countryNames]);
  const english = !tag;
  const custodyLabel = (c: CardRow['custody']) =>
    english ? CUSTODY_LABEL[c] : { 'self-custodial': c0.nonCustodial, custodial: c0.custodial, both: c0.custodyBoth, unknown: c0.notPublished }[c];
  const regionName = (r: keyof typeof REGIONS) => (english ? REGIONS[r].label : ui.regions[r]);
  const cardHref = (slug: string) => `${prefix}/cards/${slug}`;
  // Sort-button words for the other languages (English keeps COLUMNS' own labels).
  const COL_WORDS: Record<SortKey, string> = {
    rank: '#',
    score: t.colScore,
    name: t.colCard,
    cashback: t.colBase,
    max: t.colMax,
    annual: t.colAnnual,
    fx: t.colFx,
    countries: t.colCountries
  };
  const [f, setF] = useState<Filters>(initial);
  const [picked, setPicked] = useState<string[]>([]);
  const { country: myCountry, ready } = useRegion();
  const firstRun = useRef(true);
  const appliedRegion = useRef(false);
  // True while the country filter is the one we detected, not one the viewer picked.
  const [autoCountry, setAutoCountry] = useState(false);

  // Default the country filter to the viewer's country once, unless the link already set one or the viewer chose
  // a place earlier in this visit (which wins, "All countries" included).
  useEffect(() => {
    if (!ready || appliedRegion.current || hadMarketParam) return;
    appliedRegion.current = true;
    const saved = savedHome();
    if (saved === 'ALL') return;
    if (saved && isCountry(saved)) {
      setF((prev) => ({ ...prev, country: saved }));
      return;
    }
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
    // Opened as "all countries" (?country=all): keep saying so while no country is picked, so a reload or the
    // back button shows the same worldwide list instead of the detected country.
    const keepAll = allCountries && !f.country && !f.region;
    const shown = keepAll ? [qs, 'country=all'].filter(Boolean).join('&') : qs;
    const url = `${window.location.pathname}${shown ? `?${shown}` : ''}`;
    window.history.replaceState(window.history.state, '', url);
    // Filters and sorting people use (the search box only once typing stops).
    if (!qs) return; // back to the default view (or only the automatic country): nothing chosen
    const t = setTimeout(() => track('Rankings', { view: qs.slice(0, 120) }), 1500);
    return () => clearTimeout(t);
  }, [f, autoCountry, allCountries]);

  // In a country view every card is scored and ranked for that country.
  const ranked = useMemo(() => (f.country ? rankIn(rows, f.country) : rows), [rows, f.country]);
  // A search (2+ letters) shows every card whose name matches, whatever the country, passport and other filters
  // (Akash, 18 Nov 2026): someone typing "orbitx" from India should see OrbitX, marked "Not available" in its row.
  // Cards not offered in the chosen country come after the ones that are, with no rank there. The filters stay set
  // and apply again once the search box is cleared.
  const searching = f.q.trim().length >= 2;
  const visible = useMemo(() => {
    if (!searching) return sortRows(filterRows(ranked, f), f.sort);
    const words = { ...DEFAULT_FILTERS, q: f.q };
    const open = sortRows(filterRows(ranked, words), f.sort);
    if (!f.country) return open;
    const inList = new Set(ranked.map((c) => c.slug));
    const away = filterRows(rows, words)
      .filter((c) => !inList.has(c.slug))
      .map((c) => ({ ...c, rank: 0 }));
    return [...open, ...away];
  }, [rows, ranked, f, searching]);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setF((prev) => ({ ...prev, [key]: value }));
  // Search ignores the filters that are set: say so under the count.
  const filtersSet = serializeFilters({ ...f, q: '', sort: DEFAULT_FILTERS.sort }) !== serializeFilters(DEFAULT_FILTERS);

  // What people type in the search box and how many cards it finds: a search that finds nothing is a card to add.
  useEffect(() => {
    const q = f.q.trim().toLowerCase();
    if (q.length < 2) return;
    const t = setTimeout(() => track('Search', { q: q.slice(0, 40), found: visible.length }), 2000);
    return () => clearTimeout(t);
  }, [f.q, visible.length]);

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

  const place = f.country ? fmt.country(f.country) : undefined;
  const region = !f.country && f.region ? f.region : null;
  const regionLabel = region ? regionName(region) : undefined;
  const description = describeFilters(f, place, ui.describe, { country: fmt.country, pct: (n) => fmt.pct(n), region: regionName });
  const confirmed = f.country
    ? ranked.filter((c) => availabilityIn(c, f.country) === 'yes').length
    : region
      ? ranked.filter((c) => availabilityInRegion(c, region) === 'yes').length
      : 0;
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
          title={t.sortTitle}
        >
          {label ?? (english ? COLUMNS[k].label : COL_WORDS[k])}
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
          ui={ui}
          fmt={fmt}
          idPrefix="f"
          passport={f.passport}
          home={f.country}
          myCountry={myCountry}
          onPassport={(v) => set('passport', v)}
          onHome={(v) => {
            setAutoCountry(false);
            saveHome(v || 'ALL');
            setF((prev) => ({ ...prev, country: v, region: '' }));
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '2 1 260px' }}>
            <label className="field-label" htmlFor="f-q">
              {t.search}
            </label>
            <div className="search" style={{ maxWidth: 'none', borderRadius: 12, padding: '0 14px' }}>
              <SearchIcon />
              <input
                id="f-q"
                type="search"
                value={f.q}
                placeholder={t.searchPlaceholder}
                onChange={(e) => set('q', e.target.value.slice(0, 80))}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="field" style={{ flex: '1 1 160px' }}>
            <label className="field-label" htmlFor="f-custody">
              {t.custody}
            </label>
            <select
              id="f-custody"
              className="select"
              value={f.custody}
              onChange={(e) => set('custody', e.target.value as Filters['custody'])}
            >
              <option value="">{t.any}</option>
              <option value="self">{english ? 'Non-custodial' : c0.nonCustodial}</option>
              <option value="custodial">{english ? 'Custodial' : c0.custodial}</option>
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 140px' }}>
            <label className="field-label" htmlFor="f-net">
              {t.network}
            </label>
            <select
              id="f-net"
              className="select"
              value={f.net}
              onChange={(e) => set('net', e.target.value as Filters['net'])}
            >
              <option value="">{t.any}</option>
              <option value="visa">Visa</option>
              <option value="mastercard">Mastercard</option>
              <option value="amex">Amex</option>
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 140px' }}>
            <label className="field-label" htmlFor="f-min">
              {t.typicalCashback}
            </label>
            <select
              id="f-min"
              className="select"
              value={String(f.min)}
              onChange={(e) => set('min', Number(e.target.value))}
            >
              <option value="0">{t.any}</option>
              <option value="1">{fmt.pct(1)}+</option>
              <option value="2">{fmt.pct(2)}+</option>
              <option value="3">{fmt.pct(3)}+</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button type="button" className="chip" aria-pressed={f.nofee} onClick={() => set('nofee', !f.nofee)}>
            {t.noAnnualFee}
          </button>
          <button type="button" className="chip" aria-pressed={f.physical} onClick={() => set('physical', !f.physical)}>
            {t.physicalCard}
          </button>
          <button type="button" className="chip" aria-pressed={f.metal} onClick={() => set('metal', !f.metal)}>
            {t.metalCard}
          </button>
          <button type="button" className="chip" aria-pressed={f.lounge} onClick={() => set('lounge', !f.lounge)}>
            {t.lounge}
          </button>
          <button type="button" className="chip" aria-pressed={f.noid} onClick={() => set('noid', !f.noid)}>
            {t.noId}
          </button>
          <button type="button" className="chip" aria-pressed={f.bonus} onClick={() => set('bonus', !f.bonus)}>
            {t.bonus}
          </button>
          {regionLabel ? (
            <button type="button" className="chip is-on" aria-pressed="true" onClick={() => set('region', '')} title={t.showEveryRegion}>
              {regionLabel} <span aria-hidden="true">×</span>
              <span className="sr-only">{t.removeRegion}</span>
            </button>
          ) : null}
          {f.country || regionLabel ? (
            <label className="check" style={{ marginLeft: 4 }}>
              <input type="checkbox" checked={f.strict} onChange={(e) => set('strict', e.target.checked)} />
              {fillText(t.onlyConfirmed, { place: (place ?? regionLabel)! })}
            </label>
          ) : null}
          {!isDefault ? (
            <button type="button" className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => {
                saveHome(null);
                setF(DEFAULT_FILTERS);
              }}>
              {t.reset}
            </button>
          ) : null}
        </div>
      </div>

      <div className="pager">
        <p className="muted" aria-live="polite">
          {fillNodes(t.count, { shown: <b style={{ color: 'var(--text)' }}>{visible.length}</b>, total: rows.length })} · {description}
          {(f.country || region) && !f.strict ? ` ${fillText(t.confirmedCount, { n: confirmed })}` : ''}
          {f.country && confirmed === 0 && visible.length ? (
            <>
              <br />
              {fillText(t.noneConfirmed, { place: place! })}
            </>
          ) : null}
          {searching && filtersSet ? (
            <>
              <br />
              {t.searchAll}
            </>
          ) : null}
        </p>
        <ShareBar
          words={c0}
          text={
            english
              ? `Crypto cards ${description === 'all cards' ? 'ranked' : `${description}, ranked`} on G2M`
              : description === ui.describe.all
                ? t.shareText
                : fillText(t.shareTextFiltered, { description })
          }
        />
      </div>

      {visible.length === 0 ? (
        <div className="panel panel-pad stack" style={{ gap: 10, alignItems: 'flex-start' }}>
          <h2 className="h3">{t.emptyTitle}</h2>
          <p className="muted">{t.emptyText}</p>
          <button type="button" className="btn btn-sm" onClick={() => setF(DEFAULT_FILTERS)}>
            {t.showAll}
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="table-wrap rank-table">
            <table className="table">
              <caption className="sr-only">{t.caption}</caption>
              <thead>
                <tr>
                  {sortHead('rank', '#', { width: 64 })}
                  {sortHead('name')}
                  {sortHead('score')}
                  {sortHead('cashback', t.colBase)}
                  {sortHead('max', t.colMax)}
                  {sortHead('annual')}
                  {sortHead('fx')}
                  <th scope="col">{t.custody}</th>
                  {f.country ? (
                    <th scope="col">{fillText(t.colIn, { place: place! })}</th>
                  ) : region ? (
                    <th scope="col">{fillText(t.colIn, { place: regionLabel! })}</th>
                  ) : (
                    sortHead('countries')
                  )}
                  <th scope="col">
                    <span className="sr-only">{t.compare}</span>
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
                      <td className={`rank ${rank === 1 ? 'rank-1' : ''}`}>{rank || '—'}</td>
                      <td>
                        <div className="card-cell">
                          <CardArt card={c} size="sm" />
                          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                            <Link href={cardHref(c.slug)}>{c.name}</Link>
                            <span className="faint" style={{ fontSize: 13 }}>
                              {c.network} · {c.forms.includes('metal') ? t.metal : c.forms.includes('physical') ? t.physicalVirtual : t.virtual}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <ScorePill value={c.score.total} label={english ? undefined : t.colScore} />
                      </td>
                      <td className="num">{fmt.pct(c.cashback.basePct, '—')}</td>
                      <td className="num">
                        {c.cashback.maxPct != null ? fmt.pct(c.cashback.maxPct) : '—'}
                        {c.cashback.payout ? (
                          <span className="faint" style={{ display: 'block', fontSize: 12 }}>
                            {fillText(t.paidIn, { x: c.cashback.payout.split(',')[0] })}
                          </span>
                        ) : null}
                      </td>
                      <td className="num">{fmt.usd(c.fees.annualUsd, '—')}</td>
                      <td className="num">{fmt.pct(c.fees.fxPct, '—')}</td>
                      <td>
                        <span className={`badge ${c.custody === 'self-custodial' || c.custody === 'both' ? 'badge-accent' : 'badge-unknown'}`}>
                          {english
                            ? CUSTODY_LABEL[c.custody]
                            : { 'self-custodial': t.custSelf, custodial: t.custCustodial, both: t.custBoth, unknown: c0.notPublished }[c.custody]}
                        </span>
                      </td>
                      <td>
                        {f.country ? (
                          <div className="stack" style={{ gap: 4, alignItems: 'flex-start' }}>
                            <MarketBadge value={availabilityIn(c, f.country)} where={place} words={english ? undefined : c0} />
                            <NomadBadge fit={nomadFit(c, f.passport, f.country)} passport={f.passport} home={f.country} ui={english ? undefined : ui} fmt={fmt} />
                          </div>
                        ) : region ? (
                          <RegionBadge card={c} region={region} label={regionLabel!} ui={english ? undefined : ui} />
                        ) : (
                          <span className="num" title={c.coverage.scope}>
                            {c.coverage.countries ?? '—'}
                          </span>
                        )}
                      </td>
                      <td>
                        <label className="check" title={on ? t.removeCompare : t.addCompare}>
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={!on && picked.length >= MAX_COMPARE}
                            onChange={() => togglePick(c.slug)}
                          />
                          <span className="sr-only">{fillText(t.compareCard, { name: c.name })}</span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Phone list */}
          <ol className="rank-list" aria-label={t.caption}>
            {visible.map((c) => {
              const rank = c.rank;
              const on = picked.includes(c.slug);
              return (
                <li key={c.slug} className="panel rank-item">
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className={`rank ${rank === 1 ? 'rank-1' : ''}`} style={{ width: 24 }}>
                      {rank || '—'}
                    </span>
                    <CardArt card={c} size="sm" />
                    <div className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                      <Link href={cardHref(c.slug)} style={{ fontWeight: 650, textDecoration: 'none' }}>
                        {c.name}
                      </Link>
                      <span className="faint" style={{ fontSize: 13 }}>
                        {c.network} · {c.custody === 'unknown' ? c0.custodyNP : custodyLabel(c.custody)}
                      </span>
                    </div>
                    <ScorePill value={c.score.total} showBar={false} label={english ? undefined : t.colScore} />
                  </div>
                  <dl className="rank-item-facts">
                    <div>
                      <dt>{t.cashback}</dt>
                      <dd>
                        {c.cashback.basePct != null
                          ? fmt.pct(c.cashback.basePct)
                          : c.cashback.maxPct != null
                            ? fillText(c0.upTo, { x: fmt.pct(c.cashback.maxPct) })
                            : c0.notPublished}
                      </dd>
                    </div>
                    <div>
                      <dt>{t.colAnnual}</dt>
                      <dd>{fmt.usd(c.fees.annualUsd, '—')}</dd>
                    </div>
                    <div>
                      <dt>{t.fx}</dt>
                      <dd>{fmt.pct(c.fees.fxPct, '—')}</dd>
                    </div>
                    <div>
                      <dt>{f.country ? fillText(t.colIn, { place: place! }) : region ? fillText(t.colIn, { place: regionLabel! }) : t.colCountries}</dt>
                      <dd>
                        {f.country ? (
                          <MarketBadge value={availabilityIn(c, f.country)} short words={english ? undefined : c0} />
                        ) : region ? (
                          <RegionBadge card={c} region={region} label={regionLabel!} short ui={english ? undefined : ui} />
                        ) : (
                          c.coverage.countries ?? '—'
                        )}
                      </dd>
                    </div>
                  </dl>
                  <NomadBadge fit={nomadFit(c, f.passport, f.country)} passport={f.passport} home={f.country} ui={english ? undefined : ui} fmt={fmt} />
                  <label className="check" style={{ fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!on && picked.length >= MAX_COMPARE}
                      onChange={() => togglePick(c.slug)}
                    />
                    {t.compare}
                  </label>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <p className="faint" style={{ fontSize: 13 }}>
        {t.note}
      </p>

      {picked.length > 0 ? (
        <div className="compare-bar" role="region" aria-label={t.compareBar}>
          <div className="wrap" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>
              {fillText(t.selected, { n: picked.length, max: MAX_COMPARE })}
            </span>
            <span className="faint" style={{ fontSize: 14, flex: 1, minWidth: 0 }}>
              {picked.map((s) => rows.find((r) => r.slug === s)?.brand).join(' · ')}
            </span>
            <button type="button" className="btn btn-sm" onClick={() => setPicked([])}>
              {t.clear}
            </button>
            <Link
              href={`${prefix}/compare?c=${picked.join(',')}`}
              className="btn btn-sm btn-metal"
              aria-disabled={picked.length < 2}
              onClick={(e) => {
                if (picked.length < 2) e.preventDefault();
                else track('Compare open', { n: picked.length });
              }}
            >
              {picked.length < 2 ? t.pickOneMore : fillText(t.compareN, { n: picked.length })}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Available in a region: the badge, and for Asia how many of its countries are confirmed. */
function RegionBadge({
  card,
  region,
  label,
  short,
  ui
}: {
  card: CardRow;
  region: keyof typeof REGIONS;
  label: string;
  short?: boolean;
  /** Another language's pack; English when left out. */
  ui?: Ui;
}) {
  const n = region === 'ASIA' ? confirmedCountriesIn(card, region) : 0;
  return (
    <div className="stack" style={{ gap: 4, alignItems: 'flex-start' }}>
      <MarketBadge value={availabilityInRegion(card, region)} where={label} short={short} words={ui?.common} />
      {n ? (
        <span className="faint" style={{ fontSize: 12 }}>
          {ui ? fillText(ui.table.regionCountries, { n }) : `${n} ${n === 1 ? 'country' : 'countries'}`}
        </span>
      ) : null}
    </div>
  );
}
