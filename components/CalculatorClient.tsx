'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardRow } from '@/lib/types';
import { COUNTRIES, availabilityIn, countryName, isCountry } from '@/lib/regions';
import { currencyOf } from '@/lib/currencies.mjs';
import {
  BREAK_EVEN_LIMIT,
  breakEvens,
  calcParams,
  hasPhysical,
  parseCalcInput,
  payoutKind,
  rankByValue,
  tierValue,
  type CalcInput,
  type CalcMode,
  type TierResult
} from '@/lib/calc';
import { money } from '@/lib/format';
import { CardArt } from '@/components/CardArt';
import { ShareBar } from '@/components/ShareBar';
import { SwipeReceipt } from '@/components/SwipeReceipt';
import { WalletCombo } from '@/components/WalletCombo';
import { useRegion } from '@/components/RegionContext';
import { track } from '@/lib/analytics';

type Props = {
  rows: CardRow[];
  initial: CalcInput;
  initialCountry: string;
  hadCountry: boolean;
  /** Units of each currency per US dollar, for the swipe receipt. */
  perUsd: Record<string, number> | null;
};

const MODES: { id: CalcMode; label: string; short: string }[] = [
  { id: 'best', label: 'Best card for me', short: 'Best card' },
  { id: 'tiers', label: 'Compare tiers of one card', short: 'Compare tiers' },
  { id: 'audit', label: 'One card, line by line', short: 'Line by line' }
];

/** Dollars with cents for small amounts, whole dollars from $100. */
const cash = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 100 || abs === 0) return money(n);
  return `${n < 0 ? '−' : ''}$${abs.toFixed(2)}`;
};
const minus = (n: number) => (n > 0.004 ? `−${cash(n)}` : '$0');
const keepColor = (n: number) => (n >= 0 ? 'var(--ok)' : 'var(--bad)');

function Chips<T extends string | number>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="chip-row" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" className="chip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const numText = (v: string) => v.replace(/[^\d.]/g, '');
const bad = (text: string, min: number, max: number) => text !== '' && (!Number.isFinite(Number(text)) || Number(text) < min || Number(text) > max);

