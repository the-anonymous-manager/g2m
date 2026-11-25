'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardRow } from '@/lib/types';
import { baseCurrencies, swipeReceipt, type SwipeLine, type SwipeNote } from '@/lib/swipe';
import { COUNTRY_CURRENCY, currencyOf } from '@/lib/currencies.mjs';
import { useRegion } from '@/components/RegionContext';
import { track } from '@/lib/analytics';
import { site } from '@/lib/site';
import { receiptQuery, type ReceiptParams } from '@/lib/receipt-params';
import { tierPrice } from '@/lib/tierpick';
import { calcText } from '@/components/calcText';
import { fillText } from '@/lib/i18n/clientFormat';
import { receiptEn } from '@/lib/i18n/ui/receipt/en';
import type { Ui } from '@/lib/i18n/ui/en';

type Props = {
  /** The cards to pick from. */
  cards: CardRow[];
  /** Settings from a shared link (card, tier, amount, currency, what). */
  initial?: ReceiptParams;
  /** Keep the page address in step, so the address bar can be copied as a link to this receipt. */
  syncUrl?: boolean;
  /** Units of each currency per 1 US dollar. null = live rates unavailable (US dollars only). */
  perUsd: Record<string, number> | null;
  /** Another language (English when left out): its words, language tag, address prefix (/de) and the sheet text the
   *  receipt shows ("paid in"), English → translation. */
  ui?: Ui;
  tag?: string;
  prefix?: string;
  sheet?: Record<string, string>;
};

type W = typeof receiptEn;
// The link keeps these English names (`what=Coffee`); each language shows its own word.
const PRESETS = [
  { label: 'Coffee', usd: 10 },
  { label: 'Subscription', usd: 20 },
  { label: 'Dinner', usd: 50 },
  { label: 'Flight or hotel', usd: 200 }
] as const;
const WHAT = ['Coffee', 'Subscription', 'Dinner', 'Flight or hotel', 'Purchase'] as const;
const COMMON = ['USD', 'EUR', 'GBP', 'AED', 'INR', 'SGD', 'AUD', 'CAD', 'CHF', 'JPY', 'HKD', 'THB', 'PHP', 'BRL', 'MXN', 'ARS', 'TRY', 'NGN', 'ZAR'];
/** Every country's everyday currency (lib/currencies.mjs): listed under the common ones when there is a live rate. */
const WORLD = [...new Set(Object.values(COUNTRY_CURRENCY) as string[])].sort();

/** A preset in another currency, rounded to a price that looks real (e.g. ₹840, €9.20). */
function niceAmount(x: number): number {
  if (x >= 1000) return Math.round(x / 10) * 10;
  if (x >= 100) return Math.round(x);
  return Math.round(x * 10) / 10;
}

/** Money in any currency, in the page's language ("en-US" keeps the English page as it was). */
function money(n: number, currency: string, tag = 'en-US'): string {
  let s: string;
  try {
    s = new Intl.NumberFormat(tag, { style: 'currency', currency }).format(n);
  } catch {
    s = `${n.toFixed(2)} ${currency}`;
  }
  // In right-to-left text an amount keeps its own order.
  return tag.startsWith('ar') ? `⁦${s}⁩` : s;
}

/** One receipt line in another language, from the facts lib/swipe.ts recorded (English keeps its own label). */
function lineText(l: SwipeLine, w: W, pct: (n: number) => string, usd: (n: number) => string, cur: (n: number, c: string) => string, tx: (s: string) => string): string {
  const v = l.vars ?? {};
  switch (l.key) {
    case 'price':
      return v.asPaid ? w.lPrice : fillText(w.lPriceIn, { x: cur(Number(v.amount), String(v.currency)) });
    case 'fx':
      return v.foreign ? fillText(w.lFxForeign, { p: pct(Number(v.pct)), cur: String(v.currency), base: String(v.base) }) : fillText(w.lFxHome, { p: pct(Number(v.pct)), base: String(v.base) });
    case 'tx':
      return fillText(w.lTx, { p: v.min != null ? `${pct(Number(v.pct))}, ${fillText(w.minFee, { x: usd(Number(v.min)) })}` : pct(Number(v.pct)) });
    case 'flat':
      return fillText(w.lFlat, { x: usd(Number(v.usd)) });
    case 'small':
      return fillText(w.lSmall, { fee: usd(Number(v.fee)), rule: v.inclusive ? w.atOrUnder : w.under, under: usd(Number(v.under)), foreign: v.foreignOnly ? w.foreignPurchases : '' });
    case 'topup':
      return fillText(w.lTopUp, { p: pct(Number(v.pct)) });
    case 'cashback':
      return fillText(w.lCashback, {
        p: pct(Number(v.pct)),
        cap: v.capUsd != null ? fillText(w.capped, { x: usd(Number(v.capUsd)) }) : '',
        payout: v.payout ? fillText(w.payoutIn, { x: tx(String(v.payout)) }) : ''
      });
    default:
      return l.label;
  }
}

