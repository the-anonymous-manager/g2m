'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardRow, Tier } from '@/lib/types';
import { countryName } from '@/lib/regions';
import { approxUsd, cashbackLabel, pct, tierCashback, usd } from '@/lib/format';
import { stakeUsd } from '@/lib/calc';
import { currentPreset, parsePick, pickText, presetIndex, tierIndex, tierPrice, tierSlug, type TierPreset } from '@/lib/tierpick';
import { TierPresets } from '@/components/TierPresets';
import { CardArt } from '@/components/CardArt';
import { ROWS, best } from '@/components/compareRows';
import { OutboundLink } from '@/components/OutboundLink';
import { ShareBar } from '@/components/ShareBar';
import { versusPath } from '@/lib/versus';
import { track } from '@/lib/analytics';

const SLOTS = 3;

type Slot = { card: CardRow; tier: number | null };
type TierRow = {
  label: string;
  render: (c: CardRow, t: Tier) => React.ReactNode;
  value?: (c: CardRow, t: Tier) => number | null;
  better?: 'high' | 'low';
};

const firstRate = (t: Tier) => t.cashbackPct ?? t.bands?.[0]?.pct ?? null;

/** Rows about the tier picked for each card (shown once at least one card has a tier picked). */
const tierRows = (prices: Record<string, number>): TierRow[] => [
  { label: 'Yearly price', render: (_c, t) => tierPrice(t), value: (_c, t) => t.feeUsdYear, better: 'low' },
  { label: 'Cashback on this tier', render: (_c, t) => tierCashback(t), value: (_c, t) => firstRate(t), better: 'high' },
  { label: 'Monthly cashback cap', render: (_c, t) => (t.capMonthlyUsd != null ? `${usd(t.capMonthlyUsd)} a month` : 'None published') },
  { label: 'FX fee on this tier', render: (c, t) => pct(t.fxPct ?? c.fees.fxPct), value: (c, t) => t.fxPct ?? c.fees.fxPct, better: 'low' },
  { label: 'To qualify', render: (_c, t) => t.requirement ?? (t.stake ? '—' : 'Open to everyone') },
  {
    label: 'Stake value today',
    render: (_c, t) => {
      if (!t.stake) return 'No stake';
      const v = stakeUsd(t, prices);
      const amount = t.stake.amount != null ? t.stake.amount.toLocaleString('en-US') : 'Some';
      return `${amount} ${t.stake.token}${v != null ? ` (${approxUsd(v)})` : ''}`;
    }
  },
  { label: 'Tier perks', render: (_c, t) => (t.perks.length ? t.perks.join(' · ') : '—') },
  {
    label: 'Offered in',
    render: (_c, t) =>
      t.countries ? t.countries.map((cc) => (cc === 'EEA' ? 'EEA' : countryName(cc))).join(', ') : t.exceptCountries ? `Everywhere but ${t.exceptCountries.join(', ')}` : 'Wherever the card is'
  }
];

/** The slots (by position) with the best value in a tier row. */
function bestTier(slots: Slot[], row: TierRow): Set<number> {
  if (!row.value || !row.better) return new Set();
  const vals = slots
    .map((s, i) => ({ i, v: s.tier == null ? null : row.value!(s.card, s.card.tiers[s.tier]) }))
    .filter((x): x is { i: number; v: number } => x.v != null);
  if (vals.length < 2) return new Set();
  const target = row.better === 'high' ? Math.max(...vals.map((x) => x.v)) : Math.min(...vals.map((x) => x.v));
  if (vals.every((x) => x.v === target)) return new Set();
  return new Set(vals.filter((x) => x.v === target).map((x) => x.i));
}

const entryOf = (s: Slot) => pickText({ slug: s.card.slug, tier: s.tier == null ? null : tierSlug(s.card.tiers[s.tier].name) });

