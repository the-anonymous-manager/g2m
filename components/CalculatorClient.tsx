'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardRow } from '@/lib/types';
import { availabilityIn, isCountry } from '@/lib/regions';
import { currencyOf } from '@/lib/currencies.mjs';
import {
  BREAK_EVEN_LIMIT,
  MAX_TIER_CARDS,
  breakEvens,
  calcParams,
  hasPhysical,
  parseCalcInput,
  payoutKind,
  rankByValue,
  stakeUsd,
  tierValue,
  type CalcInput,
  type CalcMode,
  type TierResult
} from '@/lib/calc';
import { currentPreset, parsePick, pickText, presetIndex, tierIndex, tierPrice, tierSlug, type TierPreset } from '@/lib/tierpick';
import { CardArt } from '@/components/CardArt';
import { ShareBar } from '@/components/ShareBar';
import { Chips } from '@/components/Chips';
import { WalletTeaser } from '@/components/WalletTeaser';
import { TierPresets } from '@/components/TierPresets';
import { useRegion } from '@/components/RegionContext';
import { CalcTextContext, calcText, noteText, useCalcText, type CalcText } from '@/components/calcText';
import { fillNodes, fillText } from '@/lib/i18n/clientFormat';
import type { Ui } from '@/lib/i18n/ui/en';
import { spendBand, track } from '@/lib/analytics';

type Props = {
  rows: CardRow[];
  initial: CalcInput;
  initialCountry: string;
  hadCountry: boolean;
  /** Live USD prices by CoinGecko id, for staking tiers. Missing = unavailable. */
  prices: Record<string, number>;
  /** Another language: its tool pack, BCP 47 tag, address prefix ("/de"), country names and sheet text. English when left out. */
  ui?: Ui;
  tag?: string;
  prefix?: string;
  countryNames?: Record<string, string>;
  sheet?: Record<string, string>;
};

type Prices = Record<string, number>;
/** One compared card, with every tier (null) or one tier (its index). */
type TierPickRow = { card: CardRow; tier: number | null };
const entryOf = (p: TierPickRow) => pickText({ slug: p.card.slug, tier: p.tier == null ? null : tierSlug(p.card.tiers[p.tier].name) });

/** The notes for one tier, with the live USD value of its token stake added to the note that names it. */
const notesOf = (L: CalcText, r: TierResult, prices: Prices) =>
  r.flags
    .map((f, i) => {
      const text = noteText(L, f, r, i);
      if (i !== r.stakeFlag) return text;
      const v = stakeUsd(r.tier, prices);
      return v != null ? `${text} (${L.approx(v)})` : text;
    })
    .join(' · ');

/** "Or stake" when staking is an alternative to the yearly fee ("$199 a year, or lock 20,000 XPL"), else "Stake". */
const stakeWord = (L: CalcText, t: TierResult['tier']) => (t.requirement?.trim().startsWith('$') ? L.w.orStake : L.w.stake);

/** "Free", "$199 a year" or "Price not published", plus the stake's live value when the tier needs one. */
function TierPrice({ r, prices }: { r: TierResult; prices: Prices }) {
  const L = useCalcText();
  const w = L.w;
  const t = r.tier;
  const v = stakeUsd(t, prices);
  return (
    <>
      <span className="faint" style={{ fontSize: 13 }}>
        {t.feeUsdYear == null ? w.priceNP : t.feeUsdYear ? fillText(w.perYear, { x: L.money(t.feeUsdYear) }) : w.free}
        {t.comingSoon ? w.comingSoon : ''}
      </span>
      {v != null ? (
        <span className="faint calc-stake" style={{ fontSize: 12 }} title={fillText(w.stakeTitle, { amount: L.num(t.stake!.amount!), token: t.stake!.token })}>
          {stakeWord(L, t)} {L.approx(v)}
        </span>
      ) : null}
    </>
  );
}

const keepColor = (n: number) => (n >= 0 ? 'var(--ok)' : 'var(--bad)');

const numText = (v: string) => v.replace(/[^\d.]/g, '');
const bad = (text: string, min: number, max: number) => text !== '' && (!Number.isFinite(Number(text)) || Number(text) < min || Number(text) > max);

export function CalculatorClient(props: Props) {
  const { ui, tag, countryNames, sheet } = props;
  const L = useMemo(() => calcText(ui, tag, countryNames, sheet), [ui, tag, countryNames, sheet]);
  return (
    <CalcTextContext.Provider value={L}>
      <Calculator {...props} />
    </CalcTextContext.Provider>
  );
}