export function CalculatorClient({ rows, initial, initialCountry, hadCountry, perUsd }: Props) {
  // Raw text for number inputs, so typing never jumps; parsed and clamped values drive the maths.
  const [spendText, setSpendText] = useState(String(initial.spend));
  const [usdText, setUsdText] = useState(String(initial.usd));
  const [travelText, setTravelText] = useState(String(initial.travel));
  const [ticketText, setTicketText] = useState(String(initial.ticket));
  const [opts, setOpts] = useState({
    mode: initial.mode,
    mix: initial.mix,
    value: initial.value,
    form: initial.form,
    year: initial.year,
    tiers: initial.tiers,
    all: initial.all,
    card: initial.card,
    tier: initial.tier
  });
  const set = <K extends keyof typeof opts>(k: K, v: (typeof opts)[K]) => setOpts((o) => ({ ...o, [k]: v }));
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
    () => parseCalcInput({ ...opts, spend: spendText, usd: usdText, travel: travelText, ticket: ticketText }),
    [opts, spendText, usdText, travelText, ticketText]
  );
  const homePct = Math.max(0, 100 - input.usd - input.travel);

  const eligible = useMemo(() => (country ? rows.filter((r) => availabilityIn(r, country) !== 'no') : rows), [rows, country]);
  const formOk = useMemo(() => (input.form === 'physical' ? eligible.filter(hasPhysical) : eligible), [eligible, input.form]);
  const results = useMemo(() => rankByValue(formOk, input, country || null), [formOk, input, country]);

  // The card for the tier and audit views: the one in the link, else the top card here.
  const picked = useMemo(
    () => eligible.find((r) => r.slug === input.card) ?? results[0]?.card ?? eligible[0] ?? null,
    [eligible, input.card, results]
  );

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const p = calcParams({ ...input, card: input.mode === 'best' ? null : (picked?.slug ?? null) }, country);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${p.toString()}`);
    const t = setTimeout(() => track('Calculator', { spend: input.spend, country: country || 'ALL', mode: input.mode }), 800);
    return () => clearTimeout(t);
  }, [input, country, picked]);

  const spendErr = bad(spendText, 0, 1_000_000);
  const usdErr = bad(usdText, 0, 100);
  const travelErr = bad(travelText, 0, 100);
  const splitErr = !usdErr && !travelErr && Number(usdText || 0) + Number(travelText || 0) > 100;
  const ticketErr = bad(ticketText, 1, 10_000);

  const pickCard = (slug: string) => {
    const card = eligible.find((r) => r.slug === slug);
    // In the audit, start from that card's best tier for these settings.
    const best = card ? rankByValue([card], { ...input, all: true }, country || null)[0] : null;
    setOpts((o) => ({ ...o, card: slug, tier: best ? best.index : 0 }));
  };
  const switchMode = (mode: CalcMode) => {
    setOpts((o) => {
      const next = { ...o, mode };
      // Coming from the leaderboard: keep looking at the top card and its best tier.
      if (mode !== 'best' && !o.card && results[0]) {
        next.card = results[0].card.slug;
        next.tier = results[0].index;
      }
      return next;
    });
  };

  const homeLabel = currency ? `Your own currency (${currency})` : 'Your own currency';
  const splitSummary = `${homePct}% in ${currency ?? 'your own currency'} · ${input.usd}% in US dollars online · ${input.travel}% in other currencies`;
  const hiddenVirtual = input.form === 'physical' ? eligible.length - formOk.length : 0;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="mode-switch" role="group" aria-label="Calculator mode">
        {MODES.map((m) => (
          <button key={m.id} type="button" className="chip" aria-pressed={input.mode === m.id} onClick={() => switchMode(m.id)}>
            <span className="mode-long">{m.label}</span>
            <span className="mode-short" aria-hidden="true">
              {m.short}
            </span>
          </button>
        ))}
      </div>

      <form className="panel panel-pad stack calc-form" style={{ gap: 18 }} onSubmit={(e) => e.preventDefault()}>
        <div className="calc-grid">
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
              onChange={(e) => setSpendText(numText(e.target.value))}
              aria-invalid={spendErr}
              aria-describedby="c-spend-help"
            />
            <input
              type="range"
              className="range"
              min={0}
              max={10000}
              step={50}
              value={Math.min(input.spend, 10000)}
              onChange={(e) => setSpendText(e.target.value)}
              aria-label="Monthly card spend"
            />
            <span id="c-spend-help" className="faint" style={{ fontSize: 12, color: spendErr ? 'var(--bad)' : undefined }}>
              {spendErr ? 'Enter an amount from 0 to 1,000,000' : 'What you spend on the card each month'}
            </span>
          </div>
        </div>

        <details className="calc-split">
          <summary>
            <span className="field-label">Currency split</span> <span className="muted">{splitSummary}</span>{' '}
            <span className="calc-edit">Edit currency split</span>
          </summary>
          <div className="calc-grid" style={{ marginTop: 12 }}>
            <div className="field">
              <span className="field-label">{homeLabel}</span>
              <span className="input num calc-readonly" aria-live="polite">
                {homePct}%
              </span>
              <span className="faint" style={{ fontSize: 12 }}>
                Shops and bills at home. The rest of your spending.
              </span>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="c-usd">
                US dollars online (%)
              </label>
              <input
                id="c-usd"
                className="input num"
                inputMode="decimal"
                value={usdText}
                onChange={(e) => setUsdText(numText(e.target.value))}
                aria-invalid={usdErr || splitErr}
                aria-describedby="c-usd-help"
              />
              <span id="c-usd-help" className="faint" style={{ fontSize: 12, color: usdErr || splitErr ? 'var(--bad)' : undefined }}>
                {usdErr ? 'Enter a percentage from 0 to 100' : splitErr ? 'The two shares add up to more than 100%' : 'Subscriptions and US shops'}
              </span>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="c-travel">
                Travel and other currencies (%)
              </label>
              <input
                id="c-travel"
                className="input num"
                inputMode="decimal"
                value={travelText}
                onChange={(e) => setTravelText(numText(e.target.value))}
                aria-invalid={travelErr || splitErr}
                aria-describedby="c-travel-help"
              />
              <span id="c-travel-help" className="faint" style={{ fontSize: 12, color: travelErr ? 'var(--bad)' : undefined }}>
                {travelErr ? 'Enter a percentage from 0 to 100' : 'Pays the card’s usual FX fee'}
              </span>
            </div>
          </div>
        </details>

        <div className="calc-grid">
          <div className="field">
            <Chips
              label="Purchase sizes"
              value={input.mix}
              onChange={(v) => set('mix', v)}
              options={[
                { value: 'balanced', label: 'Balanced mix ($10–$200)' },
                { value: 'custom', label: 'One size' }
              ]}
            />
            {input.mix === 'custom' ? (
              <>
                <label className="sr-only" htmlFor="c-ticket">
                  Average purchase (USD)
                </label>
                <input
                  id="c-ticket"
                  className="input num"
                  inputMode="decimal"
                  value={ticketText}
                  onChange={(e) => setTicketText(numText(e.target.value))}
                  aria-invalid={ticketErr}
                  aria-describedby="c-ticket-help"
                />
                <span id="c-ticket-help" className="faint" style={{ fontSize: 12, color: ticketErr ? 'var(--bad)' : undefined }}>
                  {ticketErr ? 'Enter an amount from 1 to 10,000' : 'Every purchase is this size (USD)'}
                </span>
              </>
            ) : (
              <span className="faint" style={{ fontSize: 12 }}>
                20% of your spending in each of $200, $100, $50, $25 and $10 purchases
              </span>
            )}
          </div>
          <Chips
            label="Count rewards at"
            value={input.value}
            onChange={(v) => set('value', v)}
            options={[
              { value: 'face', label: 'Face value' },
              { value: 'conservative', label: 'Conservative' },
              { value: 'cash', label: 'Cash and stablecoins only' }
            ]}
          />
          <Chips
            label="Card"
            value={input.form}
            onChange={(v) => set('form', v)}
            options={[
              { value: 'virtual', label: 'Virtual' },
              { value: 'physical', label: 'Physical' }
            ]}
          />
          <Chips
            label="Which year"
            value={input.year}
            onChange={(v) => set('year', v)}
            options={[
              { value: 1, label: 'Year 1' },
              { value: 2, label: 'Year 2 onwards' }
            ]}
          />
        </div>
        <p className="faint" style={{ fontSize: 12, margin: 0 }}>
          {input.value === 'conservative'
            ? 'Conservative: cash, stablecoins, BTC and ETH at 100%, other tokens at 75%, points at 50%. '
            : input.value === 'cash'
              ? 'Only rewards paid in cash or stablecoins count. '
              : ''}
          {input.year === 1
            ? `Year 1 adds the one-off ${input.form === 'physical' ? 'physical card and shipping' : 'card'} fee and any welcome offer.`
            : 'Year 2 onwards: yearly fees and ongoing rates only, no one-off fees or welcome offers.'}
        </p>

        {input.mode === 'best' ? (
          <div className="calc-grid">
            <Chips
              label="Tiers"
              value={input.tiers}
              onChange={(v) => set('tiers', v)}
              options={[
                { value: 'best', label: 'Best tier for my spend' },
                { value: 'entry', label: 'Entry and free tiers only' }
              ]}
            />
            {input.tiers === 'best' ? (
              <label className="check" style={{ alignSelf: 'end' }}>
                <input type="checkbox" checked={input.all} onChange={(e) => set('all', e.target.checked)} />
                Include tiers that need staking, a token lockup or an invite
              </label>
            ) : null}
          </div>
        ) : (
          <div className="calc-grid">
            <div className="field">
              <label className="field-label" htmlFor="c-card">
                Card
              </label>
              <select id="c-card" className="select" value={picked?.slug ?? ''} onChange={(e) => pickCard(e.target.value)}>
                {eligible.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            {input.mode === 'audit' && picked ? (
              <div className="field">
                <label className="field-label" htmlFor="c-tier">
                  Tier
                </label>
                <select id="c-tier" className="select" value={Math.min(input.tier, picked.tiers.length - 1)} onChange={(e) => set('tier', Number(e.target.value))}>
                  {picked.tiers.map((t, i) => (
                    <option key={t.name} value={i}>
                      {t.name}
                      {t.feeUsdYear != null ? ` (${t.feeUsdYear ? `${money(t.feeUsdYear)}/yr` : 'free'})` : ''}
                      {t.comingSoon ? ' · coming soon' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        )}
      </form>

      {input.mode === 'best' ? (
        <>
          <BestView results={results} input={input} country={country} currency={currency} hiddenVirtual={hiddenVirtual} />
          <WalletCombo cards={formOk} input={input} country={country} />
        </>
      ) : !picked ? (
        <p className="muted">No card is available where you live yet.</p>
      ) : input.mode === 'tiers' ? (
        <TiersView card={picked} input={input} country={country} />
      ) : (
        <AuditView card={picked} input={input} country={country} currency={currency} />
      )}

      {eligible.length ? (
        <section className="stack" style={{ gap: 14 }} aria-labelledby="calc-receipt-title">
          <div className="stack" style={{ gap: 4 }}>
            <span className="field-label">[ one purchase ]</span>
            <h2 id="calc-receipt-title" className="h3" style={{ margin: 0 }}>
              Real swipe receipt
            </h2>
          </div>
          <div className="panel panel-pad">
            <SwipeReceipt
              cards={eligible}
              initialSlug={input.mode === 'best' ? results[0]?.card.slug : picked?.slug}
              perUsd={perUsd}
            />
          </div>
        </section>
      ) : null}

      <p className="faint" style={{ fontSize: 13, maxWidth: '90ch' }}>
        Missing figures are counted as zero and flagged in the notes. Spending caps, spend bands and small-purchase limits
        are applied where the issuer publishes them. Top-up fees are worked out on everything you load, including the money
        that goes on fees. <Link href="/methodology#calculator">How the calculator works</Link>.
      </p>
    </div>
  );
}

// ---------- Mode 1 ----------

function BestView({
  results,
  input,
  country,
  currency,
  hiddenVirtual
}: {
  results: (TierResult & { card: CardRow })[];
  input: CalcInput;
  country: string;
  currency: string | null;
  hiddenVirtual: number;
}) {
  return (
    <>
      <div className="pager">
        <p className="muted" style={{ margin: 0 }}>
          A year at <b style={{ color: 'var(--text)' }}>{money(input.spend)}</b> a month
          {country ? ` · cards you may get in ${countryName(country)}` : ''}
          {currency ? ` · home spending in ${currency}` : ''} ·{' '}
          {input.tiers === 'entry' ? 'entry and free tiers' : 'best tier for each card'}
          {hiddenVirtual ? ` · ${hiddenVirtual} virtual-only cards hidden` : ''}
        </p>
        <ShareBar text={`What ${money(input.spend)}/month earns on each crypto card, after every fee · G2M calculator`} />
      </div>
      <div className="table-wrap calc-wrap">
        <table className="table calc-table">
          <caption className="sr-only">What each card leaves you with in a year, after fees</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Card · tier</th>
              <th scope="col">Rewards / yr</th>
              <th scope="col">Plan and card fees / yr</th>
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
                    </div>
                  </div>
                </td>
                <td className="num" data-label="Rewards">
                  {cash(r.cashback)}
                </td>
                <td className="num" data-label="Plan and card fees">
                  {minus(r.fee + r.oneTime)}
                </td>
                <td className="num" data-label="FX cost">
                  {minus(r.fx)}
                </td>
                <td className="num" data-label="Purchase fees">
                  {minus(r.tx)}
                </td>
                <td className="num calc-keep" data-label="You keep" style={{ color: keepColor(r.net) }}>
                  {cash(r.net)}
                </td>
                <td className="muted calc-notes">{r.flags.length ? r.flags.join(' · ') : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- Mode 2 ----------

function TiersView({ card, input, country }: { card: CardRow; input: CalcInput; country: string }) {
  const tiers = useMemo(() => card.tiers.map((t, i) => tierValue(card, t, input, i, country || null)), [card, input, country]);
  const pairs = useMemo(() => breakEvens(card, input, country || null), [card, input, country]);
  const best = tiers.filter((t) => t.offered && !t.tier.comingSoon).sort((a, b) => b.net - a.net)[0];
  const priced = (t: TierResult) => t.tier.feeUsdYear != null;
  const name = (t: TierResult) => `${t.tier.name} (${t.tier.feeUsdYear == null ? 'price not published' : t.tier.feeUsdYear ? `${money(t.tier.feeUsdYear)}/yr` : 'free'})`;

  return (
    <>
      <div className="pager">
        <p className="muted" style={{ margin: 0 }}>
          {card.name} tiers at <b style={{ color: 'var(--text)' }}>{money(input.spend)}</b> a month
          {best ? (
            <>
              {' '}
              · best for you: <b style={{ color: 'var(--text)' }}>{best.tier.name}</b>
            </>
          ) : null}
        </p>
        <ShareBar text={`Which ${card.name} tier pays off at ${money(input.spend)}/month · G2M calculator`} />
      </div>
      <div className="table-wrap calc-wrap">
        <table className="table calc-table">
          <caption className="sr-only">{card.name} tiers side by side</caption>
          <thead>
            <tr>
              <th scope="col">Tier</th>
              <th scope="col">Rewards / yr</th>
              <th scope="col">Plan and card fees / yr</th>
              <th scope="col">FX cost / yr</th>
              <th scope="col">Purchase fees / yr</th>
              <th scope="col">You keep / yr</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.tier.name}>
                <td>
                  <div className="stack" style={{ gap: 2 }}>
                    <b>{t.tier.name}</b>
                    <span className="faint" style={{ fontSize: 13 }}>
                      {t.tier.feeUsdYear == null ? 'Price not published' : t.tier.feeUsdYear ? `${money(t.tier.feeUsdYear)} a year` : 'Free'}
                      {t.tier.comingSoon ? ' · coming soon' : ''}
                    </span>
                  </div>
                </td>
                <td className="num" data-label="Rewards">
                  {cash(t.cashback)}
                </td>
                <td className="num" data-label="Plan and card fees">
                  {minus(t.fee + t.oneTime)}
                </td>
                <td className="num" data-label="FX cost">
                  {minus(t.fx)}
                </td>
                <td className="num" data-label="Purchase fees">
                  {minus(t.tx)}
                </td>
                <td className="num calc-keep" data-label="You keep" style={{ color: keepColor(t.net) }}>
                  {cash(t.net)}
                </td>
                <td className="muted calc-notes">{t.flags.length ? t.flags.join(' · ') : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="panel panel-pad stack" style={{ gap: 10 }} aria-labelledby="be-title">
        <h2 id="be-title" className="h3" style={{ margin: 0, fontSize: 20 }}>
          Break-even points
        </h2>
        {pairs.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {card.name} has one tier {country ? `open in ${countryName(country)}` : ''}, so there is nothing to compare.
          </p>
        ) : (
          <ul className="stack" style={{ gap: 8, margin: 0, paddingLeft: 18 }}>
            {pairs.map((p) => (
              <li key={p.to.tier.name}>
                {!priced(p.from) || !priced(p.to) ? (
                  <>
                    {name(p.to)} vs {name(p.from)}: can’t be compared, the price is not published.
                  </>
                ) : p.beatsFrom === 0 ? (
                  <>
                    <b>{name(p.to)}</b> keeps you more than {name(p.from)} at any spend
                    {p.until != null ? `, up to ${money(p.until)} a month` : ''}.
                  </>
                ) : p.beatsFrom == null ? (
                  <>
                    <b>{name(p.to)}</b> never beats {name(p.from)} with these settings (checked up to {money(BREAK_EVEN_LIMIT)} a month).
                  </>
                ) : (
                  <>
                    <b>{name(p.to)}</b> beats {name(p.from)} once you spend <b>{money(p.beatsFrom)} a month</b>
                    {p.until != null ? `, until ${money(p.until)} a month` : ''}.
                  </>
                )}
                {p.to.flags.some((f) => f.startsWith('Needs') || f.startsWith('Hold') || f.startsWith('Or hold')) ? (
                  <span className="faint"> {p.to.flags.filter((f) => /^(Needs|Hold|Or hold)/.test(f)).join(' · ')}.</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="faint" style={{ fontSize: 12, margin: 0 }}>
          Worked out with all your other settings unchanged. Staking or lockups a tier needs are not counted as a cost.
        </p>
      </section>
    </>
  );
}

// ---------- Mode 3 ----------

function AuditView({ card, input, country, currency }: { card: CardRow; input: CalcInput; country: string; currency: string | null }) {
  const index = Math.min(input.tier, card.tiers.length - 1);
  const r = useMemo(() => tierValue(card, card.tiers[index], input, index, country || null), [card, index, input, country]);
  const swipes = r.purchases;
  const kind = payoutKind(card.cashback.payout);
  const part = (k: 'home' | 'usd' | 'travel') => r.parts.find((p) => p.key === k)!;
  const fxLabel = (k: 'home' | 'usd' | 'travel') => {
    const p = part(k);
    const share = `${Math.round(p.share * 100)}% of spend`;
    const rate = p.fxPct == null ? 'FX fee not published' : `${p.fxPct}% FX`;
    if (k === 'home') return `Domestic FX: ${currency ?? 'your own currency'} (${share}, ${country ? rate : 'billed in the card’s currency'})`;
    if (k === 'usd') return `US dollars online (${share}, ${rate})`;
    return `Travel FX: other currencies (${share}, ${rate})`;
  };
  type Line = { label: string; amount: number; sign: 1 | -1; muted?: boolean; skip?: boolean };
  const lines: Line[] = [
    ...r.bands.map((b) => ({
      label: `Cashback ${b.pct}%${b.to != null || b.from > 0 ? ` on ${money(b.from)}–${b.to != null ? money(b.to) : 'more'} a month` : ''}`,
      amount: b.amount,
      sign: 1 as const
    })),
    { label: 'Lost to the monthly cap', amount: r.capCut, sign: -1, skip: r.capCut < 0.005 },
    { label: `Welcome offer (${card.cashback.intro?.pct}% for ${card.cashback.intro?.days} days)`, amount: r.intro, sign: 1, skip: r.intro < 0.005 },
    { label: `Valuation: rewards paid in ${card.cashback.payout ?? 'a currency not published'}`, amount: r.valueCut, sign: -1, skip: r.valueCut < 0.005 },
    { label: 'Plan fee', amount: r.fee, sign: -1 },
    {
      label: input.form === 'physical' ? 'Physical card and shipping (one-off)' : 'Card fee (one-off)',
      amount: r.oneTime,
      sign: -1,
      skip: input.year !== 1
    },
    { label: fxLabel('home'), amount: part('home').fx, sign: -1 },
    { label: fxLabel('usd'), amount: part('usd').fx, sign: -1 },
    { label: fxLabel('travel'), amount: part('travel').fx, sign: -1 },
    { label: `Fee on every purchase (${card.fees.txPct}%)`, amount: r.txPct, sign: -1 },
    { label: `Flat fee per purchase (${cash(card.fees.txFlatUsd)} × ${Math.round(swipes)})`, amount: r.txFlat, sign: -1, skip: !card.fees.txFlatUsd },
    {
      label: card.fees.smallPurchase
        ? `Small-purchase fee (${cash(card.fees.smallPurchase.feeUsd)} under ${money(card.fees.smallPurchase.underUsd)}${card.fees.smallPurchase.foreignOnly ? ', foreign purchases only' : ''} × ${Math.round(r.smallCount)})`
        : 'Small-purchase fee (none listed)',
      amount: r.small,
      sign: -1
    },
    { label: `Top-up fee (${card.fees.topUpPct == null ? 'not published' : `${card.fees.topUpPct}% of what you load`})`, amount: r.topUp, sign: -1 }
  ];
  const shown = lines.filter((l) => !l.skip);

  return (
    <>
      <div className="pager">
        <p className="muted" style={{ margin: 0 }}>
          {card.name}
          {card.tiers[index].name !== card.name ? ` · ${card.tiers[index].name}` : ''} · {money(input.spend)} a month, {Math.round(swipes)} purchases a year
          {country ? ` · ${countryName(country)}` : ''}
        </p>
        <ShareBar text={`${card.name}: every fee and reward at ${money(input.spend)}/month · G2M calculator`} />
      </div>
      <div className="calc-receipt panel">
        <table className="table receipt">
          <caption className="sr-only">
            {card.name} {card.tiers[index].name}: rewards and costs for a year
          </caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Year</th>
              <th scope="col">Month</th>
              <th scope="col">Per purchase</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => {
              const v = l.sign * l.amount;
              const fmt = (n: number) => (l.sign < 0 ? minus(n) : cash(n));
              return (
                <tr key={l.label}>
                  <th scope="row">{l.label}</th>
                  <td className="num" data-label="Year" style={{ color: l.sign > 0 && v > 0 ? 'var(--ok)' : undefined }}>
                    {fmt(l.amount)}
                  </td>
                  <td className="num" data-label="Month">
                    {fmt(l.amount / 12)}
                  </td>
                  <td className="num" data-label="Per purchase">
                    {swipes > 0 ? fmt(l.amount / swipes) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">You keep</th>
              <td className="num" data-label="Year" style={{ color: keepColor(r.net) }}>
                {cash(r.net)}
              </td>
              <td className="num" data-label="Month" style={{ color: keepColor(r.net) }}>
                {cash(r.net / 12)}
              </td>
              <td className="num" data-label="Per purchase" style={{ color: keepColor(r.net) }}>
                {swipes > 0 ? cash(r.net / swipes) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="stats">
        <div className="stat">
          <b style={{ color: keepColor(r.net) }}>{r.yieldPct.toFixed(2)}%</b>
          <span>Effective net yield on spend</span>
        </div>
        <div className="stat">
          <b>{money(input.spend * 12)}</b>
          <span>Spent a year</span>
        </div>
        <div className="stat">
          <b>{kind === 'unknown' ? 'Not published' : card.cashback.payout}</b>
          <span>Rewards paid in</span>
        </div>
      </div>
      {r.flags.length ? (
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          Notes: {r.flags.join(' · ')}
        </p>
      ) : null}
    </>
  );
}