export function CompareClient({ rows, initial, prices }: { rows: CardRow[]; initial: string[]; prices: Record<string, number> }) {
  const [slots, setSlotsState] = useState<Slot[]>(() => {
    const seen = new Set<string>();
    const valid = initial
      .map(parsePick)
      .map((p) => {
        const card = rows.find((r) => r.slug === p.slug);
        if (!card) return null;
        const slot = { card, tier: tierIndex(card, p.tier) };
        if (seen.has(entryOf(slot))) return null;
        seen.add(entryOf(slot));
        return slot;
      })
      .filter((s): s is Slot => Boolean(s))
      .slice(0, SLOTS);
    return valid.length ? valid : rows.slice(0, 2).map((card) => ({ card, tier: null }));
  });
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const url = `${window.location.pathname}${slots.length ? `?c=${slots.map(entryOf).join(',')}` : ''}`;
    window.history.replaceState(window.history.state, '', url);
  }, [slots]);

  // Which cards people compare, once the choice settles (also the set a link opened with).
  const compared = slots.map(entryOf).join(',');
  useEffect(() => {
    if (slots.length < 2) return;
    const t = setTimeout(() => track('Compare', { cards: compared, n: slots.length }), 1500);
    return () => clearTimeout(t);
  }, [compared]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = slots.map((s) => s.card);
  const preset = currentPreset(slots);
  const anyTier = slots.some((s) => s.tier != null);
  const TIER_ROWS = useMemo(() => tierRows(prices), [prices]);

  const setSlot = (i: number, slug: string) => {
    setSlotsState((prev) => {
      const next = [...prev];
      const card = rows.find((r) => r.slug === slug);
      if (!card) next.splice(i, 1);
      else {
        // The same card again: its first tier not on screen yet, so you can line up its tiers.
        const taken = new Set(next.filter((x, j) => j !== i && x.card.slug === card.slug).map((x) => x.tier));
        const free = card.tiers.findIndex((_, k) => !taken.has(k));
        // A new card follows the tier choice of the others ("Next tier up" stays next tier up).
        next[i] = { card, tier: taken.size ? (free >= 0 ? free : null) : preset ? presetIndex(card, preset) : null };
      }
      const seen = new Set<string>();
      return next.filter((s) => !seen.has(entryOf(s)) && Boolean(seen.add(entryOf(s))));
    });
  };
  const setTier = (i: number, tier: number | null) => setSlotsState((prev) => prev.map((s, j) => (j === i ? { ...s, tier } : s)));
  const applyPreset = (p: TierPreset) => setSlotsState((prev) => prev.map((s) => ({ ...s, tier: presetIndex(s.card, p) })));
  // One card's tiers side by side: up to three of them, entry tier first.
  const lineUpTiers = (card: CardRow) => setSlotsState(card.tiers.slice(0, SLOTS).map((_, k) => ({ card, tier: k })));
  const sameCard = slots.length > 1 && slots.every((s) => s.card.slug === slots[0].card.slug);
  const tiersOf = slots.length === 1 && slots[0].card.tiers.length > 1 ? slots[0].card : null;

  const pickers = Array.from({ length: Math.min(SLOTS, chosen.length + 1) }, (_, i) => i);
  const columns = `minmax(130px, 170px) repeat(${Math.max(chosen.length, 1)}, minmax(210px, 1fr))`;
  const shareName = (s: Slot) => (s.tier == null ? s.card.brand : `${s.card.brand} ${s.card.tiers[s.tier].name}`);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="panel panel-pad stack" style={{ gap: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
          {pickers.map((i) => {
            const s = slots[i];
            return (
              <div className="field" key={i} style={{ flex: '1 1 200px' }}>
                <label className="field-label" htmlFor={`slot-${i}`}>
                  Card {i + 1}
                </label>
                <select id={`slot-${i}`} className="select" value={s?.card.slug ?? ''} onChange={(e) => setSlot(i, e.target.value)}>
                  <option value="">{s ? 'Remove this card' : 'Add a card'}</option>
                  {rows.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {s ? (
                  <>
                    <label className="sr-only" htmlFor={`slot-tier-${i}`}>
                      {s.card.name} tier
                    </label>
                    <select
                      id={`slot-tier-${i}`}
                      className="select"
                      value={s.tier == null ? '' : String(s.tier)}
                      onChange={(e) => setTier(i, e.target.value === '' ? null : Number(e.target.value))}
                    >
                      <option value="">Card overview ({s.card.tiers.length} {s.card.tiers.length === 1 ? 'tier' : 'tiers'})</option>
                      {s.card.tiers.map((t, k) => (
                        <option key={t.name} value={k}>
                          {t.name} · {tierPrice(t)}
                          {t.comingSoon ? ' · coming soon' : ''}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
        {tiersOf ? (
          <div className="stack" style={{ gap: 8 }}>
            <span className="field-label">Tiers side by side</span>
            <div>
              <button type="button" className="btn btn-sm" onClick={() => lineUpTiers(tiersOf)}>
                Compare {tiersOf.tiers.length > SLOTS ? `${SLOTS} of its ${tiersOf.tiers.length}` : `its ${tiersOf.tiers.length}`} tiers side
                by side: {tiersOf.tiers.slice(0, SLOTS).map((t) => t.name).join(' · ')}
              </button>
            </div>
          </div>
        ) : null}
        {sameCard ? (
          <p className="faint" style={{ fontSize: 13, margin: 0 }}>
            {slots[0].card.name}, tier by tier. Change a tier above, or pick another card in any slot.
          </p>
        ) : (
          <TierPresets cards={chosen} value={preset} onPick={applyPreset} allLabel="Card overview" />
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          {chosen.length >= 1 ? (
            <Link href={`/calculator?mode=tiers&cards=${slots.map(entryOf).join(',')}`} className="btn btn-sm">
              What {chosen.length > 1 ? 'these keep' : 'this keeps'} you a year →
            </Link>
          ) : null}
          {chosen.length === 2 && chosen[0].slug !== chosen[1].slug ? (
            <Link href={versusPath(chosen[0].slug, chosen[1].slug)} className="btn btn-sm">
              Full {chosen[0].brand} vs {chosen[1].brand} page
            </Link>
          ) : null}
          {chosen.length >= 2 ? <ShareBar text={`${slots.map(shareName).join(' vs ')}: crypto cards compared on G2M`} /> : null}
        </div>
      </div>

      {chosen.length === 0 ? (
        <p className="muted">Pick a card above to start comparing.</p>
      ) : (
        <div className="table-wrap">
          <div
            role="table"
            aria-label="Card comparison"
            className="cmp-table"
            style={{ minWidth: 170 + chosen.length * 220, ['--cmp-n' as string]: Math.max(chosen.length, 1) }}
          >
            <div role="row" className="cmp-row cmp-head" style={{ gridTemplateColumns: columns }}>
              <div role="columnheader" className="cmp-label">
                <span className="sr-only">Detail</span>
              </div>
              {slots.map(({ card: c, tier }, i) => (
                <div role="columnheader" key={i} className="cmp-cell stack" style={{ gap: 12 }}>
                  <CardArt card={c} width={150} />
                  <Link href={`/cards/${c.slug}`} style={{ fontWeight: 700, fontSize: 17, textDecoration: 'none' }}>
                    {c.name}
                  </Link>
                  {tier != null ? (
                    <span className="badge badge-accent" style={{ alignSelf: 'flex-start' }}>
                      {c.tiers[tier].name} · {tierPrice(c.tiers[tier])}
                    </span>
                  ) : (
                    <span className="faint" style={{ fontSize: 14 }}>
                      {cashbackLabel(c.cashback.basePct, c.cashback.maxPct)} back
                    </span>
                  )}
                </div>
              ))}
            </div>
            {anyTier ? (
              <>
                <div role="row" className="cmp-row cmp-section" style={{ gridTemplateColumns: columns }}>
                  <div role="rowheader" className="cmp-label">
                    The tier picked
                  </div>
                  {slots.map(({ card: c, tier }, i) => (
                    <div role="cell" key={i} className="cmp-cell">
                      {tier != null ? <b>{c.tiers[tier].name}</b> : <span className="faint">Pick a tier above</span>}
                    </div>
                  ))}
                </div>
                {TIER_ROWS.map((row) => {
                  const winners = bestTier(slots, row);
                  return (
                    <div role="row" key={row.label} className="cmp-row" style={{ gridTemplateColumns: columns }}>
                      <div role="rowheader" className="cmp-label">
                        {row.label}
                      </div>
                      {slots.map(({ card: c, tier }, i) => (
                        <div role="cell" key={i} className={`cmp-cell ${winners.has(i) ? 'cmp-best' : ''}`}>
                          {tier != null ? row.render(c, c.tiers[tier]) : <span className="faint">—</span>}
                          {winners.has(i) ? <span className="sr-only"> (best)</span> : null}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {sameCard ? null : (
                <div role="row" className="cmp-row cmp-section" style={{ gridTemplateColumns: columns }}>
                  <div role="rowheader" className="cmp-label">
                    The card
                  </div>
                  {slots.map((_, i) => (
                    <div role="cell" key={i} className="cmp-cell faint">
                      Every tier
                    </div>
                  ))}
                </div>
                )}
              </>
            ) : null}
            {sameCard ? null : ROWS.map((row) => {
              const winners = best(chosen, row);
              return (
                <div role="row" key={row.label} className="cmp-row" style={{ gridTemplateColumns: columns }}>
                  <div role="rowheader" className="cmp-label">
                    {row.label}
                  </div>
                  {chosen.map((c, i) => (
                    <div role="cell" key={i} className={`cmp-cell ${winners.has(c.slug) ? 'cmp-best' : ''}`}>
                      {row.render(c)}
                      {winners.has(c.slug) ? <span className="sr-only"> (best)</span> : null}
                    </div>
                  ))}
                </div>
              );
            })}
            <div role="row" className="cmp-row" style={{ gridTemplateColumns: columns }}>
              <div role="rowheader" className="cmp-label">
                <span className="sr-only">Apply</span>
              </div>
              {chosen.map((c, i) => (
                <div role="cell" key={i} className="cmp-cell">
                  <OutboundLink slug={c.slug} name={c.brand} placement="compare" className="btn btn-metal btn-sm">
                    Get {c.brand}
                  </OutboundLink>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <p className="faint" style={{ fontSize: 13 }}>
        Highlighted values are the best among the cards shown. “Not published” means the issuer does not state it. Stake
        values use today&apos;s token price.
      </p>
    </div>
  );
}
