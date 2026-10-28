'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardRow } from '@/lib/types';
import { COUNTRIES, availabilityIn, countryName, isCountry } from '@/lib/regions';
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
import { approxUsd, money } from '@/lib/format';
import {
  PRESET_LABEL,
  currentPreset,
  parsePick,
  pickText,
  presetIndex,
  presetNames,
  tierIndex,
  tierPrice,
  tierSlug,
  type TierPreset
} from '@/lib/tierpick';
import { CardArt } from '@/components/CardArt';
import { ShareBar } from '@/components/ShareBar';
import { Chips } from '@/components/Chips';
import { WalletTeaser } from '@/components/WalletTeaser';
import { TierPresets } from '@/components/TierPresets';
import { useRegion } from '@/components/RegionContext';
import { track } from '@/lib/analytics';

type Props = {
  rows: CardRow[];
  initial: CalcInput;
  initialCountry: string;
  hadCountry: boolean;
  /** Live USD prices by CoinGecko id, for staking tiers. Missing = unavailable. */
  prices: Record<string, number>;
};

type Prices = Record<string, number>;
/** One compared card, with every tier (null) or one tier (its index). */
type TierPickRow = { card: CardRow; tier: number | null };
const entryOf = (p: TierPickRow) => pickText({ slug: p.card.slug, tier: p.tier == null ? null : tierSlug(p.card.tiers[p.tier].name) });

const MODES: { id: CalcMode; label: string; short: string }[] = [
  { id: 'best', label: 'Best card for me', short: 'Best card' },
  { id: 'tiers', label: 'Compare tiers', short: 'Compare tiers' },
  { id: 'audit', label: 'One card, line by line', short: 'Line by line' }
];

/** The notes for one tier, with the live USD value of its token stake added to the note that names it. */
const notesOf = (r: TierResult, prices: Prices) =>
  r.flags
    .map((f, i) => {
      if (i !== r.stakeFlag) return f;
      const v = stakeUsd(r.tier, prices);
      return v != null ? `${f} (${approxUsd(v)})` : f;
    })
    .join(' · ');

/** "Or stake" when staking is an alternative to the yearly fee ("$199 a year, or lock 20,000 XPL"), else "Stake". */
const stakeWord = (t: TierResult['tier']) => (t.requirement?.trim().startsWith('$') ? 'Or stake' : 'Stake');

/** "Free", "$199 a year" or "Price not published", plus the stake's live value when the tier needs one. */
function TierPrice({ r, prices }: { r: TierResult; prices: Prices }) {
  const t = r.tier;
  const v = stakeUsd(t, prices);
  return (
    <>
      <span className="faint" style={{ fontSize: 13 }}>
        {t.feeUsdYear == null ? 'Price not published' : t.feeUsdYear ? `${money(t.feeUsdYear)} a year` : 'Free'}
        {t.comingSoon ? ' · coming soon' : ''}
      </span>
      {v != null ? (
        <span className="faint calc-stake" style={{ fontSize: 12 }} title={`${t.stake!.amount!.toLocaleString('en-US')} ${t.stake!.token} at today's price`}>
          {stakeWord(t)} {approxUsd(v)}
        </span>
      ) : null}
    </>
  );
}

/** Dollars with cents for small amounts, whole dollars from $100. */
const cash = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 100 || abs === 0) return money(n);
  return `${n < 0 ? '−' : ''}$${abs.toFixed(2)}`;
};
const minus = (n: number) => (n > 0.004 ? `−${cash(n)}` : '$0');
const keepColor = (n: number) => (n >= 0 ? 'var(--ok)' : 'var(--bad)');

const numText = (v: string) => v.replace(/[^\d.]/g, '');
const bad = (text: string, min: number, max: number) => text !== '' && (!Number.isFinite(Number(text)) || Number(text) < min || Number(text) > max);