function noteText(n: SwipeNote, w: W, usd: (n: number) => string, count: (n: number) => string): string {
  switch (n.k) {
    case 'billing':
      return w.nBilling;
    case 'noRate':
      return w.nNoRate;
    case 'fxNP':
      return w.nFxNP;
    case 'topUpNP':
      return w.nTopUpNP;
    case 'freeSmall':
      return fillText(w.nFreeSmall, { n: count(n.n ?? 0) });
    case 'cbNP':
      return w.nCbNP;
    case 'capTx':
      return fillText(w.nCapTx, { x: usd(n.n ?? 0) });
    case 'capMonth':
      return fillText(w.nCapMonth, { x: usd(n.n ?? 0) });
  }
}

// One purchase on one card, as a receipt: price, every fee, the cashback, and what it really cost.
export function SwipeReceipt({ cards, initial, perUsd, syncUrl = false, ui, tag, prefix = '', sheet }: Props) {
  const english = !ui || !tag;
  const w: W = english ? receiptEn : ui.receipt;
  const L = useMemo(() => (english ? calcText() : calcText(ui, tag)), [english, ui, tag]);
  const lang = english ? 'en-US' : tag!;
  const fmt = (n: number, currency: string) => money(n, currency, lang);
  const pct = (n: number) => (english ? `${n}%` : new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 2 }).format(n / 100));
  const usd = (n: number) => (english ? `$${Number.isInteger(n) ? n : n.toFixed(2)}` : Number.isInteger(n) ? L.money(n) : L.cash(n));
  const count = (n: number) => (english ? String(n) : n.toLocaleString(lang));
  const tx = (s: string) => (english ? s : (sheet?.[s] ?? s));
  const whatText = (s: string) => (english ? s : (WHAT as readonly string[]).includes(s) ? w[s as (typeof WHAT)[number]] : s);
  const price = (t: CardRow['tiers'][number]) =>
    english ? tierPrice(t) : t.feeUsdYear == null ? ui.calc.priceNP : t.feeUsdYear ? fillText(ui.calc.perYear, { x: L.money(t.feeUsdYear) }) : ui.calc.free;

  const { country } = useRegion();
  const home = currencyOf(country);
  // The common currencies first (and the visitor's own), then every other currency with a live rate, A to Z.
  const currencyGroups = useMemo(() => {
    const ok = (c: string) => c === 'USD' || Boolean(perUsd?.[c]);
    const top = COMMON.filter(ok);
    if (home && ok(home) && !top.includes(home)) top.unshift(home);
    const more = WORLD.filter((c) => ok(c) && !top.includes(c));
    return { top, more };
  }, [perUsd, home]);
  const currencies = useMemo(() => [...currencyGroups.top, ...currencyGroups.more], [currencyGroups]);

  const fromLink = Boolean(initial?.card);
  const [slug, setSlug] = useState(initial?.card ?? cards[0]?.slug);
  const card = cards.find((c) => c.slug === slug) ?? cards[0];
  const [tierIndex, setTierIndex] = useState(initial?.tier ?? 0);
  const [currency, setCurrency] = useState(fromLink ? initial!.cur : 'USD');
  const [amountText, setAmountText] = useState(String(fromLink ? initial!.amt : 10));
  const [label, setLabel] = useState(fromLink ? initial!.what : 'Coffee');
  // The card's base (billing) currency, and the receipt's currency (null = same as the shop's).
  const [base, setBase] = useState<string | null>(fromLink ? initial!.base : null);
  const [display, setDisplay] = useState<string | null>(fromLink ? initial!.show : null);
  // Matching a real app screenshot: which amount was entered, and the amount (in the card's base currency).
  const [matchMode, setMatchMode] = useState<'cleared' | 'total' | 'rate'>(
    initial?.total ? 'total' : initial?.rate ? 'rate' : 'cleared'
  );
  const [matchText, setMatchText] = useState(String(initial?.cleared ?? initial?.total ?? initial?.rate ?? ''));
  const touched = useRef(fromLink);

  // Without a shared link, start in the visitor's own currency once it is known.
  useEffect(() => {
    if (touched.current || !home || !currencies.includes(home)) return;
    setCurrency(home);
    const rate = home === 'USD' ? 1 : perUsd?.[home] ?? 1;
    setAmountText(String(niceAmount(10 * rate)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, currencies.length]);

  if (!card) return null;
  const tier = card.tiers[Math.min(tierIndex, card.tiers.length - 1)];
  const amount = Math.min(Math.max(Number(amountText) || 0, 0), 1_000_000);
  const bases = baseCurrencies(card, home);
  const matchValue = Number(matchText) > 0 ? Number(matchText) : null;
  const r = swipeReceipt(card, tier, amount, currency, perUsd ?? {}, {
    base,
    display,
    homeCurrency: home,
    cleared: matchMode === 'cleared' ? matchValue : null,
    total: matchMode === 'total' ? matchValue : null,
    rate: matchMode === 'rate' ? matchValue : null
  });
  const shown = r.display;
  const rate = currency === 'USD' ? 1 : perUsd?.[currency] ?? 1;
  const what = whatText(label);
  const lineLabel = (l: SwipeLine) => (english ? l.label : lineText(l, w, pct, usd, fmt, tx));
  const notes = english ? r.notes : r.noteParts.map((n) => noteText(n, w, usd, count));
  const signedRaw = `${r.netPct >= 0 ? '+' : '−'}${english ? `${Math.abs(r.netPct).toFixed(2)}%` : new Intl.NumberFormat(lang, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(r.netPct) / 100)}`;
  // In right-to-left text the sign stays with the number.
  const signedPct = lang.startsWith('ar') ? `\u2066${signedRaw}\u2069` : signedRaw;

  const pickPreset = (p: (typeof PRESETS)[number]) => {
    setLabel(p.label);
    setAmountText(String(niceAmount(p.usd * rate)));
  };
  const changeCurrency = (cur: string) => {
    touched.current = true;
    const usdAmount = amount / rate;
    const next = cur === 'USD' ? 1 : perUsd?.[cur] ?? 1;
    setCurrency(cur);
    setAmountText(String(niceAmount(usdAmount * next)));
  };

  const params: ReceiptParams = {
    card: card.slug,
    tier: card.tiers.indexOf(tier),
    amt: amount,
    cur: currency,
    what: label,
    base: r.base,
    show: shown,
    cleared: matchMode === 'cleared' ? matchValue : null,
    total: matchMode === 'total' ? matchValue : null,
    rate: matchMode === 'rate' ? matchValue : null,
    home: home ?? null
  };
  const query = receiptQuery(params);
  // The receipt page; its share preview is the receipt picture.
  const shareUrl = () => `${site.url}${prefix}/receipt?${query}`;
  useEffect(() => {
    if (!syncUrl) return;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${query}`);
  }, [syncUrl, query]);
  const postOnX = () => {
    const headline = r.headlinePct != null ? fillText(w.xHeadline, { p: pct(r.headlinePct) }) : w.xNoHeadline;
    const text = fillText(w.xText, {
      card: card.name,
      headline,
      amount: fmt(amount, currency),
      what: english ? what.toLowerCase() : what,
      base: r.base,
      outcome: signedPct,
      kept: r.net >= 0 ? w.xKept : w.xLost,
      x: fmt(Math.abs(r.net), shown)
    });
    track('Share', { channel: 'x', what: 'receipt' });
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl())}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="swipe">
      <div className="stack swipe-controls" style={{ gap: 14 }}>
        {cards.length > 1 ? (
          <div className="field">
            <label className="field-label" htmlFor="sw-card">
              {w.card}
            </label>
            <select
              id="sw-card"
              className="select"
              value={card.slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setTierIndex(0);
                setBase(null);
              }}
            >
              {cards.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {/* Always shown, so it is clear which tier the receipt uses even when a card has only one. */}
        <div className="field">
          <label className="field-label" htmlFor="sw-tier">
            {w.tier}
          </label>
          <select
            id="sw-tier"
            className="select"
            value={card.tiers.indexOf(tier)}
            onChange={(e) => setTierIndex(Number(e.target.value))}
            disabled={card.tiers.length < 2}
          >
            {card.tiers.map((t, i) => (
              <option key={t.name} value={i}>
                {t.name} · {price(t)}
                {t.comingSoon ? w.comingSoon : ''}
              </option>
            ))}
          </select>
          {card.tiers.length < 2 ? (
            <span className="faint" style={{ fontSize: 12 }}>
              {fillText(w.oneTier, { name: card.name })}
            </span>
          ) : null}
        </div>
        <div className="chip-row" role="group" aria-label={w.quick}>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="chip" aria-pressed={label === p.label} onClick={() => pickPreset(p)}>
              {english ? `${p.label} $${p.usd}` : `${w[p.label]} ${L.money(p.usd)}`}
            </button>
          ))}
        </div>
        <div className="swipe-fields">
          <div className="field">
            <label className="field-label" htmlFor="sw-amount">
              {w.amount}
            </label>
            <input
              id="sw-amount"
              className="input num"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => {
                setAmountText(e.target.value.replace(/[^\d.]/g, ''));
                setLabel('Purchase');
              }}
            />
          </div>
        </div>
        <div className="swipe-currencies">
          <div className="field">
            <label className="field-label" htmlFor="sw-base">
              {w.baseCur}
            </label>
            <select id="sw-base" className="select" value={r.base} onChange={(e) => setBase(e.target.value)} disabled={bases.list.length < 2}>
              {bases.list.map((c) => (
                <option key={c} value={c}>
                  {c}
                  {!bases.known ? w.assumed : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="sw-cur">
              {w.paidIn}
            </label>
            <select id="sw-cur" className="select" value={currency} onChange={(e) => changeCurrency(e.target.value)}>
              {currencyGroups.top.map((c) => (
                <option key={c} value={c}>
                  {c}
                  {c === home ? w.yours : ''}
                </option>
              ))}
              {currencyGroups.more.length ? (
                <optgroup label={w.moreCur}>
                  {currencyGroups.more.map((c) => (
                    <option key={c} value={c}>
                  {c}
                  {c === home ? w.yours : ''}
                </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="sw-show">
              {w.showIn}
            </label>
            <select id="sw-show" className="select" value={shown} onChange={(e) => setDisplay(e.target.value === currency ? null : e.target.value)}>
              {currencyGroups.top.map((c) => (
                <option key={c} value={c}>
                  {c}
                  {c === currency ? w.asPaid : ''}
                </option>
              ))}
              {currencyGroups.more.length ? (
                <optgroup label={w.moreCur}>
                  {currencyGroups.more.map((c) => (
                    <option key={c} value={c}>
                  {c}
                  {c === currency ? w.asPaid : ''}
                </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </div>
        </div>
        <p className="faint" style={{ fontSize: 12, margin: 0 }}>
          {r.foreign ? fillText(w.foreignNote, { cur: currency, base: r.base }) : fillText(w.homeNote, { base: r.base })}
        </p>
        <details className="calc-split swipe-match" open={Boolean(matchValue)}>
          <summary>
            <span className="field-label">{w.match}</span> <span className="muted">{w.matchHint}</span>
          </summary>
          <div className="stack" style={{ gap: 10, marginTop: 12 }}>
            <div className="chip-row" role="group" aria-label={w.matchAria}>
              {(
                [
                  ['cleared', w.mCleared],
                  ['total', w.mTotal],
                  ['rate', w.mRate]
                ] as const
              ).map(([k, lbl]) => (
                <button key={k} type="button" className="chip" aria-pressed={matchMode === k} onClick={() => setMatchMode(k)}>
                  {lbl}
                </button>
              ))}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="sw-match">
                {matchMode === 'rate' ? fillText(w.ratePer, { cur: currency, base: r.base }) : fillText(w.amountIn, { base: r.base })}
              </label>
              <input
                id="sw-match"
                className="input num"
                inputMode="decimal"
                placeholder={fillText(w.eg, { x: matchMode === 'cleared' ? '19.53' : matchMode === 'total' ? '19.63' : '95.42' })}
                value={matchText}
                onChange={(e) => setMatchText(e.target.value.replace(/[^\d.]/g, ''))}
              />
              <span className="faint" style={{ fontSize: 12 }}>
                {matchMode === 'cleared' ? w.helpCleared : matchMode === 'total' ? w.helpTotal : w.helpRate}
              </span>
            </div>
          </div>
        </details>
        {!perUsd ? (
          <p className="faint" style={{ fontSize: 12, margin: 0 }}>
            {w.noRates}
          </p>
        ) : null}
      </div>

      <figure className="slip" aria-label={fillText(w.slipAria, { what, card: card.name })}>
        <div className="slip-head">
          <span>{w.slipTag}</span>
          <span>{card.name}</span>
        </div>
        <p className="slip-sub">
          {fillText(w.slipSub, { what, tier: tier.name, base: r.base, cur: currency })}
          {currency !== 'USD' ? fillText(w.approx, { x: english ? `$${r.usd.toFixed(2)}` : L.cash(r.usd) }) : ''}
        </p>
        <dl className="slip-lines">
          {r.lines.flatMap((l) => [
            <div key={l.key} className={`slip-line slip-${l.kind}`}>
              <dt>
                {l.kind === 'fee' ? '+ ' : l.kind === 'reward' ? '− ' : ''}
                {lineLabel(l)}
              </dt>
              <dd>{fmt(l.amount, shown)}</dd>
            </div>,
            // Card apps show price + FX as one "cleared" amount, with the FX fee hidden in the rate.
            ...(l.key === 'fx'
              ? [
                  <div key="cleared" className="slip-line slip-cleared">
                    <dt>{w.cleared}</dt>
                    <dd>
                      {fmt(r.cleared, shown)}
                      {shown !== r.base ? ` · ${fmt(r.clearedBase, r.base)}` : ''}
                    </dd>
                  </div>
                ]
              : [])
          ])}
        </dl>
        <div className="slip-total">
          <div className="slip-line">
            <dt>{w.paidTill}</dt>
            <dd>{fmt(r.totalPaid, shown)}</dd>
          </div>
          <div className="slip-line">
            <dt>{w.realCost}</dt>
            <dd>{fmt(Math.round((r.totalPaid - r.cashback) * 100) / 100, shown)}</dd>
          </div>
        </div>
        <div className="slip-result" style={{ color: r.net >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
          <b>{signedPct}</b>
          <span>{r.net >= 0 ? fillText(w.youKeep, { x: fmt(r.net, shown) }) : fillText(w.costsMore, { x: fmt(-r.net, shown) })}</span>
        </div>
        {r.headlinePct != null ? <p className="slip-note">{fillText(w.advertised, { p: pct(r.headlinePct) })}</p> : null}
        {r.mode !== 'live' ? (
          <p className="slip-note">
            {w.matched}
            {r.impliedRate ? fillText(w.matchedRate, { base: r.base, x: fmt(r.impliedRate, currency) }) : ''}
          </p>
        ) : r.foreign ? (
          <p className="slip-note">{w.liveRate}</p>
        ) : null}
        {notes.length ? <p className="slip-note">{notes.join(' · ')}</p> : null}
        <div className="slip-actions">
          <button type="button" className="btn btn-metal btn-sm" onClick={postOnX}>
            {w.postX}
          </button>
          <a className="btn btn-sm" href={`/receipt/image?${query}&size=tall`} download={`g2m-receipt-${card.slug}.png`} onClick={() => track('Share', { channel: 'image', what: 'receipt' })}>
            {w.download}
          </a>
        </div>
      </figure>
    </div>
  );
}
