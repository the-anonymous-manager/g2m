'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardRow, Tier } from '@/lib/types';
import { countryName } from '@/lib/regions';
import { approxUsd } from '@/lib/format';
import { stakeUsd } from '@/lib/calc';
import { currentPreset, parsePick, pickText, presetIndex, tierIndex, tierSlug, type TierPreset } from '@/lib/tierpick';
import { TierPresets } from '@/components/TierPresets';
import { CardArt } from '@/components/CardArt';
import { ROWS, best, cardRows, compareText, type CompareLang } from '@/components/compareRows';
import { OutboundLink } from '@/components/OutboundLink';
import { ShareBar } from '@/components/ShareBar';
import { versusPath } from '@/lib/versus';
import { track } from '@/lib/analytics';
import type { Ui } from '@/lib/i18n/ui/en';
import { compareEn } from '@/lib/i18n/ui/compare/en';
import { fillText, intlFmt } from '@/lib/i18n/clientFormat';

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
const tierRows = (prices: Record<string, number>, lang?: CompareLang): TierRow[] => {
  const w = lang ? lang.ui.compare : compareEn;
  const x = compareText(lang);
  const place = (cc: string) => (cc === 'EEA' ? w.eea : lang ? lang.fmt.country(cc) : countryName(cc));
  const approx = (v: number) =>
    lang
      ? (lang.tag.startsWith('ar') ? (s: string) => `\u2066${s}\u2069` : (s: string) => s)(`~${new Intl.NumberFormat(lang.tag, { style: 'currency', currency: 'USD', maximumFractionDigits: v >= 100 ? 0 : 2, minimumFractionDigits: v >= 100 ? 0 : 2 }).format(v)}`)
      : approxUsd(v);
  return [
    { label: w.rYearly, render: (_c, t) => x.price(t), value: (_c, t) => t.feeUsdYear, better: 'low' },
    { label: w.rTierCb, render: (_c, t) => x.tierCb(t), value: (_c, t) => firstRate(t), better: 'high' },
    { label: w.rCap, render: (_c, t) => (t.capMonthlyUsd != null ? fillText(w.capMonth, { x: x.usd(t.capMonthlyUsd) }) : w.noneCap) },
    { label: w.rTierFx, render: (c, t) => x.pct(t.fxPct ?? c.fees.fxPct), value: (c, t) => t.fxPct ?? c.fees.fxPct, better: 'low' },
    { label: w.rQualify, render: (_c, t) => t.requirement ?? (t.stake ? '—' : w.openAll) },
    {
      label: w.rStake,
      render: (_c, t) => {
        if (!t.stake) return w.noStake;
        const v = stakeUsd(t, prices);
        const amount = t.stake.amount != null ? x.count(t.stake.amount) : w.someAmount;
        return `${amount} ${t.stake.token}${v != null ? ` (${approx(v)})` : ''}`;
      }
    },
    { label: w.rTierPerks, render: (_c, t) => (t.perks.length ? t.perks.join(' · ') : '—') },
    {
      label: w.rOffered,
      render: (_c, t) =>
        t.countries ? t.countries.map(place).join(', ') : t.exceptCountries ? fillText(w.everywhereBut, { list: t.exceptCountries.join(', ') }) : w.whereverCard
    }
  ];
};

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

/**
 * The compare tool. English by default; `ui`, `tag`, `prefix` and `countryNames` give another language (words from
 * lib/i18n/ui, numbers from Intl, links inside that language), as on /de/compare.
 */
