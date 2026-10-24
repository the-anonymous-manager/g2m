'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardRow } from '@/lib/types';
import { baseCurrencies, swipeReceipt } from '@/lib/swipe';
import { currencyOf } from '@/lib/currencies.mjs';
import { useRegion } from '@/components/RegionContext';
import { track } from '@/lib/analytics';
import { site } from '@/lib/site';
import { receiptQuery, type ReceiptParams } from '@/lib/receipt-params';

type Props = {
  /** The cards to pick from. */
  cards: CardRow[];
  /** Settings from a shared link (card, tier, amount, currency, what). */
  initial?: ReceiptParams;
  /** Keep the page address in step, so the address bar can be copied as a link to this receipt. */
  syncUrl?: boolean;
  /** Units of each currency per 1 US dollar. null = live rates unavailable (US dollars only). */
  perUsd: Record<string, number> | null;
};

const PRESETS = [
  { label: 'Coffee', usd: 10 },
  { label: 'Subscription', usd: 20 },
  { label: 'Dinner', usd: 50 },
  { label: 'Flight or hotel', usd: 200 }
];
const COMMON = ['USD', 'EUR', 'GBP', 'AED', 'INR', 'SGD', 'AUD', 'CAD', 'CHF', 'JPY', 'HKD', 'THB', 'PHP', 'BRL', 'MXN', 'ARS', 'TRY', 'NGN', 'ZAR'];

/** A preset in another currency, rounded to a price that looks real (e.g. ₹840, €9.20). */
function niceAmount(x: number): number {
  if (x >= 1000) return Math.round(x / 10) * 10;
  if (x >= 100) return Math.round(x);
  return Math.round(x * 10) / 10;
}