export function CalculatorClient({ rows, initial, initialCountry, hadCountry, prices }: Props) {
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
    const list = input.cards
      .map(parsePick)
      .map((p) => {
        const card = eligible.find((r) => r.slug === p.slug);
        return card ? { card, tier: tierIndex(card, p.tier) } : null;
      })
      .filter((x): x is TierPickRow => Boolean(x));
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
    const t = setTimeout(() => track('Calculator', { spend: input.spend, country: country || 'ALL', mode: input.mode }), 800);
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
    if (card) setPicks(tierPicks.map((p, j) => (j === i ? { card, tier: tierFor(card) } : p)));
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
        ) : input.mode === 'tiers' ? (
          <div className="stack" style={{ gap: 16 }}>
          <div className="calc-grid">
            {tierPicks.map(({ card: c, tier }, i) => (
              <div className="field" key={i}>
                <label className="field-label" htmlFor={`c-card-${i}`}>
                  {tierCards.length > 1 ? `Card ${i + 1}` : 'Card'}
                </label>
                <div className="calc-card-pick">
                  <select id={`c-card-${i}`} className="select" value={c.slug} onChange={(e) => setTierCard(i, e.target.value)}>
                    {eligible.map((r) => (
                      <option key={r.slug} value={r.slug} disabled={r.slug !== c.slug && tierSlugs.includes(r.slug)}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  {tierCards.length > 1 ? (
                    <button type="button" className="btn btn-sm" onClick={() => removeTierCard(i)} aria-label={`Remove ${c.name}`}>
                      ×
                    </button>
                  ) : null}
                </div>
                <label className="sr-only" htmlFor={`c-tier-${i}`}>
                  {c.name} tier
                </label>
                <select
                  id={`c-tier-${i}`}
                  className="select"
                  value={tier == null ? '' : String(tier)}
                  onChange={(e) => setPickTier(i, e.target.value === '' ? null : Number(e.target.value))}
                >
                  <option value="">All {c.tiers.length} tiers</option>
                  {c.tiers.map((t, k) => (
                    <option key={t.name} value={k}>
                      {t.name} · {tierPrice(t)}
                      {t.comingSoon ? ' · coming soon' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {tierCards.length < MAX_TIER_CARDS && eligible.length > tierCards.length ? (
              <div className="field" style={{ alignSelf: 'end' }}>
                <button type="button" className="btn" onClick={addTierCard}>
                  + Add a {tierCards.length === 1 ? 'second' : 'third'} card
                </button>
                <span className="faint" style={{ fontSize: 12 }}>
                  Compare tiers across up to {MAX_TIER_CARDS} cards
                </span>
              </div>
            ) : null}
          </div>
          <TierPresets cards={tierCards} value={preset} onPick={applyPreset} country={country || null} />
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
          <WalletTeaser cards={formOk} input={input} country={country} />
          <BestView results={results} input={input} country={country} currency={currency} hiddenVirtual={hiddenVirtual} prices={prices} />
        </>
      ) : !picked ? (
        <p className="muted">No card is available where you live yet.</p>
      ) : input.mode === 'tiers' ? (
        <TiersView picks={tierPicks} input={input} country={country} prices={prices} onPickTier={setPickTier} />
      ) : (
        <AuditView card={picked} input={input} country={country} currency={currency} prices={prices} />
      )}

      <p className="faint" style={{ fontSize: 13, maxWidth: '90ch' }}>
        Missing figures are counted as zero and flagged in the notes. Spending caps, spend bands and small-purchase limits
        are applied where the issuer publishes them. Top-up fees are worked out on everything you load, including the money
        that goes on fees. <Link href="/methodology#calculator">How the calculator works</Link>. To see one purchase line by
        line, try the <Link href="/receipt">swipe receipt</Link>.
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
  prices
}: {
  results: (TierResult & { card: CardRow })[];
  input: CalcInput;
  country: string;
  currency: string | null;
  hiddenVirtual: number;
  prices: Prices;
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
                  <StakeLine r={r} prices={prices} />
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
                <td className="muted calc-notes">{r.flags.length ? notesOf(r, prices) : null}</td>
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
  const v = stakeUsd(r.tier, prices);
  return v != null ? (
    <span className="faint calc-stake" style={{ fontSize: 12 }}>
      {stakeWord(r.tier)} {approxUsd(v)}
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
  onPickTier
}: {
  picks: TierPickRow[];
  input: CalcInput;
  country: string;
  prices: Prices;
  onPickTier?: (pick: number, tier: number | null) => void;
}) {
  const cards = picks.map((p) => p.card);
  const multi = cards.length > 1;
  const [order, setOrder] = useState<'keep' | 'card'>('keep');
  // Each card's picked tier, or all its tiers.
  const indexes = (p: TierPickRow) => (p.tier == null ? p.card.tiers.map((_, i) => i) : [p.tier]);
  const all = useMemo<TierRow[]>(
    () => picks.flatMap((p) => indexes(p).map((i) => ({ card: p.card, r: tierValue(p.card, p.card.tiers[i], input, i, country || null) }))),
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
  const title = multi ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  const oneTierEach = picks.every((p) => p.tier != null);
  const allTiers = picks.filter((p) => p.tier == null && p.card.tiers.length > 1);
  const compareHref = `/compare?c=${picks.map(entryOf).join(',')}`;

  return (
    <>
      <div className="pager">
        <p className="muted" style={{ margin: 0 }}>
          {oneTierEach ? title : multi ? `Tiers of ${title}` : `${title} tiers`} at <b style={{ color: 'var(--text)' }}>{money(input.spend)}</b> a month
          {single ? (
            <>
              : you keep{' '}
              <b style={{ color: keepColor(all[0].r.net) }}>{cash(all[0].r.net)}</b> a year
              {better && onPickTier ? (
                <>
                  . {all[0].card.brand} <b style={{ color: 'var(--text)' }}>{better.tier.name}</b> keeps you{' '}
                  <b style={{ color: keepColor(better.net) }}>{cash(better.net)}</b>.{' '}
                  <button type="button" className="link-btn" onClick={() => onPickTier(0, null)}>
                    See all {all[0].card.brand} tiers
                  </button>
                </>
              ) : null}
            </>
          ) : best && best.r.net >= 0 ? (
            <>
              {' '}
              · best for you:{' '}
              <b style={{ color: 'var(--text)' }}>
                {multi ? `${best.card.brand} ` : ''}
                {best.r.tier.name}
              </b>{' '}
              ({cash(best.r.net)} a year)
            </>
          ) : best ? (
            <>
              {' '}
              · none of these pays off at this spend;{' '}
              <b style={{ color: 'var(--text)' }}>
                {multi ? `${best.card.brand} ` : ''}
                {best.r.tier.name}
              </b>{' '}
              loses the least ({cash(best.r.net)} a year)
            </>
          ) : null}
        </p>
        <ShareBar
          text={
            multi
              ? `${names.join(' vs ')}: which pays off at ${money(input.spend)}/month · G2M calculator`
              : single
                ? `${title}: what it really keeps you at ${money(input.spend)}/month · G2M calculator`
                : `Which ${title} tier pays off at ${money(input.spend)}/month · G2M calculator`
          }
        />
      </div>
      {multi ? (
        <div className="chip-row" role="group" aria-label="Order of the tiers">
          <button type="button" className="chip" aria-pressed={order === 'keep'} onClick={() => setOrder('keep')}>
            Sort by what you keep
          </button>
          <button type="button" className="chip" aria-pressed={order === 'card'} onClick={() => setOrder('card')}>
            Group by card
          </button>
        </div>
      ) : null}
      <div className="table-wrap calc-wrap">
        <table className="table calc-table">
          <caption className="sr-only">{multi ? `Tiers of ${title} side by side` : `${title} tiers side by side`}</caption>
          <thead>
            <tr>
              <th scope="col">{multi ? 'Card · tier' : 'Tier'}</th>
              <th scope="col">Rewards / yr</th>
              <th scope="col">Plan and card fees / yr</th>
              <th scope="col">FX cost / yr</th>
              <th scope="col">Purchase fees / yr</th>
              <th scope="col">You keep / yr</th>
              <th scope="col">Notes</th>
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
                          <Link href={`/cards/${card.slug}`}>{card.name}</Link>
                          <b style={{ fontSize: 14 }}>
                            {t.tier.name}
                            {win ? <span className="badge badge-accent calc-win-badge">Best</span> : null}
                          </b>
                          <TierPrice r={t} prices={prices} />
                        </div>
                      </div>
                    ) : (
                      <div className="stack" style={{ gap: 2 }}>
                        <b>
                          {t.tier.name}
                          {win ? <span className="badge badge-accent calc-win-badge">Best</span> : null}
                        </b>
                        <TierPrice r={t} prices={prices} />
                      </div>
                    )}
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
                  <td className="muted calc-notes">{t.flags.length ? notesOf(t, prices) : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(multi && all.length > 1) || allTiers.length ? (
      <section className="panel panel-pad stack" style={{ gap: 10 }} aria-labelledby="be-title">
        <h2 id="be-title" className="h3" style={{ margin: 0, fontSize: 20 }}>
          {multi ? 'Which one pays off at your spend' : 'Break-even points'}
        </h2>
        {multi && all.length > 1 ? <WinnerBySpend rows={all} input={input} country={country} /> : null}
        {allTiers.map(({ card }) => (
          <BreakEvenList key={card.slug} card={card} input={input} country={country} prices={prices} heading={multi} />
        ))}
        <p className="faint" style={{ fontSize: 12, margin: 0 }}>
          Worked out with all your other settings unchanged. Staking or lockups a tier needs are not counted as a cost;
          their value today is shown next to them.{' '}
          {multi ? <Link href={compareHref}>Compare these side by side: perks, caps and how to qualify</Link> : null}
        </p>
      </section>
      ) : null}
    </>
  );
}

const SPEND_STEPS = [250, 500, 1000, 2000, 3000, 5000, 10000];

/** The tier that keeps you the most at a range of monthly spends, among the rows shown (offered tiers only). */
function WinnerBySpend({ rows, input, country }: { rows: TierRow[]; input: CalcInput; country: string }) {
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
        <caption className="sr-only">The best of the tiers shown at each monthly spend</caption>
        <thead>
          <tr>
            <th scope="col">Monthly spend</th>
            <th scope="col">Best tier</th>
            <th scope="col">You keep / yr</th>
          </tr>
        </thead>
        <tbody>
          {steps.map(({ spend, win }) => (
            <tr key={spend} className={spend === input.spend ? 'calc-win' : undefined}>
              <td className="num">{money(spend)}</td>
              <td>{win ? `${win.card.brand} ${win.tier.name}` : '—'}</td>
              <td className="num" style={{ color: win ? keepColor(win.net) : undefined }}>
                {win ? cash(win.net) : '—'}
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
  const pairs = useMemo(() => breakEvens(card, input, country || null), [card, input, country]);
  const priced = (t: TierResult) => t.tier.feeUsdYear != null;
  const name = (t: TierResult) => `${t.tier.name} (${t.tier.feeUsdYear == null ? 'price not published' : t.tier.feeUsdYear ? `${money(t.tier.feeUsdYear)}/yr` : 'free'})`;
  return (
    <div className="stack" style={{ gap: 6 }}>
      {heading ? (
        <h3 className="field-label" style={{ margin: 0 }}>
          {card.name}
        </h3>
      ) : null}
      {pairs.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          {card.name} has one tier{country ? ` open in ${countryName(country)}` : ''}, so there is nothing to compare.
        </p>
      ) : (
        <ul className="stack" style={{ gap: 8, margin: 0, paddingLeft: 18 }}>
          {pairs.map((p) => {
            // What the dearer tier needs (a requirement or a stake), with the stake's value today.
            const needs = p.to.flags.map((f, i) => ({ f, i })).filter(({ f }) => /^(Needs|Hold|Or hold)/.test(f));
            const stake = needs.length
              ? notesOf({ ...p.to, flags: needs.map((n) => n.f), stakeFlag: needs.findIndex((n) => n.i === p.to.stakeFlag) }, prices)
              : null;
            return (
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
    { label: 'Lost to the per-purchase cap', amount: r.txCapCut, sign: -1, skip: r.txCapCut < 0.005 },
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
        ? `Small-purchase fee (${cash(card.fees.smallPurchase.feeUsd)} ${card.fees.smallPurchase.inclusive ? 'at or under' : 'under'} ${money(card.fees.smallPurchase.underUsd)}${card.fees.smallPurchase.foreignOnly ? ', foreign purchases only' : ''}${card.fees.smallPurchase.freePerMonth ? `, first ${card.fees.smallPurchase.freePerMonth} a month free` : ''} × ${Math.round(r.smallCount)})`
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
          Notes: {notesOf(r, prices)}
        </p>
      ) : null}
    </>
  );
}
