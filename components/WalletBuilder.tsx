'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardRow } from '@/lib/types';
import { COUNTRIES, availabilityIn, countryName, isCountry } from '@/lib/regions';
import { currencyOf } from '@/lib/currencies.mjs';
import { buildSegments, calcParams, parseCalcInput, type CalcInput } from '@/lib/calc';
import { planWallet, describeSlices, type ComboSide } from '@/lib/combo';
import { FEATURES, FEATURE_KEYS, FEATURE, type FeatureKey } from '@/lib/features';
import { money } from '@/lib/format';
import { CardArt } from '@/components/CardArt';
import { Chips } from '@/components/Chips';
import { ShareBar } from '@/components/ShareBar';
import { useRegion } from '@/components/RegionContext';
import { spendBand, track } from '@/lib/analytics';

type Props = { rows: CardRow[]; initial: CalcInput; initialNeed: FeatureKey[]; initialCountry: string; hadCountry: boolean };

const numText = (v: string) => v.replace(/[^\d.]/g, '');
const keepColor = (n: number) => (n >= 0 ? 'var(--ok)' : 'var(--bad)');
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`;

function Side({ side, role, uses, need }: { side: ComboSide | { card: CardRow; result: ComboSide['result']; spendYear?: number; features: Set<FeatureKey> }; role: string; uses?: string; need: FeatureKey[] }) {
  const feats = FEATURES.filter((f) => side.features.has(f.key));
  return (
    <div className="wallet-side">
      <span className="field-label">{role}</span>
      <div className="card-cell">
        <CardArt card={side.card} size="sm" />
        <div className="stack" style={{ gap: 2 }}>
          <Link href={`/cards/${side.card.slug}`}>{side.card.name}</Link>
          <span className="faint" style={{ fontSize: 13 }}>
            {side.result.tier.name}
            {side.result.tier.feeUsdYear ? ` · ${money(side.result.tier.feeUsdYear)}/yr` : side.result.tier.feeUsdYear === 0 ? ' · free' : ''}
          </span>
        </div>
      </div>
      {uses ? <p className="muted" style={{ margin: 0, fontSize: 14 }}>{uses}</p> : null}
      {feats.length ? (
        <ul className="wallet-feats" aria-label="What this card gives you">
          {feats.map((f) => (
            <li key={f.key} className={need.includes(f.key) ? 'is-need' : undefined}>
              {f.short}
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="combo-facts">
        {side.spendYear != null ? (
          <div>
            <dt>Spend on it</dt>
            <dd>{money(side.spendYear / 12)}/mo</dd>
          </div>
        ) : null}
        <div>
          <dt>You keep</dt>
          <dd style={{ color: keepColor(side.result.net) }}>{money(side.result.net)}/yr</dd>
        </div>
      </dl>
    </div>
  );
}

export function WalletBuilder({ rows, initial, initialNeed, initialCountry, hadCountry }: Props) {
  const [spendText, setSpendText] = useState(String(initial.spend));
  const [usdText, setUsdText] = useState(String(initial.usd));
  const [travelText, setTravelText] = useState(String(initial.travel));
  const [ticketText, setTicketText] = useState(String(initial.ticket));
  const [mix, setMix] = useState(initial.mix);
  const [all, setAll] = useState(initial.all);
  const [need, setNeed] = useState<FeatureKey[]>(initialNeed);
  const [country, setCountry] = useState(initialCountry);
  const { country: myCountry, ready } = useRegion();
  const regionApplied = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    if (!ready || regionApplied.current || hadCountry) return;
    regionApplied.current = true;
    if (myCountry) setCountry(myCountry);
  }, [ready, myCountry, hadCountry]);
  const currency = currencyOf(country);

  const input = useMemo(
    () => parseCalcInput({ spend: spendText, usd: usdText, travel: travelText, ticket: ticketText, mix, all }),
    [spendText, usdText, travelText, ticketText, mix, all]
  );
  const homePct = Math.max(0, 100 - input.usd - input.travel);
  const eligible = useMemo(() => (country ? rows.filter((r) => availabilityIn(r, country) !== 'no') : rows), [rows, country]);
  const plan = useMemo(() => planWallet(eligible, input, country || null, need, 3), [eligible, input, country, need]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const p = calcParams({ ...input, mode: 'best' }, country);
    if (need.length) p.set('need', need.join(','));
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${p.toString()}`);
    const t = setTimeout(() => track('Wallet', { spend: spendBand(input.spend), country: country || 'ALL', need: need.join(',') || 'none' }), 800);
    return () => clearTimeout(t);
  }, [input, country, need]);

  const toggle = (k: FeatureKey) => setNeed((n) => (n.includes(k) ? n.filter((x) => x !== k) : FEATURE_KEYS.filter((x) => x === k || n.includes(x))));

  // The answer: a pair, or one card when no pair does better.
  const top = plan.combos[0] ?? null;
  const base = plan.singleCovering;
  const pairWins = top && (!base || top.total > base.result.net + 0.5);
  const segs = buildSegments(input);
  const needText = need.map((k) => FEATURE[k].short.toLowerCase()).join(', ');

  return (
    <div className="stack" style={{ gap: 24 }}>
      <form className="panel panel-pad stack" style={{ gap: 18 }} onSubmit={(e) => e.preventDefault()}>
        <div className="calc-grid">
          <div className="field">
            <label className="field-label" htmlFor="w-country">
              Where you live
            </label>
            <select id="w-country" className="select" value={country} onChange={(e) => setCountry(isCountry(e.target.value) ? e.target.value : '')}>
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
            <label className="field-label" htmlFor="w-spend">
              Monthly card spend (USD)
            </label>
            <input id="w-spend" className="input num" inputMode="decimal" value={spendText} onChange={(e) => setSpendText(numText(e.target.value))} />
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
          </div>
        </div>

        <div className="field">
          <span className="field-label">Must-haves (between the two cards)</span>
          <div className="chip-row" role="group" aria-label="Must-have features">
            {FEATURES.map((f) => (
              <button key={f.key} type="button" className="chip" aria-pressed={need.includes(f.key)} onClick={() => toggle(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <details className="calc-split">
          <summary>
            <span className="field-label">Currency split and purchase sizes</span>{' '}
            <span className="muted">
              {homePct}% in {currency ?? 'your own currency'} · {input.usd}% US dollars online · {input.travel}% other currencies ·{' '}
              {input.mix === 'custom' ? `every purchase $${input.ticket}` : 'balanced $10–$200 mix'}
            </span>{' '}
            <span className="calc-edit">Edit</span>
          </summary>
          <div className="calc-grid" style={{ marginTop: 12 }}>
            <div className="field">
              <label className="field-label" htmlFor="w-usd">
                US dollars online (%)
              </label>
              <input id="w-usd" className="input num" inputMode="decimal" value={usdText} onChange={(e) => setUsdText(numText(e.target.value))} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="w-travel">
                Travel and other currencies (%)
              </label>
              <input id="w-travel" className="input num" inputMode="decimal" value={travelText} onChange={(e) => setTravelText(numText(e.target.value))} />
            </div>
            <div className="field">
              <Chips
                label="Purchase sizes"
                value={input.mix}
                onChange={(v) => setMix(v)}
                options={[
                  { value: 'balanced', label: 'Balanced mix' },
                  { value: 'custom', label: 'One size' }
                ]}
              />
              {input.mix === 'custom' ? (
                <input className="input num" inputMode="decimal" aria-label="Purchase size in US dollars" value={ticketText} onChange={(e) => setTicketText(numText(e.target.value))} />
              ) : null}
            </div>
          </div>
          <label className="check" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={input.all} onChange={(e) => setAll(e.target.checked)} />
            Include tiers that need staking, a token lockup or an invite
          </label>
        </details>
      </form>

      <div className="pager">
        <p className="muted" style={{ margin: 0 }}>
          {money(input.spend)} a month{country ? ` · cards you may get in ${countryName(country)}` : ''}
          {need.length ? ` · must have: ${needText}` : ''}
        </p>
        <ShareBar text={`My best 2-card crypto wallet at ${money(input.spend)}/month · G2M wallet builder`} />
      </div>

      {!top && !base ? (
        <div className="panel panel-pad">
          <p className="muted" style={{ margin: 0 }}>
            No card or pair available {country ? `in ${countryName(country)}` : ''} has all of these yet: {needText}. Try fewer
            must-haves.
          </p>
        </div>
      ) : pairWins && top ? (
        <section className="panel panel-pad stack wallet-best" style={{ gap: 16 }} aria-labelledby="wallet-answer">
          <span className="field-label">[ your best wallet ]</span>
          <h2 id="wallet-answer" className="h3" style={{ margin: 0 }}>
            {top.primary.card.name} + {top.second.card.name}
          </h2>
          <p className="combo-headline" style={{ margin: 0 }}>
            {base ? (
              <>
                Keeps <b style={{ color: keepColor(top.total - base.result.net) }}>{signed(top.total - base.result.net)} a year</b> more than
                the best single card{need.length ? ' with all your must-haves' : ''}, {base.card.name}.
              </>
            ) : (
              <>No single card has all of these ({needText}). This pair covers them.</>
            )}
          </p>
          <div className="combo-grid">
            <Side side={top.primary} role="Card 1 · main card" uses="Everything else" need={need} />
            <Side
              side={top.second}
              role="Card 2 · for these purchases"
              uses={(() => {
                const d = describeSlices(top.toSecond, segs).join(' · ');
                return d.charAt(0).toUpperCase() + d.slice(1);
              })()}
              need={need}
            />
          </div>
          <dl className="combo-compare">
            <div>
              <dt>Both cards together</dt>
              <dd style={{ color: keepColor(top.total) }}>{money(top.total)} a year</dd>
            </div>
            {base ? (
              <div>
                <dt>{base.card.name} alone</dt>
                <dd>{money(base.result.net)} a year</dd>
              </div>
            ) : null}
            {need.length && plan.single && plan.single.card.slug !== base?.card.slug ? (
              <div>
                <dt>Best for money only ({plan.single.card.name})</dt>
                <dd>{money(plan.single.result.net)} a year</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : base ? (
        <section className="panel panel-pad stack wallet-best" style={{ gap: 16 }} aria-labelledby="wallet-answer">
          <span className="field-label">[ your best wallet ]</span>
          <h2 id="wallet-answer" className="h3" style={{ margin: 0 }}>
            One card does it: {base.card.name}
          </h2>
          <p className="combo-headline" style={{ margin: 0 }}>
            At {money(input.spend)} a month, no second card adds money{need.length ? ` or a must-have it doesn't already have` : ''}. Its fees
            would cost more than it saves.
          </p>
          <div className="combo-grid">
            <Side side={base} role="Your card" need={need} />
          </div>
        </section>
      ) : null}

      {plan.combos.length > (pairWins ? 1 : 0) ? (
        <section className="stack" style={{ gap: 10 }} aria-labelledby="wallet-more">
          <h2 id="wallet-more" className="h3" style={{ margin: 0, fontSize: 18 }}>
            {pairWins ? 'Other strong pairs' : 'Best pairs, if you want two cards'}
          </h2>
          <ul className="wallet-alts">
            {plan.combos.slice(pairWins ? 1 : 0).map((c) => {
              const vs = base ? c.total - base.result.net : null;
              return (
                <li key={`${c.primary.card.slug}+${c.second.card.slug}`}>
                  <span>
                    <b>{c.primary.card.name}</b> ({c.primary.result.tier.name}) + <b>{c.second.card.name}</b> ({c.second.result.tier.name})
                    <span className="faint"> · card 2 for {describeSlices(c.toSecond, segs).join(', ')}</span>
                  </span>
                  <span className="wallet-alt-num">
                    <b style={{ color: keepColor(c.total) }}>{money(c.total)}/yr</b>
                    {vs != null ? <span className="faint"> ({signed(vs)})</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="faint" style={{ fontSize: 13, maxWidth: '90ch' }}>
        Every pair of cards available where you live is tried, with your spending split by purchase size and currency and each
        card at its best tier for its share. Both cards&apos; yearly fees are counted in full. Must-haves come from each card&apos;s
        published features: lounge access from its tier perks, yield, borrowing and bank accounts from its banking features.
        Money is worked out like the <Link href="/calculator">rewards calculator</Link>; see{' '}
        <Link href="/methodology#calculator">how it works</Link>.
      </p>
    </div>
  );
}
