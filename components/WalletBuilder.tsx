'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardRow } from '@/lib/types';
import { availabilityIn, isCountry } from '@/lib/regions';
import { currencyOf } from '@/lib/currencies.mjs';
import { buildSegments, calcParams, parseCalcInput, type CalcInput } from '@/lib/calc';
import { planWallet, sliceParts, type ComboSide, type SlicePart } from '@/lib/combo';
import { FEATURES, FEATURE_KEYS, type FeatureKey } from '@/lib/features';
import { CardArt } from '@/components/CardArt';
import { Chips } from '@/components/Chips';
import { ShareBar } from '@/components/ShareBar';
import { useRegion } from '@/components/RegionContext';
import { calcText, type CalcText } from '@/components/calcText';
import { spendBand, track } from '@/lib/analytics';
import { fillNodes, fillText } from '@/lib/i18n/clientFormat';
import { walletEn } from '@/lib/i18n/ui/wallet/en';
import type { Ui } from '@/lib/i18n/ui/en';

type Props = {
  rows: CardRow[];
  initial: CalcInput;
  initialNeed: FeatureKey[];
  initialCountry: string;
  hadCountry: boolean;
  /** Another language (English when left out): its words, language tag, address prefix (/de) and country names. */
  ui?: Ui;
  tag?: string;
  prefix?: string;
  countryNames?: Record<string, string>;
};

type W = typeof walletEn;
const numText = (v: string) => v.replace(/[^\d.]/g, '');
const keepColor = (n: number) => (n >= 0 ? 'var(--ok)' : 'var(--bad)');
const FEAT_WORD: Record<FeatureKey, [keyof W, keyof W]> = {
  lounge: ['fLounge', 'sLounge'],
  yield: ['fYield', 'sYield'],
  borrow: ['fBorrow', 'sBorrow'],
  iban: ['fIban', 'sIban'],
  payout: ['fPayout', 'sPayout'],
  selfCustody: ['fSelfCustody', 'sSelfCustody'],
  physical: ['fPhysical', 'sPhysical'],
  mobilePay: ['fMobilePay', 'sMobilePay']
};
const featLabel = (w: W, k: FeatureKey) => w[FEAT_WORD[k][0]];
const featShort = (w: W, k: FeatureKey) => w[FEAT_WORD[k][1]];

/** What card 2 is for, in words: "purchases of $25 or less in your own currency". */
function sliceText(p: SlicePart, w: W, dollars: (x: number) => string, list: (xs: string[]) => string): string {
  const part = { home: w.pHome, usd: w.pUsd, travel: w.pTravel }[p.part];
  if (p.kind === 'all') return fillText(w.sAll, { part });
  if (p.kind === 'max') return fillText(w.sMax, { x: dollars(p.sizes[0]), part });
  if (p.kind === 'min') return fillText(w.sMin, { x: dollars(p.sizes[0]), part });
  return fillText(w.sList, { list: list(p.sizes.map(dollars)), part });
}

