'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardRow } from '@/lib/types';
import { COUNTRIES, availabilityIn, countryName, isCountry } from '@/lib/regions';
import { corridorMatches, destinations, railLabel, MAIN_DESTINATIONS } from '@/lib/corridors';
import { CardArt } from '@/components/CardArt';
import { Chips } from '@/components/Chips';
import { ShareBar } from '@/components/ShareBar';
import { MarketBadge } from '@/components/bits';
import { useRegion } from '@/components/RegionContext';
import { track } from '@/lib/analytics';
import { fillNodes, fillText, intlFmt } from '@/lib/i18n/clientFormat';
import { corridorEn } from '@/lib/i18n/ui/corridor/en';
import type { Ui } from '@/lib/i18n/ui/en';

type Props = {
  rows: CardRow[];
  initialCoin: 'USDC' | 'USDT';
  initialTo: string;
  initialCountry: string;
  hadCountry: boolean;
  /** Another language (English when left out): its words, language tag, address prefix (/de), country names and the
   *  issuers' rail fee notes from the sheet, English → translation. */
  ui?: Ui;
  tag?: string;
  prefix?: string;
  countryNames?: Record<string, string>;
  sheet?: Record<string, string>;
};

// Move a stablecoin to a bank: which cards can receive money or cash out on a chosen rail, and what it costs.
export function CorridorFinder({ rows, initialCoin, initialTo, initialCountry, hadCountry, ui, tag, prefix = '', countryNames, sheet }: Props) {
  const english = !ui || !tag;
  const w = english ? corridorEn : ui.corridor;
  const fmt = useMemo(() => (english ? null : intlFmt(tag!, ui!, countryNames)), [english, tag, ui, countryNames]);
  const place = (cc: string) => (fmt ? fmt.country(cc) : countryName(cc));
  const countryList = fmt ? fmt.countries() : COUNTRIES;
  const num = (n: number) => (english ? String(n) : n.toLocaleString(tag));
  // Rail names in the page's language: "EUR SEPA", "USD wire", "SWIFT wire".
  const rail = (r: string) => {
    if (english) return railLabel(r);
    if (r === 'SWIFT') return w.swiftWire;
    const [cur, method] = r.split('_');
    const word = { WIRE: w.mWIRE, FPS: w.mFPS, BANK: w.mBANK }[method];
    return word ? `${cur} ${word}` : railLabel(r);
  };
  const tx = (s: string) => (english ? s : (sheet?.[s] ?? s));

  const [coin, setCoin] = useState<'USDC' | 'USDT'>(initialCoin);
  const [to, setTo] = useState(initialTo);
  const [country, setCountry] = useState(initialCountry);
  const { country: myCountry, ready } = useRegion();
  const regionApplied = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    if (!ready || regionApplied.current || hadCountry) return;
    regionApplied.current = true;
    if (myCountry) setCountry(myCountry);
  }, [ready, myCountry, hadCountry]);

  const dests = useMemo(() => {
    const all = destinations(rows);
    if (english) return all;
    const main = new Set<string>(MAIN_DESTINATIONS.map((d) => d.id));
    return all.map((d) => ({ id: d.id, label: main.has(d.id) ? (w as typeof corridorEn)[`d${d.id}` as 'dEUR'] : fillText(w.dLocal, { cur: d.id }) }));
  }, [rows, english, w]);
  const eligible = useMemo(() => (country ? rows.filter((r) => availabilityIn(r, country) !== 'no') : rows), [rows, country]);
  const results = useMemo(() => corridorMatches(eligible, to, coin), [eligible, to, coin]);
  const unknown = eligible.filter((r) => r.bankRails == null).length;
  const destLabel = dests.find((d) => d.id === to)?.label ?? to;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const p = new URLSearchParams({ coin, to });
    if (country) p.set('country', country);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${p.toString()}`);
    const t = setTimeout(() => track('Corridor', { coin, to, country: country || 'ALL' }), 800);
    return () => clearTimeout(t);
  }, [coin, to, country]);

  const cashOut = results.filter((r) => r.cashOut).length;
  const receive = results.filter((r) => r.receive).length;
  const receiveText = { named: w.named, shared: w.shared, account: w.account };

  return (
    <div className="stack" style={{ gap: 24 }}>
      <form className="panel panel-pad stack" style={{ gap: 18 }} onSubmit={(e) => e.preventDefault()}>
        <div className="calc-grid">
          <Chips
            label={w.move}
            value={coin}
            onChange={setCoin}
            options={[
              { value: 'USDC', label: 'USDC' },
              { value: 'USDT', label: 'USDT' }
            ]}
          />
          <div className="field">
            <label className="field-label" htmlFor="cf-to">
              {w.to}
            </label>
            <select id="cf-to" className="select" value={to} onChange={(e) => setTo(e.target.value)}>
              {dests.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="cf-country">
              {w.whereLive}
            </label>
            <select id="cf-country" className="select" value={country} onChange={(e) => setCountry(isCountry(e.target.value) ? e.target.value : '')}>
              <option value="">{w.allCountries}</option>
              {countryList.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                  {c.code === myCountry ? w.yourLocation : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>

      <div className="pager">
        <p className="muted" style={{ margin: 0 }}>
          {fillNodes(w.summary, {
            coin: <b style={{ color: 'var(--text)' }}>{coin}</b>,
            dest: <b style={{ color: 'var(--text)' }}>{destLabel}</b>,
            cash: fillText(cashOut === 1 ? w.cardsOne : w.cardsMany, { n: num(cashOut) }),
            receive: fillText(w.receiveN, { n: num(receive) })
          })}
          {country ? fillText(w.inCountry, { place: place(country) }) : ''}
        </p>
        <ShareBar text={fillText(w.share, { coin, dest: destLabel })} words={english ? undefined : ui.common} />
      </div>

      {results.length === 0 ? (
        <div className="panel panel-pad">
          <p className="muted" style={{ margin: 0 }}>
            {fillText(w.none, { where: country ? fillText(w.noneWhere, { place: place(country) }) : '', dest: destLabel })}
          </p>
        </div>
      ) : (
        <div className="table-wrap calc-wrap">
          <table className="table calc-table">
            <caption className="sr-only">{fillText(w.caption, { coin, dest: destLabel })}</caption>
            <thead>
              <tr>
                <th scope="col">{w.thCard}</th>
                <th scope="col">{w.thCashOut}</th>
                <th scope="col">{w.thReceive}</th>
                <th scope="col">{w.thRail}</th>
                <th scope="col">{w.thFees}</th>
                <th scope="col">{w.thNonRes}</th>
                <th scope="col">{coin}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((m) => (
                <tr key={m.card.slug}>
                  <td>
                    <div className="card-cell">
                      <CardArt card={m.card} size="sm" />
                      <div className="stack" style={{ gap: 2 }}>
                        <Link href={`${prefix}/cards/${m.card.slug}`}>{m.card.name}</Link>
                        <span className="faint" style={{ fontSize: 13 }}>
                          {fillText(w.score, { n: num(m.card.score.total) })}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td data-label={w.dlCashOut}>
                    <MarketBadge value={m.cashOut ? 'yes' : 'no'} where={w.dlCashOut} short words={english ? undefined : ui.common} />
                  </td>
                  <td data-label={w.dlReceive}>{m.receive ? receiveText[m.receive] : <span className="faint">{w.no}</span>}</td>
                  <td data-label={w.thRail}>{m.rails.map((r) => rail(r.rail)).join(', ')}</td>
                  <td data-label={w.thFees} className="corridor-fees">
                    {m.fees.length ? (
                      english ? (
                        m.fees.join(' · ')
                      ) : (
                        m.rails
                          .filter((r) => r.fee)
                          .map((r) => `${rail(r.rail)}: ${tx(r.fee!)}`)
                          .join(' · ')
                      )
                    ) : (
                      <span className="faint">{w.notPublished}</span>
                    )}
                  </td>
                  <td data-label={w.thNonRes}>
                    {m.card.bankForNonResidents == null ? (
                      <span className="faint">{w.notPublished}</span>
                    ) : m.card.bankForNonResidents ? (
                      w.yes
                    ) : (
                      w.no
                    )}
                  </td>
                  <td data-label={coin}>
                    {m.coin === 'listed' ? w.supported : m.coin === 'no' ? w.no : <span className="faint">{w.notStated}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="faint" style={{ fontSize: 13, maxWidth: '90ch' }}>
        {w.footA}
        {unknown ? fillText(unknown === 1 ? w.unknownOne : w.unknownMany, { n: num(unknown) }) : ''}
        {w.footB}
      </p>
    </div>
  );
}
