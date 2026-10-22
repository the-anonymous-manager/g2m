'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardRow } from '@/lib/types';
import { COUNTRIES, availabilityIn, countryName, isCountry } from '@/lib/regions';
import { currencyOf } from '@/lib/currencies.mjs';
import { parseCalcInput, rankByValue, type CalcInput } from '@/lib/calc';
import { money } from '@/lib/format';
import { CardArt } from '@/components/CardArt';
import { ShareBar } from '@/components/ShareBar';
import { useRegion } from '@/components/RegionContext';
import { track } from '@/lib/analytics';

type Props = { rows: CardRow[]; initial: CalcInput; initialCountry: string; hadCountry: boolean };

export function CalculatorClient({ rows, initial, initialCountry, hadCountry }: Props) {
  // Raw text for the inputs, so typing never jumps; parsed and clamped values drive the maths.
  const [spendText, setSpendText] = useState(String(initial.spend));
  const [foreignText, setForeignText] = useState(String(initial.foreign));
  const [ticketText, setTicketText] = useState(String(initial.ticket));
  const [all, setAll] = useState(initial.all);
  const [country, setCountry] = useState(initialCountry);
  const { country: myCountry, ready } = useRegion();
  const first = useRef(true);
  const regionApplied = useRef(false);

  // Start from where the visitor is, unless the link already says a country.
  useEffect(() => {
    if (!ready || regionApplied.current || hadCountry) return;
    regionApplied.current = true;
    if (myCountry) setCountry(myCountry);
  }, [ready, myCountry, hadCountry]);
  const currency = currencyOf(country);

  const input = useMemo(
    () => parseCalcInput({ spend: spendText, foreign: foreignText, ticket: ticketText, all }),
    [spendText, foreignText, ticketText, all]
  );

  const eligible = useMemo(() => (country ? rows.filter((r) => availabilityIn(r, country) !== 'no') : rows), [rows, country]);
  const results = useMemo(() => rankByValue(eligible, input, country || null), [eligible, input, country]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const p = new URLSearchParams({ spend: String(input.spend), foreign: String(input.foreign), ticket: String(input.ticket) });
    if (input.all) p.set('all', '1');
    if (country) p.set('country', country);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${p.toString()}`);
    const t = setTimeout(() => track('Calculator', { spend: input.spend, country: country || 'ALL' }), 800);
    return () => clearTimeout(t);
  }, [input, country]);

  const spendErr = spendText !== '' && (!Number.isFinite(Number(spendText)) || Number(spendText) < 0 || Number(spendText) > 1_000_000);
  const foreignErr = foreignText !== '' && (!Number.isFinite(Number(foreignText)) || Number(foreignText) < 0 || Number(foreignText) > 100);
  const ticketErr = ticketText !== '' && (!Number.isFinite(Number(ticketText)) || Number(ticketText) < 1 || Number(ticketText) > 10_000);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <form className="panel panel-pad stack" style={{ gap: 16 }} onSubmit={(e) => e.preventDefault()}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
          <div className="field">
            <label className="field-label" htmlFor="c-country">
              Where you live
            </label>
            <select id="c-country" className="select" value={country} onChange={(e) => setCountry(isCountry(e.target.value) ? e.target.value : '')}>
              <option value="">All countries</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                  {c.code === myCountry ? ' (your location)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="c-spend">
              Monthly card spend (USD)
            </label>
            <input
              id="c-spend"
              className="input num"
              inputMode="decimal"
              value={spendText}
              onChange={(e) => setSpendText(e.target.value.replace(/[^\d.]/g, ''))}
              aria-invalid={spendErr}
              aria-describedby="c-spend-help"
            />
            <span id="c-spend-help" className="faint" style={{ fontSize: 12, color: spendErr ? 'var(--bad)' : undefined }}>
              {spendErr ? 'Enter an amount from 0 to 1,000,000' : 'What you spend on the card each month'}
            </span>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="c-foreign">
              Spent in other currencies (%)
            </label>
            <input
              id="c-foreign"
              className="input num"
              inputMode="decimal"
              value={foreignText}
              onChange={(e) => setForeignText(e.target.value.replace(/[^\d.]/g, ''))}
              aria-invalid={foreignErr}
              aria-describedby="c-foreign-help"
            />
            <span id="c-foreign-help" className="faint" style={{ fontSize: 12, color: foreignErr ? 'var(--bad)' : undefined }}>
              {foreignErr
                ? 'Enter a percentage from 0 to 100'
                : currency
                  ? `Not in ${currency}: travel and foreign shops. The rest is spent in ${currency}.`
                  : 'Travel and shopping in other currencies'}
            </span>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="c-ticket">
              Average purchase (USD)
            </label>
            <input
              id="c-ticket"
              className="input num"
              inputMode="decimal"
              value={ticketText}
              onChange={(e) => setTicketText(e.target.value.replace(/[^\d.]/g, ''))}
              aria-invalid={ticketErr}
              aria-describedby="c-ticket-help"
            />
            <span id="c-ticket-help" className="faint" style={{ fontSize: 12, color: ticketErr ? 'var(--bad)' : undefined }}>
              {ticketErr ? 'Enter an amount from 1 to 10,000' : 'Used for per-purchase fees'}
            </span>
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          Include tiers that need staking, a token lockup or an invite
        </label>
      </form>

      <div className="pager">
        <p className="muted">
          Yearly value at <b style={{ color: 'var(--text)' }}>{money(input.spend)}</b> a month
          {country ? ` · cards you may get in ${countryName(country)}` : ''}
          {currency ? ` · everyday spending in ${currency}` : ''} · best tier for each card
        </p>
        <ShareBar text={`What ${money(input.spend)}/month earns on each crypto card, after fees · G2M calculator`} />
      </div>

      <div className="table-wrap">
        <table className="table" style={{ minWidth: 900 }}>
          <caption className="sr-only">Yearly rewards after fees for each card</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Card · best tier</th>
              <th scope="col">Cashback / yr</th>
              <th scope="col">Plan fee / yr</th>
              <th scope="col">FX cost / yr</th>
              <th scope="col">Purchase fees / yr</th>
              <th scope="col">You keep / yr</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={r.card.slug}>
                <td className={`rank ${i === 0 ? 'rank-1' : ''}`}>{i + 1}</td>
                <td>
                  <div className="card-cell">
                    <CardArt card={r.card} size="sm" />
                    <div className="stack" style={{ gap: 2 }}>
                      <Link href={`/cards/${r.card.slug}`}>{r.card.name}</Link>
                      <span className="faint" style={{ fontSize: 13 }}>
                        {r.tier.name}
                      </span>
                      {/* Phones see this column only after scrolling sideways, so repeat the answer here. */}
                      <span className="phone-only" style={{ fontSize: 13, fontWeight: 700, color: r.net >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                        You keep {money(r.net)} a year
                      </span>
                    </div>
                  </div>
                </td>
                <td className="num">{money(r.cashback)}</td>
                <td className="num">{r.fee ? `−${money(r.fee)}` : '$0'}</td>
                <td className="num">{r.fx ? `−${money(r.fx)}` : '$0'}</td>
                <td className="num">{r.tx ? `−${money(r.tx)}` : '$0'}</td>
                <td className="num" style={{ fontWeight: 700, color: r.net >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                  {money(r.net)}
                </td>
                <td style={{ fontSize: 13, maxWidth: 260 }} className="muted">
                  {r.flags.length ? r.flags.join(' · ') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="faint" style={{ fontSize: 13, maxWidth: '90ch' }}>
        Rewards paid in tokens or points are counted at face value; their real value moves with the market. Missing figures
        are counted as zero and flagged in Notes. Spending caps and band limits are applied where the issuer publishes them.
      </p>
    </div>
  );
}
