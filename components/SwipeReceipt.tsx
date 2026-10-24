'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardRow } from '@/lib/types';
import { swipeReceipt } from '@/lib/swipe';
import { currencyOf } from '@/lib/currencies.mjs';
import { useRegion } from '@/components/RegionContext';
import { track } from '@/lib/analytics';
import { site } from '@/lib/site';

type Props = {
  /** One card (card page) or several to pick from (calculator). */
  cards: CardRow[];
  initialSlug?: string;
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
export function SwipeReceipt({ cards, initialSlug, perUsd }: Props) {
  const { country } = useRegion();
  const home = currencyOf(country);
  const currencies = useMemo(() => {
    const ok = (c: string) => c === 'USD' || Boolean(perUsd?.[c]);
    const list = COMMON.filter(ok);
    if (home && ok(home) && !list.includes(home)) list.unshift(home);
    return list;
  }, [perUsd, home]);

  const [slug, setSlug] = useState(initialSlug ?? cards[0]?.slug);
  const card = cards.find((c) => c.slug === slug) ?? cards[0];
  const [tierIndex, setTierIndex] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [amountText, setAmountText] = useState('10');
  const [label, setLabel] = useState('Coffee');
  const touched = useRef(false);

  // Follow the card the page is showing (calculator) and start in the visitor's own currency.
  useEffect(() => {
    if (initialSlug) setSlug(initialSlug);
  }, [initialSlug]);
  useEffect(() => {
    // A shared link sets the receipt: ?amt=840&cur=INR&tier=0&what=Coffee
    const p = new URLSearchParams(window.location.search);
    const cur = p.get('cur')?.toUpperCase();
    if (cur && currencies.includes(cur)) {
      touched.current = true;
      setCurrency(cur);
      if (p.get('amt')) setAmountText(p.get('amt')!.replace(/[^\d.]/g, ''));
      if (p.get('what')) setLabel(p.get('what')!.slice(0, 40));
      const t = Number(p.get('tier'));
      if (Number.isInteger(t) && t >= 0) setTierIndex(t);
      return;
    }
    if (home && currencies.includes(home) && !touched.current) {
      setCurrency(home);
      const rate = home === 'USD' ? 1 : perUsd?.[home] ?? 1;
      setAmountText(String(niceAmount(10 * rate)));
    }
    // Run once rates and the visitor's country are known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, currencies.length]);

  if (!card) return null;
  const tier = card.tiers[Math.min(tierIndex, card.tiers.length - 1)];
  const amount = Math.min(Math.max(Number(amountText) || 0, 0), 1_000_000);
  const r = swipeReceipt(card, tier, amount, currency, perUsd ?? {}, home);
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

  const shareUrl = () => {
    const p = new URLSearchParams({ amt: String(amount), cur: currency, tier: String(card.tiers.indexOf(tier)), what: label });
    // The card's own page shows the same receipt from these settings.
    return `${site.url}/cards/${card.slug}?${p.toString()}#receipt`;
  };
  const postOnX = () => {
    const headline = r.headlinePct != null ? `"up to ${r.headlinePct}% back"` : 'its rewards';
    const outcome = `${r.netPct >= 0 ? '+' : '−'}${Math.abs(r.netPct).toFixed(2)}%`;
    const text = `${card.name} advertises ${headline}. My real ${fmt(amount, currency)} ${label.toLowerCase()} swipe: ${outcome} after every fee (${r.net >= 0 ? 'kept' : 'lost'} ${fmt(Math.abs(r.net), currency)}). Receipt:`;
    track('Share', { channel: 'x', what: 'receipt' });
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl())}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="swipe">
      <div className="stack swipe-controls" style={{ gap: 14 }}>
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
          <div className="field">
            <label className="field-label" htmlFor="sw-cur">
              Currency
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
        </div>
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
          {label} · {tier.name}
          {currency !== 'USD' ? ` · ≈ $${r.usd.toFixed(2)}` : ''}
        </p>
        <dl className="slip-lines">
          {r.lines.map((l) => (
            <div key={l.key} className={`slip-line slip-${l.kind}`}>
              <dt>
                {l.kind === 'fee' ? '+ ' : l.kind === 'reward' ? '− ' : ''}
                {l.label}
              </dt>
              <dd>{fmt(l.amount, currency)}</dd>
            </div>
          ))}
        </dl>
        <div className="slip-total">
          <div className="slip-line">
            <dt>Paid at the till</dt>
            <dd>{fmt(r.totalPaid, currency)}</dd>
          </div>
          <div className="slip-line">
            <dt>Real cost after cashback</dt>
            <dd>{fmt(r.totalPaid - r.cashback, currency)}</dd>
          </div>
        </div>
        <div className="slip-result" style={{ color: r.net >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
          <b>
            {r.netPct >= 0 ? '+' : '−'}
            {Math.abs(r.netPct).toFixed(2)}%
          </b>
          <span>{r.net >= 0 ? `You keep ${fmt(r.net, currency)}` : `Costs you ${fmt(-r.net, currency)} more`}</span>
        </div>
        {r.headlinePct != null ? <p className="slip-note">Advertised: up to {r.headlinePct}% back</p> : null}
        {r.notes.length ? <p className="slip-note">{r.notes.join(' · ')}</p> : null}
        <button type="button" className="btn btn-metal btn-sm slip-share" onClick={postOnX}>
          Post receipt on X
        </button>
      </figure>
    </div>
  );
}