function fmt(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

// One purchase on one card, as a receipt: price, every fee, the cashback, and what it really cost.
export function SwipeReceipt({ cards, initial, perUsd, syncUrl = false }: Props) {
  const { country } = useRegion();
  const home = currencyOf(country);
  const currencies = useMemo(() => {
    const ok = (c: string) => c === 'USD' || Boolean(perUsd?.[c]);
    const list = COMMON.filter(ok);
    if (home && ok(home) && !list.includes(home)) list.unshift(home);
    return list;
  }, [perUsd, home]);

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
  const r = swipeReceipt(card, tier, amount, currency, perUsd ?? {}, { base, display, homeCurrency: home });
  const shown = r.display;
  const rate = currency === 'USD' ? 1 : perUsd?.[currency] ?? 1;

  const pickPreset = (p: (typeof PRESETS)[number]) => {
    setLabel(p.label);
    setAmountText(String(niceAmount(p.usd * rate)));
  };
  const changeCurrency = (cur: string) => {
    touched.current = true;
    const usd = amount / rate;
    const next = cur === 'USD' ? 1 : perUsd?.[cur] ?? 1;
    setCurrency(cur);
    setAmountText(String(niceAmount(usd * next)));
  };

  const params: ReceiptParams = {
    card: card.slug,
    tier: card.tiers.indexOf(tier),
    amt: amount,
    cur: currency,
    what: label,
    base: r.base,
    show: shown,
    home: home ?? null
  };
  const query = receiptQuery(params);
  // The receipt page; its share preview is the receipt picture.
  const shareUrl = () => `${site.url}/receipt?${query}`;
  useEffect(() => {
    if (!syncUrl) return;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${query}`);
  }, [syncUrl, query]);
  const postOnX = () => {
    const headline = r.headlinePct != null ? `"up to ${r.headlinePct}% back"` : 'its rewards';
    const outcome = `${r.netPct >= 0 ? '+' : '−'}${Math.abs(r.netPct).toFixed(2)}%`;
    const text = `${card.name} advertises ${headline}. My real ${fmt(amount, currency)} ${label.toLowerCase()} swipe on its ${r.base} card: ${outcome} after every fee (${r.net >= 0 ? 'kept' : 'lost'} ${fmt(Math.abs(r.net), shown)}). Receipt:`;
    track('Share', { channel: 'x', what: 'receipt' });
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl())}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="swipe">
      <div className="stack swipe-controls" style={{ gap: 14 }}>
        {cards.length > 1 ? (
          <div className="field">
            <label className="field-label" htmlFor="sw-card">
              Card
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
        {card.tiers.length > 1 ? (
          <div className="field">
            <label className="field-label" htmlFor="sw-tier">
              Tier
            </label>
            <select id="sw-tier" className="select" value={card.tiers.indexOf(tier)} onChange={(e) => setTierIndex(Number(e.target.value))}>
              {card.tiers.map((t, i) => (
                <option key={t.name} value={i}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="chip-row" role="group" aria-label="Quick purchases">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="chip" aria-pressed={label === p.label} onClick={() => pickPreset(p)}>
              {p.label} ${p.usd}
            </button>
          ))}
        </div>
        <div className="swipe-fields">
          <div className="field">
            <label className="field-label" htmlFor="sw-amount">
              Purchase amount
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
              Card&apos;s base currency
            </label>
            <select id="sw-base" className="select" value={r.base} onChange={(e) => setBase(e.target.value)} disabled={bases.list.length < 2}>
              {bases.list.map((c) => (
                <option key={c} value={c}>
                  {c}
                  {!bases.known ? ' (assumed)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="sw-cur">
              Paid in
            </label>
            <select id="sw-cur" className="select" value={currency} onChange={(e) => changeCurrency(e.target.value)}>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                  {c === home ? ' (yours)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="sw-show">
              Show receipt in
            </label>
            <select id="sw-show" className="select" value={shown} onChange={(e) => setDisplay(e.target.value === currency ? null : e.target.value)}>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                  {c === currency ? ' (as paid)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="faint" style={{ fontSize: 12, margin: 0 }}>
          {r.foreign
            ? `Paying in ${currency} on a ${r.base} card is a foreign purchase: the FX fee and any foreign-only fees apply.`
            : `Paying in ${r.base}, the card's own currency: no FX fee.`}
        </p>
        {!perUsd ? (
          <p className="faint" style={{ fontSize: 12, margin: 0 }}>
            Live exchange rates are unavailable right now, so only US dollars are offered.
          </p>
        ) : null}
      </div>

      <figure className="slip" aria-label={`Receipt: ${label} on ${card.name}`}>
        <div className="slip-head">
          <span>[ swipe receipt ]</span>
          <span>{card.name}</span>
        </div>
        <p className="slip-sub">
          {label} · {tier.name} · {r.base} card · paid in {currency}
          {currency !== 'USD' ? ` · ≈ $${r.usd.toFixed(2)}` : ''}
        </p>
        <dl className="slip-lines">
          {r.lines.map((l) => (
            <div key={l.key} className={`slip-line slip-${l.kind}`}>
              <dt>
                {l.kind === 'fee' ? '+ ' : l.kind === 'reward' ? '− ' : ''}
                {l.label}
              </dt>
              <dd>{fmt(l.amount, shown)}</dd>
            </div>
          ))}
        </dl>
        <div className="slip-total">
          <div className="slip-line">
            <dt>Paid at the till</dt>
            <dd>{fmt(r.totalPaid, shown)}</dd>
          </div>
          <div className="slip-line">
            <dt>Real cost after cashback</dt>
            <dd>{fmt(r.totalPaid - r.cashback, shown)}</dd>
          </div>
        </div>
        <div className="slip-result" style={{ color: r.net >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
          <b>
            {r.netPct >= 0 ? '+' : '−'}
            {Math.abs(r.netPct).toFixed(2)}%
          </b>
          <span>{r.net >= 0 ? `You keep ${fmt(r.net, shown)}` : `Costs you ${fmt(-r.net, shown)} more`}</span>
        </div>
        {r.headlinePct != null ? <p className="slip-note">Advertised: up to {r.headlinePct}% back</p> : null}
        {r.notes.length ? <p className="slip-note">{r.notes.join(' · ')}</p> : null}
        <div className="slip-actions">
          <button type="button" className="btn btn-metal btn-sm" onClick={postOnX}>
            Post receipt on X
          </button>
          <a className="btn btn-sm" href={`/receipt/image?${query}`} download={`g2m-receipt-${card.slug}.png`} onClick={() => track('Share', { channel: 'image', what: 'receipt' })}>
            Download image
          </a>
        </div>
      </figure>
    </div>
  );
}