function Calculator({ rows, initial, initialCountry, hadCountry, prices, prefix = '' }: Props) {
  const L = useCalcText();
  const w = L.w;
  // Pages not translated yet (wallet, receipt, the calculator's methodology) open in English.
  const toEnglish = prefix ? 'en' : undefined;
  const MODES: { id: CalcMode; label: string; short: string }[] = [
    { id: 'best', label: w.modeBest, short: w.modeBestShort },
    { id: 'tiers', label: w.modeTiers, short: w.modeTiersShort },
    { id: 'audit', label: w.modeAudit, short: w.modeAuditShort }
  ];
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
    cards: initial.cards,
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
    () =>
      eligible.find((r) => r.slug === (input.card ?? (input.cards[0] ? parsePick(input.cards[0]).slug : null))) ??
      results[0]?.card ??
      eligible[0] ??
      null,
    [eligible, input.card, input.cards, results]
  );
  // Compare tiers: up to three cards, each with every tier or one tier. Without `cards=`, the one card above (old
  // `card=` links keep working).
  const tierPicks = useMemo<TierPickRow[]>(() => {
    // The same card can be picked more than once, with a different tier each time.
    const seen = new Set<string>();
    const list = input.cards
      .map(parsePick)
      .map((p) => {
        const card = eligible.find((r) => r.slug === p.slug);
        return card ? { card, tier: tierIndex(card, p.tier) } : null;
      })
      .filter((x): x is TierPickRow => Boolean(x) && !seen.has(entryOf(x!)) && Boolean(seen.add(entryOf(x!))));
    return list.length ? list : picked ? [{ card: picked, tier: null }] : [];
  }, [input.cards, eligible, picked]);
  const tierCards = tierPicks.map((p) => p.card);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const p = calcParams(
      {
        ...input,
        card: input.mode === 'best' ? null : input.mode === 'tiers' ? (tierCards[0]?.slug ?? null) : (picked?.slug ?? null),
        cards: input.mode === 'tiers' ? tierPicks.map(entryOf) : []
      },
      country
    );
    // Readable lists in the link: cards=kast:premium,tria:pro rather than kast%3Apremium%2Ctria%3Apro.
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}?${p.toString().replace(/%2C/g, ',').replace(/%3A/g, ':')}`
    );
    const t = setTimeout(() => track('Calculator', {
          spend: spendBand(input.spend),
          country: country || 'ALL',
          mode: input.mode,
          cards: input.mode === 'best' ? 'best' : input.mode === 'tiers' ? tierPicks.map(entryOf).join(',') : (picked?.slug ?? '')
        }), 800);
    return () => clearTimeout(t);
  }, [input, country, picked, tierPicks]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Compare tiers: change, add or remove one of the (up to three) cards, or the tier shown for each.
  const setPicks = (list: TierPickRow[]) =>
    setOpts((o) => ({ ...o, cards: list.map(entryOf), card: list[0]?.card.slug ?? o.card }));
  const tierSlugs = tierCards.map((c) => c.slug);
  const preset = currentPreset(tierPicks, country || null);
  // A new card follows the tier choice of the others ("Next tier up" stays next tier up).
  const tierFor = (card: CardRow) => (preset ? presetIndex(card, preset, country || null) : null);
  const setTierCard = (i: number, slug: string) => {
    const card = eligible.find((r) => r.slug === slug);
    if (!card) return;
    // The same card again: its first tier not picked yet, so its tiers line up side by side.
    const taken = new Set(tierPicks.filter((p, j) => j !== i && p.card.slug === slug).map((p) => p.tier));
    const free = card.tiers.findIndex((_, k) => !taken.has(k));
    const tier = taken.size ? (free >= 0 ? free : null) : tierFor(card);
    setPicks(tierPicks.map((p, j) => (j === i ? { card, tier } : p)));
  };
  const setPickTier = (i: number, tier: number | null) => setPicks(tierPicks.map((p, j) => (j === i ? { ...p, tier } : p)));
  const removeTierCard = (i: number) => setPicks(tierPicks.filter((_, j) => j !== i));
  const addTierCard = () => {
    const next = results.find((r) => !tierSlugs.includes(r.card.slug))?.card ?? eligible.find((r) => !tierSlugs.includes(r.slug));
    if (next) setPicks([...tierPicks, { card: next, tier: tierFor(next) }]);
  };
  const applyPreset = (p: TierPreset) => setPicks(tierPicks.map((x) => ({ ...x, tier: presetIndex(x.card, p, country || null) })));
  const switchMode = (mode: CalcMode) => {
    setOpts((o) => {
      const next = { ...o, mode };
      // Coming from the leaderboard: keep looking at the top card and its best tier.
      if (mode !== 'best' && !o.card && !o.cards.length && results[0]) {
        next.card = results[0].card.slug;
        next.tier = results[0].index;
      }
      // Line by line shows one card: the first of the compared ones, on its picked tier.
      if (mode === 'audit' && tierPicks[0]) {
        next.card = tierPicks[0].card.slug;
        if (tierPicks[0].tier != null) next.tier = tierPicks[0].tier;
      }
      return next;
    });
  };

  const homeLabel = currency ? fillText(w.homeLabel, { cur: currency }) : w.homeLabelNone;
  const splitSummary = fillText(w.splitSummary, { home: L.pct(homePct), cur: currency ?? w.ownCurrency, usd: L.pct(input.usd), travel: L.pct(input.travel) });
  const hiddenVirtual = input.form === 'physical' ? eligible.length - formOk.length : 0;
  // English tier prices in the tier picker keep the site's "$1,000 a year"; other languages use Intl.
  const pickPrice = (t: CardRow['tiers'][number]) =>
    L.english ? tierPrice(t) : t.feeUsdYear == null ? w.priceNP : t.feeUsdYear ? fillText(w.perYear, { x: L.money(t.feeUsdYear) }) : w.free;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="mode-switch" role="group" aria-label={w.modeAria}>
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
              {w.whereLive}
            </label>
            <select id="c-country" className="select" value={country} onChange={(e) => setCountry(isCountry(e.target.value) ? e.target.value : '')}>
              <option value="">{w.allCountries}</option>
              {L.countries().map((c) => (
                <option key={c.code} value={c.code}>
                  {`${c.name}${c.code === myCountry ? w.yourLocation : ''}`}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="c-spend">
              {w.spendLabel}
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
              aria-label={w.spendAria}
            />
            <span id="c-spend-help" className="faint" style={{ fontSize: 12, color: spendErr ? 'var(--bad)' : undefined }}>
              {spendErr ? fillText(w.amountErr, { a: L.num(0), b: L.num(1_000_000) }) : w.spendHelp}
            </span>
          </div>
        </div>

        <details className="calc-split">
          <summary>
            <span className="field-label">{w.split}</span> <span className="muted">{splitSummary}</span>{' '}
            <span className="calc-edit">{w.editSplit}</span>
          </summary>
          <div className="calc-grid" style={{ marginTop: 12 }}>
            <div className="field">
              <span className="field-label">{homeLabel}</span>
              <span className="input num calc-readonly" aria-live="polite">
                {L.pct(homePct)}
              </span>
              <span className="faint" style={{ fontSize: 12 }}>
                {w.homeHelp}
              </span>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="c-usd">
                {w.usdLabel}
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
                {usdErr ? w.pctErr : splitErr ? w.splitErr : w.usdHelp}
              </span>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="c-travel">
                {w.travelLabel}
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
                {travelErr ? w.pctErr : w.travelHelp}
              </span>
            </div>
          </div>
        </details>

        <div className="calc-grid">
          <div className="field">
            <Chips
              label={w.sizes}
              value={input.mix}
              onChange={(v) => set('mix', v)}
              options={[
                { value: 'balanced', label: fillText(w.balanced, { a: L.money(10), b: L.money(200) }) },
                { value: 'custom', label: w.oneSize }
              ]}
            />
            {input.mix === 'custom' ? (
              <>
                <label className="sr-only" htmlFor="c-ticket">
                  {w.avgPurchase}
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
                  {ticketErr ? fillText(w.amountErr, { a: L.num(1), b: L.num(10_000) }) : w.ticketHelp}
                </span>
              </>
            ) : (
              <span className="faint" style={{ fontSize: 12 }}>
                {fillText(w.balancedHelp, { pct: L.pct(20), list: L.and([200, 100, 50, 25, 10].map(L.money)) })}
              </span>
            )}
          </div>
          <Chips
            label={w.countAt}
            value={input.value}
            onChange={(v) => set('value', v)}
            options={[
              { value: 'face', label: w.face },
              { value: 'conservative', label: w.conservative },
              { value: 'cash', label: w.cashOnly }
            ]}
          />
          <Chips
            label={w.cardChip}
            value={input.form}
            onChange={(v) => set('form', v)}
            options={[
              { value: 'virtual', label: w.virtual },
              { value: 'physical', label: w.physical }
            ]}
          />
          <Chips
            label={w.whichYear}
            value={input.year}
            onChange={(v) => set('year', v)}
            options={[
              { value: 1, label: w.year1 },
              { value: 2, label: w.year2 }
            ]}
          />
        </div>
        <p className="faint" style={{ fontSize: 12, margin: 0 }}>
          {input.value === 'conservative' ? w.consNote : input.value === 'cash' ? w.cashNote : ''}
          {input.year === 1 ? (input.form === 'physical' ? w.year1Physical : w.year1Card) : w.year2Note}
        </p>

        {input.mode === 'best' ? (
          <div className="calc-grid">
            <Chips
              label={w.tiersChip}
              value={input.tiers}
              onChange={(v) => set('tiers', v)}
              options={[
                { value: 'best', label: w.bestTier },
                { value: 'entry', label: w.entryOnly }
              ]}
            />
            {input.tiers === 'best' ? (
              <label className="check" style={{ alignSelf: 'end' }}>
                <input type="checkbox" checked={input.all} onChange={(e) => set('all', e.target.checked)} />
                {w.includeStake}
              </label>
            ) : null}
          </div>
        ) : input.mode === 'tiers' ? (
          <div className="stack" style={{ gap: 16 }}>
          <div className="calc-grid">
            {tierPicks.map(({ card: c, tier }, i) => (
              <div className="field" key={i}>
                <label className="field-label" htmlFor={`c-card-${i}`}>
                  {tierCards.length > 1 ? fillText(w.cardN, { n: i + 1 }) : w.card}
                </label>
                <div className="calc-card-pick">
                  <select id={`c-card-${i}`} className="select" value={c.slug} onChange={(e) => setTierCard(i, e.target.value)}>
                    {eligible.map((r) => (
                      <option key={r.slug} value={r.slug}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  {tierCards.length > 1 ? (
                    <button type="button" className="btn btn-sm" onClick={() => removeTierCard(i)} aria-label={fillText(w.removeX, { name: c.name })}>
                      ×
                    </button>
                  ) : null}
                </div>
                <label className="sr-only" htmlFor={`c-tier-${i}`}>
                  {fillText(w.tierOf, { name: c.name })}
                </label>
                <select
                  id={`c-tier-${i}`}
                  className="select"
                  value={tier == null ? '' : String(tier)}
                  onChange={(e) => setPickTier(i, e.target.value === '' ? null : Number(e.target.value))}
                >
                  <option value="">{fillText(w.allNTiers, { n: L.count(c.tiers.length) })}</option>
                  {c.tiers.map((t, k) => (
                    <option key={t.name} value={k}>
                      {`${t.name} · ${pickPrice(t)}${t.comingSoon ? w.comingSoon : ''}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {tierCards.length < MAX_TIER_CARDS && eligible.length > tierCards.length ? (
              <div className="field" style={{ alignSelf: 'end' }}>
                <button type="button" className="btn" onClick={addTierCard}>
                  {tierCards.length === 1 ? w.addSecond : w.addThird}
                </button>
                <span className="faint" style={{ fontSize: 12 }}>
                  {fillText(w.upToN, { n: L.count(MAX_TIER_CARDS) })}
                </span>
              </div>
            ) : null}
          </div>
          <TierPresets cards={tierCards} value={preset} onPick={applyPreset} country={country || null} words={L.preset} />
          </div>
        ) : (
          <div className="calc-grid">
            <div className="field">
              <label className="field-label" htmlFor="c-card">
                {w.card}
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
                  {w.tier}
                </label>
                <select id="c-tier" className="select" value={Math.min(input.tier, picked.tiers.length - 1)} onChange={(e) => set('tier', Number(e.target.value))}>
                  {picked.tiers.map((t, i) => (
                    <option key={t.name} value={i}>
                      {`${t.name}${t.feeUsdYear != null ? ` (${t.feeUsdYear ? fillText(w.perYr, { x: L.money(t.feeUsdYear) }) : w.freeLower})` : ''}${t.comingSoon ? w.comingSoon : ''}`}
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
          <WalletTeaser cards={formOk} input={input} country={country} prefix={prefix} words={L.english ? undefined : { ...w, money: L.money }} />
          <BestView results={results} input={input} country={country} currency={currency} hiddenVirtual={hiddenVirtual} prices={prices} prefix={prefix} />
        </>
      ) : !picked ? (
        <p className="muted">{w.noCardHere}</p>
      ) : input.mode === 'tiers' ? (
        <TiersView picks={tierPicks} input={input} country={country} prices={prices} onPickTier={setPickTier} prefix={prefix} />
      ) : (
        <AuditView card={picked} input={input} country={country} currency={currency} prices={prices} />
      )}

      <p className="faint" style={{ fontSize: 13, maxWidth: '90ch' }}>
        {w.footA}
        <Link href="/methodology#calculator" hrefLang={toEnglish}>
          {w.howWorks}
        </Link>
        {w.footB}
        <Link href={`${prefix}/receipt`}>
          {w.receipt}
        </Link>
        {w.footC}
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
  hiddenVirtual,
  prices,
  prefix
}: {
  results: (TierResult & { card: CardRow })[];
  input: CalcInput;
  country: string;
  currency: string | null;
  hiddenVirtual: number;
  prices: Prices;
  prefix: string;
}) {
  const L = useCalcText();
  const w = L.w;
  return (
    <>
      <div className="pager">
        <p className="muted" style={{ margin: 0 }}>
          {fillNodes(w.yearAt, { spend: <b style={{ color: 'var(--text)' }}>{L.money(input.spend)}</b> })}
          {country ? fillText(w.cardsIn, { place: L.country(country) }) : ''}
          {currency ? fillText(w.homeIn, { cur: currency }) : ''} ·{' '}
          {input.tiers === 'entry' ? w.entryFree : w.bestEach}
          {hiddenVirtual ? fillText(w.hiddenN, { n: L.count(hiddenVirtual) }) : ''}
        </p>
        <ShareBar text={fillText(w.shareBest, { spend: L.money(input.spend) })} words={L.english ? undefined : L.share} />
      </div>
      <div className="table-wrap calc-wrap">
        <table className="table calc-table">
          <caption className="sr-only">{w.bestCaption}</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">{w.thCardTier}</th>
              <th scope="col">{w.thRewards}</th>
              <th scope="col">{w.thPlan}</th>
              <th scope="col">{w.thFx}</th>
              <th scope="col">{w.thPurchase}</th>
              <th scope="col">{w.thKeep}</th>
              <th scope="col">{w.thNotes}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={r.card.slug}>
                <td className={`rank ${i === 0 ? 'rank-1' : ''}`}>{L.count(i + 1)}</td>
                <td>
                  <div className="card-cell">
                    <CardArt card={r.card} size="sm" />
                    <div className="stack" style={{ gap: 2 }}>
                      <Link href={`${prefix}/cards/${r.card.slug}`}>{r.card.name}</Link>
                      <span className="faint" style={{ fontSize: 13 }}>
                        {r.tier.name}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="num" data-label={w.dlRewards}>
                  {L.cash(r.cashback)}
                </td>
                <td className="num" data-label={w.dlPlan}>
                  {L.minus(r.fee + r.oneTime)}
                  <StakeLine r={r} prices={prices} />
                </td>
                <td className="num" data-label={w.dlFx}>
                  {L.minus(r.fx)}
                </td>
                <td className="num" data-label={w.dlPurchase}>
                  {L.minus(r.tx)}
                </td>
                <td className="num calc-keep" data-label={w.dlKeep} style={{ color: keepColor(r.net) }}>
                  {L.cash(r.net)}
                </td>
                <td className="muted calc-notes">{r.flags.length ? notesOf(L, r, prices) : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** A muted "Stake ~$X" line under a fee, for tiers that need a token stake. */
function StakeLine({ r, prices }: { r: TierResult; prices: Prices }) {
  const L = useCalcText();
  const v = stakeUsd(r.tier, prices);
  return v != null ? (
    <span className="faint calc-stake" style={{ fontSize: 12 }}>
      {stakeWord(L, r.tier)} {L.approx(v)}
    </span>
  ) : null;
}

// ---------- Mode 2 ----------

type TierRow = { card: CardRow; r: TierResult };

function TiersView({
  picks,
  input,
  country,
  prices,
  onPickTier,
  prefix
}: {
  picks: TierPickRow[];
  input: CalcInput;
  country: string;
  prices: Prices;
  onPickTier?: (pick: number, tier: number | null) => void;
  prefix: string;
}) {
  const L = useCalcText();
  const w = L.w;
  const cards = picks.map((p) => p.card);
  const multi = cards.length > 1;
  const [order, setOrder] = useState<'keep' | 'card'>('keep');
  // Each card's picked tier, or all its tiers.
  const indexes = (p: TierPickRow) => (p.tier == null ? p.card.tiers.map((_, i) => i) : [p.tier]);
  const all = useMemo<TierRow[]>(
    () => {
      // A tier shown once, even when the same card is picked twice (all its tiers, and one of them).
      const seen = new Set<string>();
      return picks.flatMap((p) =>
        indexes(p)
          .filter((i) => !seen.has(`${p.card.slug}-${i}`) && Boolean(seen.add(`${p.card.slug}-${i}`)))
          .map((i) => ({ card: p.card, r: tierValue(p.card, p.card.tiers[i], input, i, country || null) }))
      );
    },
    [picks, input, country] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // With one tier on screen there is nothing to compare: no "best", just what it keeps you.
  const single = all.length === 1;
  const best = single ? undefined : all.filter(({ r }) => r.offered && !r.tier.comingSoon).sort((a, b) => b.r.net - a.r.net)[0];
  const shown = multi && order === 'keep' ? [...all].sort((a, b) => b.r.net - a.r.net) : all;
  const isBest = (x: TierRow) => best != null && x.card.slug === best.card.slug && x.r.index === best.r.index;
  // One tier picked: a tier of the same card that keeps you more at this spend, if any.
  const better = useMemo(() => {
    if (!single || picks[0]?.tier == null) return null;
    const { card } = picks[0];
    const alt = card.tiers
      .map((t, i) => tierValue(card, t, input, i, country || null))
      .filter((r) => r.offered && !r.tier.comingSoon && r.index !== picks[0].tier)
      .sort((a, b) => b.net - a.net)[0];
    return alt && alt.net > all[0].r.net + 0.5 ? alt : null;
  }, [single, picks, input, country, all]);
  // "KAST Premium" when one tier of a card is picked, "KAST Card" when all of them are.
  const names = picks.map((p) => (p.tier == null ? p.card.name : `${p.card.brand} ${p.card.tiers[p.tier].name}`));
  const title = multi ? (L.english ? fillText(w.titleAnd, { list: names.slice(0, -1).join(', '), last: names[names.length - 1] }) : L.and(names)) : names[0];
  const oneTierEach = picks.every((p) => p.tier != null);
  const allTiers = picks.filter((p) => p.tier == null && p.card.tiers.length > 1);
  const compareHref = `${prefix}/compare?c=${picks.map(entryOf).join(',')}`;
  const spend = L.money(input.spend);
  const bold = (s: string, color = 'var(--text)') => <b style={{ color }}>{s}</b>;
  const bestName = best ? `${multi ? `${best.card.brand} ` : ''}${best.r.tier.name}` : '';

  return (
    <>
      <div className="pager">
        <p className="muted" style={{ margin: 0 }}>
          {fillNodes(w.headAt, { head: oneTierEach ? title : multi ? fillText(w.tiersOfMulti, { title }) : fillText(w.tiersOfOne, { title }), spend: bold(spend) })}
          {single ? (
            <>
              {fillNodes(w.singleKeep, { x: bold(L.cash(all[0].r.net), keepColor(all[0].r.net)) })}
              {better && onPickTier ? (
                <>
                  {fillNodes(w.betterKeeps, { brand: all[0].card.brand, tier: bold(better.tier.name), x: bold(L.cash(better.net), keepColor(better.net)) })}
                  <button type="button" className="link-btn" onClick={() => onPickTier(0, null)}>
                    {fillText(w.seeAll, { brand: all[0].card.brand })}
                  </button>
                </>
              ) : null}
            </>
          ) : best && best.r.net >= 0 ? (
            <>{fillNodes(w.bestFor, { name: bold(bestName), x: L.cash(best.r.net) })}</>
          ) : best ? (
            <>{fillNodes(w.noneLose, { name: bold(bestName), x: L.cash(best.r.net) })}</>
          ) : null}
        </p>
        <ShareBar
          text={
            multi
              ? fillText(w.shareMulti, { names: names.join(w.vs), spend })
              : single
                ? fillText(w.shareSingle, { title, spend })
                : fillText(w.shareTiers, { title, spend })
          }
          words={L.english ? undefined : L.share}
        />
      </div>
      {multi ? (
        <div className="chip-row" role="group" aria-label={w.orderAria}>
          <button type="button" className="chip" aria-pressed={order === 'keep'} onClick={() => setOrder('keep')}>
            {w.sortKeep}
          </button>
          <button type="button" className="chip" aria-pressed={order === 'card'} onClick={() => setOrder('card')}>
            {w.groupCard}
          </button>
        </div>
      ) : null}
      <div className="table-wrap calc-wrap">
        <table className="table calc-table">
          <caption className="sr-only">{multi ? fillText(w.capMulti, { title }) : fillText(w.capOne, { title })}</caption>
          <thead>
            <tr>
              <th scope="col">{multi ? w.thCardTier : w.tier}</th>
              <th scope="col">{w.thRewards}</th>
              <th scope="col">{w.thPlan}</th>
              <th scope="col">{w.thFx}</th>
              <th scope="col">{w.thPurchase}</th>
              <th scope="col">{w.thKeep}</th>
              <th scope="col">{w.thNotes}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => {
              const { card, r: t } = x;
              const win = isBest(x);
              return (
                <tr key={`${card.slug}-${t.index}`} className={win ? 'calc-win' : undefined}>
                  <td>
                    {multi ? (
                      <div className="card-cell">
                        <CardArt card={card} size="sm" />
                        <div className="stack" style={{ gap: 2 }}>
                          <Link href={`${prefix}/cards/${card.slug}`}>{card.name}</Link>
                          <b style={{ fontSize: 14 }}>
                            {t.tier.name}
                            {win ? <span className="badge badge-accent calc-win-badge">{w.best}</span> : null}
                          </b>
                          <TierPrice r={t} prices={prices} />
                        </div>
                      </div>
                    ) : (
                      <div className="stack" style={{ gap: 2 }}>
                        <b>
                          {t.tier.name}
                          {win ? <span className="badge badge-accent calc-win-badge">{w.best}</span> : null}
                        </b>
                        <TierPrice r={t} prices={prices} />
                      </div>
                    )}
                  </td>
                  <td className="num" data-label={w.dlRewards}>
                    {L.cash(t.cashback)}
                  </td>
                  <td className="num" data-label={w.dlPlan}>
                    {L.minus(t.fee + t.oneTime)}
                  </td>
                  <td className="num" data-label={w.dlFx}>
                    {L.minus(t.fx)}
                  </td>
                  <td className="num" data-label={w.dlPurchase}>
                    {L.minus(t.tx)}
                  </td>
                  <td className="num calc-keep" data-label={w.dlKeep} style={{ color: keepColor(t.net) }}>
                    {L.cash(t.net)}
                  </td>
                  <td className="muted calc-notes">{t.flags.length ? notesOf(L, t, prices) : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(multi && all.length > 1) || allTiers.length ? (
      <section className="panel panel-pad stack" style={{ gap: 10 }} aria-labelledby="be-title">
        <h2 id="be-title" className="h3" style={{ margin: 0, fontSize: 20 }}>
          {multi ? w.payoffTitle : w.breakEvenTitle}
        </h2>
        {multi && all.length > 1 ? <WinnerBySpend rows={all} input={input} country={country} /> : null}
        {allTiers.map(({ card }) => (
          <BreakEvenList key={card.slug} card={card} input={input} country={country} prices={prices} heading={multi} />
        ))}
        <p className="faint" style={{ fontSize: 12, margin: 0 }}>
          {w.beFoot}
          {multi ? <Link href={compareHref}>{w.compareThese}</Link> : null}
        </p>
      </section>
      ) : null}
    </>
  );
}

const SPEND_STEPS = [250, 500, 1000, 2000, 3000, 5000, 10000];

/** The tier that keeps you the most at a range of monthly spends, among the rows shown (offered tiers only). */
function WinnerBySpend({ rows, input, country }: { rows: TierRow[]; input: CalcInput; country: string }) {
  const L = useCalcText();
  const w = L.w;
  const steps = useMemo(
    () =>
      SPEND_STEPS.map((spend) => {
        const ranked = rows
          .filter(({ r }) => r.offered && !r.tier.comingSoon)
          .map(({ card, r }) => ({ card, tier: r.tier, net: tierValue(card, r.tier, { ...input, spend }, r.index, country || null).net }))
          .sort((a, b) => b.net - a.net);
        return { spend, win: ranked[0] ?? null };
      }),
    [rows, input, country]
  );
  return (
    <div className="table-wrap">
      <table className="table calc-steps">
        <caption className="sr-only">{w.stepsCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{w.thSpend}</th>
            <th scope="col">{w.thBestTier}</th>
            <th scope="col">{w.thKeep}</th>
          </tr>
        </thead>
        <tbody>
          {steps.map(({ spend, win }) => (
            <tr key={spend} className={spend === input.spend ? 'calc-win' : undefined}>
              <td className="num">{L.money(spend)}</td>
              <td>{win ? `${win.card.brand} ${win.tier.name}` : '—'}</td>
              <td className="num" style={{ color: win ? keepColor(win.net) : undefined }}>
                {win ? L.cash(win.net) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BreakEvenList({
  card,
  input,
  country,
  prices,
  heading
}: {
  card: CardRow;
  input: CalcInput;
  country: string;
  prices: Prices;
  heading: boolean;
}) {
  const L = useCalcText();
  const w = L.w;
  const pairs = useMemo(() => breakEvens(card, input, country || null), [card, input, country]);
  const priced = (t: TierResult) => t.tier.feeUsdYear != null;
  const name = (t: TierResult) =>
    fillText(w.tierPrice, {
      tier: t.tier.name,
      price: t.tier.feeUsdYear == null ? w.priceNPLower : t.tier.feeUsdYear ? fillText(w.perYr, { x: L.money(t.tier.feeUsdYear) }) : w.freeLower
    });
  return (
    <div className="stack" style={{ gap: 6 }}>
      {heading ? (
        <h3 className="field-label" style={{ margin: 0 }}>
          {card.name}
        </h3>
      ) : null}
      {pairs.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          {country ? fillText(w.oneTierIn, { name: card.name, place: L.country(country) }) : fillText(w.oneTier, { name: card.name })}
        </p>
      ) : (
        <ul className="stack" style={{ gap: 8, margin: 0, paddingLeft: 18 }}>
          {pairs.map((p) => {
            // What the dearer tier needs (a requirement or a stake), with the stake's value today.
            const needs = p.to.flags.map((f, i) => ({ f, i })).filter(({ f }) => /^(Needs|Hold|Or hold)/.test(f));
            const stake = needs.length
              ? notesOf(L, { ...p.to, flags: needs.map((n) => n.f), stakeFlag: needs.findIndex((n) => n.i === p.to.stakeFlag) }, prices)
              : null;
            const to = <b>{name(p.to)}</b>;
            return (
              <li key={p.to.tier.name}>
                {!priced(p.from) || !priced(p.to) ? (
                  <>{fillText(w.cantCompare, { to: name(p.to), from: name(p.from) })}</>
                ) : p.beatsFrom === 0 ? (
                  <>{fillNodes(w.anySpend, { to, from: name(p.from), until: p.until != null ? fillText(w.untilUpTo, { x: L.money(p.until) }) : '' })}</>
                ) : p.beatsFrom == null ? (
                  <>{fillNodes(w.never, { to, from: name(p.from), x: L.money(BREAK_EVEN_LIMIT) })}</>
                ) : (
                  <>
                    {fillNodes(w.beats, {
                      to,
                      from: name(p.from),
                      x: <b>{fillText(w.aMonth, { x: L.money(p.beatsFrom) })}</b>,
                      until: p.until != null ? fillText(w.untilUntil, { x: L.money(p.until) }) : ''
                    })}
                  </>
                )}
                {stake ? <span className="faint"> {stake}.</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------- Mode 3 ----------

function AuditView({
  card,
  input,
  country,
  currency,
  prices
}: {
  card: CardRow;
  input: CalcInput;
  country: string;
  currency: string | null;
  prices: Prices;
}) {
  const L = useCalcText();
  const w = L.w;
  const index = Math.min(input.tier, card.tiers.length - 1);
  const r = useMemo(() => tierValue(card, card.tiers[index], input, index, country || null), [card, index, input, country]);
  const swipes = r.purchases;
  const kind = payoutKind(card.cashback.payout);
  const part = (k: 'home' | 'usd' | 'travel') => r.parts.find((p) => p.key === k)!;
  const fxLabel = (k: 'home' | 'usd' | 'travel') => {
    const p = part(k);
    const share = fillText(w.shareOfSpend, { p: L.pct(Math.round(p.share * 100)) });
    const rate = p.fxPct == null ? w.fxNP : fillText(w.fxRate, { p: L.pct(p.fxPct) });
    if (k === 'home') return fillText(w.fxHome, { cur: currency ?? w.ownCurrency, share, rate: country ? rate : w.billedCard });
    if (k === 'usd') return fillText(w.fxUsd, { share, rate });
    return fillText(w.fxTravel, { share, rate });
  };
  const small = card.fees.smallPurchase;
  type Line = { label: string; amount: number; sign: 1 | -1; muted?: boolean; skip?: boolean };
  const lines: Line[] = [
    ...r.bands.map((b) => ({
      label:
        b.to != null || b.from > 0
          ? fillText(w.cbBandRange, { p: L.pct(b.pct), from: L.money(b.from), to: b.to != null ? L.money(b.to) : w.more })
          : fillText(w.cbBand, { p: L.pct(b.pct) }),
      amount: b.amount,
      sign: 1 as const
    })),
    { label: w.txCap, amount: r.txCapCut, sign: -1, skip: r.txCapCut < 0.005 },
    { label: w.monthCap, amount: r.capCut, sign: -1, skip: r.capCut < 0.005 },
    {
      label: fillText(w.welcome, { p: L.pct(card.cashback.intro?.pct), d: L.english ? String(card.cashback.intro?.days) : L.count(card.cashback.intro?.days ?? 0) }),
      amount: r.intro,
      sign: 1,
      skip: r.intro < 0.005
    },
    { label: fillText(w.valuation, { x: card.cashback.payout ? L.tx(card.cashback.payout) : w.payoutNP }), amount: r.valueCut, sign: -1, skip: r.valueCut < 0.005 },
    { label: w.planFee, amount: r.fee, sign: -1 },
    {
      label: input.form === 'physical' ? w.physOneOff : w.cardOneOff,
      amount: r.oneTime,
      sign: -1,
      skip: input.year !== 1
    },
    { label: fxLabel('home'), amount: part('home').fx, sign: -1 },
    { label: fxLabel('usd'), amount: part('usd').fx, sign: -1 },
    { label: fxLabel('travel'), amount: part('travel').fx, sign: -1 },
    { label: fillText(w.feeEvery, { p: L.pct(card.fees.txPct) }), amount: r.txPct, sign: -1 },
    {
      label: fillText(w.flatFee, { fee: L.cash(card.fees.txFlatUsd ?? 0), n: L.count(Math.round(swipes)) }),
      amount: r.txFlat,
      sign: -1,
      skip: !card.fees.txFlatUsd
    },
    {
      label: small
        ? fillText(w.smallFee, {
            fee: L.cash(small.feeUsd),
            rule: small.inclusive ? w.atOrUnder : w.under,
            limit: L.money(small.underUsd),
            foreign: small.foreignOnly ? w.foreignOnly : '',
            free: small.freePerMonth ? fillText(w.freeFirst, { n: small.freePerMonth }) : '',
            n: L.count(Math.round(r.smallCount))
          })
        : w.smallNone,
      amount: r.small,
      sign: -1
    },
    { label: fillText(w.topUpFee, { x: card.fees.topUpPct == null ? w.topUpNP : fillText(w.topUpPct, { p: L.pct(card.fees.topUpPct) }) }), amount: r.topUp, sign: -1 }
  ];
  const shown = lines.filter((l) => !l.skip);
  const tierName = card.tiers[index].name;

  return (
    <>
      <div className="pager">
        <p className="muted" style={{ margin: 0 }}>
          {fillText(w.pagerAudit, {
            card: `${card.name}${tierName !== card.name ? ` · ${tierName}` : ''}`,
            spend: L.money(input.spend),
            n: L.count(Math.round(swipes))
          })}
          {country ? ` · ${L.country(country)}` : ''}
        </p>
        <ShareBar text={fillText(w.shareAudit, { name: card.name, spend: L.money(input.spend) })} words={L.english ? undefined : L.share} />
      </div>
      <div className="calc-receipt panel">
        <table className="table receipt">
          <caption className="sr-only">{fillText(w.auditCaption, { name: card.name, tier: tierName })}</caption>
          <thead>
            <tr>
              <th scope="col">{w.thItem}</th>
              <th scope="col">{w.thYear}</th>
              <th scope="col">{w.thMonth}</th>
              <th scope="col">{w.thPer}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => {
              const v = l.sign * l.amount;
              const fmt = (n: number) => (l.sign < 0 ? L.minus(n) : L.cash(n));
              return (
                <tr key={l.label}>
                  <th scope="row">{l.label}</th>
                  <td className="num" data-label={w.thYear} style={{ color: l.sign > 0 && v > 0 ? 'var(--ok)' : undefined }}>
                    {fmt(l.amount)}
                  </td>
                  <td className="num" data-label={w.thMonth}>
                    {fmt(l.amount / 12)}
                  </td>
                  <td className="num" data-label={w.thPer}>
                    {swipes > 0 ? fmt(l.amount / swipes) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{w.keep}</th>
              <td className="num" data-label={w.thYear} style={{ color: keepColor(r.net) }}>
                {L.cash(r.net)}
              </td>
              <td className="num" data-label={w.thMonth} style={{ color: keepColor(r.net) }}>
                {L.cash(r.net / 12)}
              </td>
              <td className="num" data-label={w.thPer} style={{ color: keepColor(r.net) }}>
                {swipes > 0 ? L.cash(r.net / swipes) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="stats">
        <div className="stat">
          <b style={{ color: keepColor(r.net) }}>{L.yieldPct(r.yieldPct)}</b>
          <span>{w.yieldLabel}</span>
        </div>
        <div className="stat">
          <b>{L.money(input.spend * 12)}</b>
          <span>{w.spentYear}</span>
        </div>
        <div className="stat">
          <b>{kind === 'unknown' ? w.notPublished : L.tx(card.cashback.payout!)}</b>
          <span>{w.paidIn}</span>
        </div>
      </div>
      {r.flags.length ? (
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          {fillText(w.notes, { x: notesOf(L, r, prices) })}
        </p>
      ) : null}
    </>
  );
}