export function CompareClient({
  rows,
  initial,
  prices,
  ui,
  tag,
  prefix = '',
  countryNames
}: {
  rows: CardRow[];
  initial: string[];
  prices: Record<string, number>;
  ui?: Ui;
  tag?: string;
  prefix?: string;
  countryNames?: Record<string, string>;
}) {
  const lang = useMemo<CompareLang | undefined>(() => (ui && tag ? { ui, tag, fmt: intlFmt(tag, ui, countryNames) } : undefined), [ui, tag, countryNames]);
  const w = ui ? ui.compare : compareEn;
  const x = compareText(lang);
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
  const TIER_ROWS = useMemo(() => tierRows(prices, lang), [prices, lang]);
  const CARD_ROWS = useMemo(() => (lang ? cardRows(lang) : ROWS), [lang]);

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
  // Pages not translated yet (the calculator) open in English.

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="panel panel-pad stack" style={{ gap: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
          {pickers.map((i) => {
            const s = slots[i];
            return (
              <div className="field" key={i} style={{ flex: '1 1 200px' }}>
                <label className="field-label" htmlFor={`slot-${i}`}>
                  {fillText(w.cardN, { n: i + 1 })}
                </label>
                <select id={`slot-${i}`} className="select" value={s?.card.slug ?? ''} onChange={(e) => setSlot(i, e.target.value)}>
                  <option value="">{s ? w.removeCard : w.addCard}</option>
                  {rows.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {s ? (
                  <>
                    <label className="sr-only" htmlFor={`slot-tier-${i}`}>
                      {fillText(w.tierOf, { name: s.card.name })}
                    </label>
                    <select
                      id={`slot-tier-${i}`}
                      className="select"
                      value={s.tier == null ? '' : String(s.tier)}
                      onChange={(e) => setTier(i, e.target.value === '' ? null : Number(e.target.value))}
                    >
                      <option value="">{s.card.tiers.length === 1 ? w.overviewOne : fillText(w.overviewN, { n: s.card.tiers.length })}</option>
                      {s.card.tiers.map((t, k) => (
                        <option key={t.name} value={k}>
                          {`${t.name} · ${x.price(t)}${t.comingSoon ? ` · ${w.comingSoon}` : ''}`}
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
            <span className="field-label">{w.sideBySide}</span>
            <div>
              <button type="button" className="btn btn-sm" style={{ whiteSpace: 'normal', height: 'auto', textAlign: 'start', maxWidth: '100%' }} onClick={() => lineUpTiers(tiersOf)}>
                {fillText(tiersOf.tiers.length > SLOTS ? w.lineUpSome : w.lineUpAll, {
                  k: SLOTS,
                  n: tiersOf.tiers.length,
                  names: tiersOf.tiers
                    .slice(0, SLOTS)
                    .map((t) => t.name)
                    .join(' · ')
                })}
              </button>
            </div>
          </div>
        ) : null}
        {sameCard ? (
          <p className="faint" style={{ fontSize: 13, margin: 0 }}>
            {fillText(w.sameCard, { name: slots[0].card.name })}
          </p>
        ) : (
          <TierPresets
            cards={chosen}
            value={preset}
            onPick={applyPreset}
            allLabel={w.overview}
            words={ui ? { heading: w.tiersToCompare, all: w.presetAll, entry: w.presetEntry, next: w.presetNext, top: w.presetTop } : undefined}
          />
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          {chosen.length >= 1 ? (
            <Link href={`${prefix}/calculator?mode=tiers&cards=${slots.map(entryOf).join(',')}`} className="btn btn-sm">
              {chosen.length > 1 ? w.keepsMany : w.keepsOne}
            </Link>
          ) : null}
          {chosen.length === 2 && chosen[0].slug !== chosen[1].slug ? (
            <Link href={`${prefix}${versusPath(chosen[0].slug, chosen[1].slug)}`} className="btn btn-sm">
              {fillText(w.fullVs, { a: chosen[0].brand, b: chosen[1].brand })}
            </Link>
          ) : null}
          {chosen.length >= 2 ? (
            <ShareBar text={fillText(w.shareText, { names: slots.map(shareName).join(w.vs) })} words={ui ? ui.common : undefined} />
          ) : null}
        </div>
      </div>

      {chosen.length === 0 ? (
        <p className="muted">{w.pickToStart}</p>
      ) : (
        <div className="table-wrap">
          <div
            role="table"
            aria-label={w.tableLabel}
            className="cmp-table"
            style={{ minWidth: 170 + chosen.length * 220, ['--cmp-n' as string]: Math.max(chosen.length, 1) }}
          >
            <div role="row" className="cmp-row cmp-head" style={{ gridTemplateColumns: columns }}>
              <div role="columnheader" className="cmp-label">
                <span className="sr-only">{w.detail}</span>
              </div>
              {slots.map(({ card: c, tier }, i) => (
                <div role="columnheader" key={i} className="cmp-cell stack" style={{ gap: 12 }}>
                  <CardArt card={c} width={150} />
                  <Link href={`${prefix}/cards/${c.slug}`} style={{ fontWeight: 700, fontSize: 17, textDecoration: 'none' }}>
                    {c.name}
                  </Link>
                  {tier != null ? (
                    <span className="badge badge-accent" style={{ alignSelf: 'flex-start' }}>
                      {`${c.tiers[tier].name} · ${x.price(c.tiers[tier])}`}
                    </span>
                  ) : (
                    <span className="faint" style={{ fontSize: 14 }}>
                      {fillText(w.cbBack, { cb: x.range(c.cashback.basePct, c.cashback.maxPct) })}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {anyTier ? (
              <>
                <div role="row" className="cmp-row cmp-section" style={{ gridTemplateColumns: columns }}>
                  <div role="rowheader" className="cmp-label">
                    {w.tierPicked}
                  </div>
                  {slots.map(({ card: c, tier }, i) => (
                    <div role="cell" key={i} className="cmp-cell">
                      {tier != null ? <b>{c.tiers[tier].name}</b> : <span className="faint">{w.pickTier}</span>}
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
                          {winners.has(i) ? <span className="sr-only">{w.best}</span> : null}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {sameCard ? null : (
                <div role="row" className="cmp-row cmp-section" style={{ gridTemplateColumns: columns }}>
                  <div role="rowheader" className="cmp-label">
                    {w.theCard}
                  </div>
                  {slots.map((_, i) => (
                    <div role="cell" key={i} className="cmp-cell faint">
                      {w.everyTier}
                    </div>
                  ))}
                </div>
                )}
              </>
            ) : null}
            {sameCard ? null : CARD_ROWS.map((row) => {
              const winners = best(chosen, row);
              return (
                <div role="row" key={row.label} className="cmp-row" style={{ gridTemplateColumns: columns }}>
                  <div role="rowheader" className="cmp-label">
                    {row.label}
                  </div>
                  {chosen.map((c, i) => (
                    <div role="cell" key={i} className={`cmp-cell ${winners.has(c.slug) ? 'cmp-best' : ''}`}>
                      {row.render(c)}
                      {winners.has(c.slug) ? <span className="sr-only">{w.best}</span> : null}
                    </div>
                  ))}
                </div>
              );
            })}
            <div role="row" className="cmp-row" style={{ gridTemplateColumns: columns }}>
              <div role="rowheader" className="cmp-label">
                <span className="sr-only">{w.apply}</span>
              </div>
              {chosen.map((c, i) => (
                <div role="cell" key={i} className="cmp-cell">
                  <OutboundLink slug={c.slug} name={c.brand} placement="compare" className="btn btn-metal btn-sm">
                    {fillText(w.getBrand, { brand: c.brand })}
                  </OutboundLink>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <p className="faint" style={{ fontSize: 13 }}>
        {w.footnote}
      </p>
    </div>
  );
}
