'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardRow } from '@/lib/types';
import { COUNTRIES, availabilityIn, countryName, isCountry } from '@/lib/regions';
import { corridorMatches, destinations, railLabel } from '@/lib/corridors';
import { CardArt } from '@/components/CardArt';
import { Chips } from '@/components/Chips';
import { ShareBar } from '@/components/ShareBar';
import { MarketBadge } from '@/components/bits';
import { useRegion } from '@/components/RegionContext';
import { track } from '@/lib/analytics';

type Props = { rows: CardRow[]; initialCoin: 'USDC' | 'USDT'; initialTo: string; initialCountry: string; hadCountry: boolean };

const RECEIVE: Record<string, string> = {
  named: 'Account in your name',
  shared: 'Shared account (reference code)',
  account: 'Account details (type not stated)'
};

// Move a stablecoin to a bank: which cards can receive money or cash out on a chosen rail, and what it costs.
export function CorridorFinder({ rows, initialCoin, initialTo, initialCountry, hadCountry }: Props) {
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

  const dests = useMemo(() => destinations(rows), [rows]);
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

  return (
    <div className="stack" style={{ gap: 24 }}>
      <form className="panel panel-pad stack" style={{ gap: 18 }} onSubmit={(e) => e.preventDefault()}>
        <div className="calc-grid">
          <Chips
            label="Move"
            value={coin}
            onChange={setCoin}
            options={[
              { value: 'USDC', label: 'USDC' },
              { value: 'USDT', label: 'USDT' }
            ]}
          />
          <div className="field">
            <label className="field-label" htmlFor="cf-to">
              To
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
              Where you live
            </label>
            <select id="cf-country" className="select" value={country} onChange={(e) => setCountry(isCountry(e.target.value) ? e.target.value : '')}>
              <option value="">All countries</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                  {c.code === myCountry ? ' (your location)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>

      <div className="pager">
        <p className="muted" style={{ margin: 0 }}>
          <b style={{ color: 'var(--text)' }}>{coin}</b> to <b style={{ color: 'var(--text)' }}>{destLabel}</b>: {cashOut} card
          {cashOut === 1 ? '' : 's'} can cash out, {receive} can receive money
          {country ? ` · cards you may get in ${countryName(country)}` : ''}
        </p>
        <ShareBar text={`Which crypto cards move ${coin} to ${destLabel} · G2M corridor finder`} />
      </div>

      {results.length === 0 ? (
        <div className="panel panel-pad">
          <p className="muted" style={{ margin: 0 }}>
            No card {country ? `available in ${countryName(country)} ` : ''}has a confirmed {destLabel} rail yet. Try SWIFT, or
            another currency.
          </p>
        </div>
      ) : (
        <div className="table-wrap calc-wrap">
          <table className="table calc-table">
            <caption className="sr-only">
              Cards that move {coin} to {destLabel}
            </caption>
            <thead>
              <tr>
                <th scope="col">Card</th>
                <th scope="col">Cash out to a bank</th>
                <th scope="col">Receive from a bank</th>
                <th scope="col">Rail</th>
                <th scope="col">Fees and notes</th>
                <th scope="col">Non-residents</th>
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
                        <Link href={`/cards/${m.card.slug}`}>{m.card.name}</Link>
                        <span className="faint" style={{ fontSize: 13 }}>
                          G2M score {m.card.score.total}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Cash out">
                    <MarketBadge value={m.cashOut ? 'yes' : 'no'} where="Cash out" short />
                  </td>
                  <td data-label="Receive">{m.receive ? RECEIVE[m.receive] : <span className="faint">No</span>}</td>
                  <td data-label="Rail">{m.rails.map((r) => railLabel(r.rail)).join(', ')}</td>
                  <td data-label="Fees and notes" className="corridor-fees">
                    {m.fees.length ? m.fees.join(' · ') : <span className="faint">Not published</span>}
                  </td>
                  <td data-label="Non-residents">
                    {m.card.bankForNonResidents == null ? (
                      <span className="faint">Not published</span>
                    ) : m.card.bankForNonResidents ? (
                      'Yes'
                    ) : (
                      'No'
                    )}
                  </td>
                  <td data-label={coin}>
                    {m.coin === 'listed' ? 'Supported' : <span className="faint">Not stated</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="faint" style={{ fontSize: 13, maxWidth: '90ch' }}>
        Rails come from each issuer&apos;s own help pages and fee lists. &ldquo;Cash out&rdquo; means you can send money from the app
        to a bank account on that rail; &ldquo;receive&rdquo; means the app gives you account details a bank can pay into. Fees
        are shown where the issuer publishes them (&ldquo;in&rdquo; = receiving, &ldquo;out&rdquo; = cashing out).{' '}
        {unknown ? `${unknown} card${unknown === 1 ? '' : 's'} here ha${unknown === 1 ? 's' : 've'} no confirmed rails yet. ` : ''}
        Check limits and eligibility with the issuer before you move money.
      </p>
    </div>
  );
}