function Side({
  side,
  role,
  uses,
  need,
  w,
  L,
  prefix
}: {
  side: ComboSide | { card: CardRow; result: ComboSide['result']; spendYear?: number; features: Set<FeatureKey> };
  role: string;
  uses?: string;
  need: FeatureKey[];
  w: W;
  L: CalcText;
  prefix: string;
}) {
  const feats = FEATURES.filter((f) => side.features.has(f.key));
  return (
    <div className="wallet-side">
      <span className="field-label">{role}</span>
      <div className="card-cell">
        <CardArt card={side.card} size="sm" />
        <div className="stack" style={{ gap: 2 }}>
          <Link href={`${prefix}/cards/${side.card.slug}`}>{side.card.name}</Link>
          <span className="faint" style={{ fontSize: 13 }}>
            {side.result.tier.name}
            {side.result.tier.feeUsdYear ? ` · ${fillText(w.perYr, { x: L.money(side.result.tier.feeUsdYear) })}` : side.result.tier.feeUsdYear === 0 ? w.free : ''}
          </span>
        </div>
      </div>
      {uses ? <p className="muted" style={{ margin: 0, fontSize: 14 }}>{uses}</p> : null}
      {feats.length ? (
        <ul className="wallet-feats" aria-label={w.gives}>
          {feats.map((f) => (
            <li key={f.key} className={need.includes(f.key) ? 'is-need' : undefined}>
              {featShort(w, f.key)}
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="combo-facts">
        {side.spendYear != null ? (
          <div>
            <dt>{w.spendOn}</dt>
            <dd>{fillText(w.perMo, { x: L.money(side.spendYear / 12) })}</dd>
          </div>
        ) : null}
        <div>
          <dt>{w.keep}</dt>
          <dd style={{ color: keepColor(side.result.net) }}>{fillText(w.perYr, { x: L.money(side.result.net) })}</dd>
        </div>
      </dl>
    </div>
  );
}

export function WalletBuilder({ rows, initial, initialNeed, initialCountry, hadCountry, ui, tag, prefix = '', countryNames }: Props) {
  const english = !ui || !tag;
  const w: W = english ? walletEn : ui.wallet;
  const L = useMemo(() => (english ? calcText() : calcText(ui, tag, countryNames)), [english, ui, tag, countryNames]);
  const signed = (n: number) => `${n >= 0 ? '+' : '−'}${L.money(Math.abs(n))}`;
  const dollars = (x: number) => (english ? `$${x}` : L.money(x));
  const commaList = (xs: string[]) => (english ? xs.join(', ') : L.and(xs));

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
  const needText = need.map((k) => (english ? featShort(w, k).toLowerCase() : featShort(w, k))).join(', ');
  const slices = (toSecond: Parameters<typeof sliceParts>[0]) => sliceParts(toSecond, segs).map((p) => sliceText(p, w, dollars, commaList));

  return (
    <div className="stack" style={{ gap: 24 }}>
      <form className="panel panel-pad stack" style={{ gap: 18 }} onSubmit={(e) => e.preventDefault()}>
        <div className="calc-grid">
          <div className="field">
            <label className="field-label" htmlFor="w-country">
              {w.whereLive}
            </label>
            <select id="w-country" className="select" value={country} onChange={(e) => setCountry(isCountry(e.target.value) ? e.target.value : '')}>
              <option value="">{w.allCountries}</option>
              {L.countries().map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                  {c.code === myCountry ? w.yourLocation : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="w-spend">
              {w.spendLabel}
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
              aria-label={w.spendAria}
            />
          </div>
        </div>

        <div className="field">
          <span className="field-label">{w.mustHaves}</span>
          <div className="chip-row" role="group" aria-label={w.mustAria}>
            {FEATURES.map((f) => (
              <button key={f.key} type="button" className="chip" aria-pressed={need.includes(f.key)} onClick={() => toggle(f.key)}>
                {featLabel(w, f.key)}
              </button>
            ))}
          </div>
        </div>

        <details className="calc-split">
          <summary>
            <span className="field-label">{w.splitTitle}</span>{' '}
            <span className="muted">
              {fillText(w.splitSummary, {
                home: L.pct(homePct),
                cur: currency ?? w.ownCurrency,
                usd: L.pct(input.usd),
                travel: L.pct(input.travel),
                sizes: input.mix === 'custom' ? fillText(w.everyPurchase, { x: dollars(input.ticket) }) : fillText(w.balancedMix, { a: dollars(10), b: dollars(200) })
              })}
            </span>{' '}
            <span className="calc-edit">{w.edit}</span>
          </summary>
          <div className="calc-grid" style={{ marginTop: 12 }}>
            <div className="field">
              <label className="field-label" htmlFor="w-usd">
                {w.usdLabel}
              </label>
              <input id="w-usd" className="input num" inputMode="decimal" value={usdText} onChange={(e) => setUsdText(numText(e.target.value))} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="w-travel">
                {w.travelLabel}
              </label>
              <input id="w-travel" className="input num" inputMode="decimal" value={travelText} onChange={(e) => setTravelText(numText(e.target.value))} />
            </div>
            <div className="field">
              <Chips
                label={w.sizes}
                value={input.mix}
                onChange={(v) => setMix(v)}
                options={[
                  { value: 'balanced', label: w.balanced },
                  { value: 'custom', label: w.oneSize }
                ]}
              />
              {input.mix === 'custom' ? (
                <input className="input num" inputMode="decimal" aria-label={w.ticketAria} value={ticketText} onChange={(e) => setTicketText(numText(e.target.value))} />
              ) : null}
            </div>
          </div>
          <label className="check" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={input.all} onChange={(e) => setAll(e.target.checked)} />
            {w.includeStake}
          </label>
        </details>
      </form>

      <div className="pager">
        <p className="muted" style={{ margin: 0 }}>
          {fillText(w.aMonth, { x: L.money(input.spend) })}
          {country ? fillText(w.cardsIn, { place: L.country(country) }) : ''}
          {need.length ? fillText(w.mustHave, { list: needText }) : ''}
        </p>
        <ShareBar text={fillText(w.share, { spend: L.money(input.spend) })} words={english ? undefined : ui.common} />
      </div>

      {!top && !base ? (
        <div className="panel panel-pad">
          <p className="muted" style={{ margin: 0 }}>
            {fillText(w.noneFit, { where: country ? fillText(w.noneWhere, { place: L.country(country) }) : '', list: needText })}
          </p>
        </div>
      ) : pairWins && top ? (
        <section className="panel panel-pad stack wallet-best" style={{ gap: 16 }} aria-labelledby="wallet-answer">
          <span className="field-label">{w.bestTag}</span>
          <h2 id="wallet-answer" className="h3" style={{ margin: 0 }}>
            {top.primary.card.name} + {top.second.card.name}
          </h2>
          <p className="combo-headline" style={{ margin: 0 }}>
            {base
              ? fillNodes(w.keepsMore, {
                  x: <b style={{ color: keepColor(top.total - base.result.net) }}>{fillText(w.keepsYear, { x: signed(top.total - base.result.net) })}</b>,
                  with: need.length ? w.withMust : '',
                  name: base.card.name
                })
              : fillText(w.noSingle, { list: needText })}
          </p>
          <div className="combo-grid">
            <Side side={top.primary} role={w.card1} uses={w.everythingElse} need={need} w={w} L={L} prefix={prefix} />
            <Side
              side={top.second}
              role={w.card2}
              uses={(() => {
                const d = slices(top.toSecond).join(' · ');
                return d.charAt(0).toUpperCase() + d.slice(1);
              })()}
              need={need}
              w={w}
              L={L}
              prefix={prefix}
            />
          </div>
          <dl className="combo-compare">
            <div>
              <dt>{w.together}</dt>
              <dd style={{ color: keepColor(top.total) }}>{fillText(w.aYear, { x: L.money(top.total) })}</dd>
            </div>
            {base ? (
              <div>
                <dt>{fillText(w.alone, { name: base.card.name })}</dt>
                <dd>{fillText(w.aYear, { x: L.money(base.result.net) })}</dd>
              </div>
            ) : null}
            {need.length && plan.single && plan.single.card.slug !== base?.card.slug ? (
              <div>
                <dt>{fillText(w.moneyOnly, { name: plan.single.card.name })}</dt>
                <dd>{fillText(w.aYear, { x: L.money(plan.single.result.net) })}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : base ? (
        <section className="panel panel-pad stack wallet-best" style={{ gap: 16 }} aria-labelledby="wallet-answer">
          <span className="field-label">{w.bestTag}</span>
          <h2 id="wallet-answer" className="h3" style={{ margin: 0 }}>
            {fillText(w.oneCard, { name: base.card.name })}
          </h2>
          <p className="combo-headline" style={{ margin: 0 }}>
            {fillText(w.noSecond, { spend: L.money(input.spend), must: need.length ? w.noSecondMust : '' })}
          </p>
          <div className="combo-grid">
            <Side side={base} role={w.yourCard} need={need} w={w} L={L} prefix={prefix} />
          </div>
        </section>
      ) : null}

      {plan.combos.length > (pairWins ? 1 : 0) ? (
        <section className="stack" style={{ gap: 10 }} aria-labelledby="wallet-more">
          <h2 id="wallet-more" className="h3" style={{ margin: 0, fontSize: 18 }}>
            {pairWins ? w.otherPairs : w.bestPairs}
          </h2>
          <ul className="wallet-alts">
            {plan.combos.slice(pairWins ? 1 : 0).map((c) => {
              const vs = base ? c.total - base.result.net : null;
              return (
                <li key={`${c.primary.card.slug}+${c.second.card.slug}`}>
                  <span>
                    <b>{c.primary.card.name}</b> ({c.primary.result.tier.name}) + <b>{c.second.card.name}</b> ({c.second.result.tier.name})
                    <span className="faint">{fillText(w.card2For, { list: slices(c.toSecond).join(', ') })}</span>
                  </span>
                  <span className="wallet-alt-num">
                    <b style={{ color: keepColor(c.total) }}>{fillText(w.perYr, { x: L.money(c.total) })}</b>
                    {vs != null ? <span className="faint"> ({signed(vs)})</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="faint" style={{ fontSize: 13, maxWidth: '90ch' }}>
        {w.footA}
        <Link href={`${prefix}/calculator`}>{w.calcLink}</Link>
        {w.footB}
        <Link href={english ? '/methodology#calculator' : `${prefix}/methodology`}>{w.howWorks}</Link>
        {w.footC}
      </p>
    </div>
  );
}
