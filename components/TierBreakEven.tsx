'use client';

import { useMemo, useState } from 'react';
import type { CardRow, Tier } from '@/lib/types';
import { BREAK_EVEN_LIMIT, breakEvens, parseCalcInput, tierValue } from '@/lib/calc';
import { money } from '@/lib/format';
import type { Ui } from '@/lib/i18n/ui/en';

const fillT = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k) => String(v[k] ?? m));

type Props = {
  card: CardRow;
  /** Live USD prices by CoinGecko id. Missing = unavailable. */
  prices: Record<string, number>;
  /** Another language: its card words and BCP 47 tag (for amounts). English when left out. */
  words?: Ui['card'];
  tag?: string;
};

const price = (t: Tier) => (t.feeUsdYear == null ? 'price not published' : t.feeUsdYear ? `${money(t.feeUsdYear)}/yr` : 'free');
const fmtUsd = (n: number) =>
  n >= 100 ? money(n) : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// When does each tier beat the entry tier, and what does a staking tier really put at risk?
export function TierBreakEven({ card, prices, words, tag }: Props) {
  const w = words;
  // Amounts: English keeps "$1,234"; other languages use Intl.
  const intl = useMemo(
    () => (tag ? new Intl.NumberFormat(tag, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }) : null),
    [tag]
  );
  const intl2 = useMemo(
    () => (tag ? new Intl.NumberFormat(tag, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null),
    [tag]
  );
  const M = (n: number) => (intl ? intl.format(n) : money(n));
  const F = (n: number) => (intl ? (n >= 100 ? intl.format(n) : intl2!.format(n)) : fmtUsd(n));
  const priceOf = (t: Tier) =>
    w ? (t.feeUsdYear == null ? w.priceNP : t.feeUsdYear ? fillT(w.pricePerYear, { x: M(t.feeUsdYear) }) : w.priceFree) : price(t);
  const num = (n: number) => (tag ? n.toLocaleString(tag) : n.toLocaleString('en-US'));
  const [spendText, setSpendText] = useState('1000');
  const spend = Math.min(Math.max(Number(spendText) || 0, 0), 1_000_000);
  // Ongoing rates and fees only, all spending in the card's own currency: the tier difference on its own.
  const base = useMemo(() => parseCalcInput({ usd: 0, travel: 0, all: true }), []);
  const pairs = useMemo(() => breakEvens(card, base, null, 'entry'), [card, base]);
  const entry = card.tiers.find((t) => !t.comingSoon) ?? card.tiers[0];
  const entryIndex = card.tiers.indexOf(entry);
  const at = (t: Tier, s: number) => tierValue(card, t, { ...base, spend: s }, card.tiers.indexOf(t)).net;

  const stakes = card.tiers
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.stake && !t.comingSoon)
    .map(({ t, i }) => {
      const stake = t.stake!;
      const p = stake.coingeckoId ? prices[stake.coingeckoId] : undefined;
      const value = p != null && stake.amount != null ? p * stake.amount : null;
      // Extra kept each month on this tier vs the entry tier at the visitor's spend. When the stake replaces the
      // yearly fee ("$199 a year, or lock 20,000 XPL"), staking means not paying that fee.
      const staked = tierValue(card, t, { ...base, spend }, i);
      const kept = staked.net + (t.feeUsdYear ? staked.fee : 0);
      const gain = i === entryIndex ? 0 : (kept - at(entry, spend)) / 12;
      const drop = value != null ? value * 0.25 : null;
      return { t, stake, p, value, gain, drop, months: drop != null && gain > 0 ? drop / gain : null };
    });

  if (pairs.length === 0 && stakes.length === 0) return null;

  return (
    <div className="panel panel-pad stack tier-be" style={{ gap: 14 }}>
      <div className="stack" style={{ gap: 4 }}>
        <span className="field-label">[ {w?.beTag ?? 'tier break-even'} ]</span>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {w ? (
            fillT(w.beLead, { entry: entry.name, price: priceOf(entry) })
          ) : (
            <>
              When a paid tier pays for itself against {entry.name} ({price(entry)}), with its yearly fee and monthly cashback cap
              counted.
            </>
          )}
        </p>
      </div>
      {pairs.length ? (
        <ul className="tier-be-list">
          {pairs.map((p) => {
            const to = `${p.to.tier.name} (${priceOf(p.to.tier)})`;
            const from = `${p.from.tier.name} (${priceOf(p.from.tier)})`;
            const unpriced = p.to.tier.feeUsdYear == null || p.from.tier.feeUsdYear == null;
            return (
              <li key={p.to.tier.name}>
                {unpriced ? (
                  <>
                    <b>{p.to.tier.name}</b>
                    {w ? w.beUnpriced : <>: can&apos;t be worked out, the price is not published.</>}
                  </>
                ) : p.beatsFrom != null && p.beatsFrom <= 1 ? (
                  w ? (
                    <>
                      {fillT(w.beAnySpend, { to, from })}
                      {p.until != null ? fillT(w.beUntil, { x: M(p.until) }) : ''}
                      {p.to.tier.stake ? fillT(w.beIfStake, { token: p.to.tier.stake.token }) : ''}.
                    </>
                  ) : (
                    <>
                      <b>{to}</b> beats {from} at any spend{p.until != null ? `, up to ${money(p.until)} a month` : ''}
                      {p.to.tier.stake ? `, if you hold the ${p.to.tier.stake.token} it needs (below)` : ''}.
                    </>
                  )
                ) : p.beatsFrom == null ? (
                  w ? (
                    <>{fillT(w.beNever, { to, from, x: M(BREAK_EVEN_LIMIT) })}</>
                  ) : (
                    <>
                      <b>{to}</b> never beats {from} (checked up to {money(BREAK_EVEN_LIMIT)} a month).
                    </>
                  )
                ) : w ? (
                  <>
                    {fillT(w.beNeed, { x: M(p.beatsFrom), to, from })}
                    {p.until != null ? fillT(w.beFallsBack, { x: M(p.until) }) : ''}.
                  </>
                ) : (
                  <>
                    You need to spend at least <b>{money(p.beatsFrom)} a month</b> for {to} to beat {from}
                    {p.until != null ? `, and it falls behind again above ${money(p.until)}` : ''}.
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {stakes.length ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="tier-be-stake-head">
            <span className="field-label">[ {w?.stakeTag ?? 'staking check'} ]</span>
            <label className="tier-be-spend">
              <span className="faint">{w?.at ?? 'At'}</span>
              <input
                className="input num"
                inputMode="decimal"
                value={spendText}
                onChange={(e) => setSpendText(e.target.value.replace(/[^\d.]/g, ''))}
                aria-label={w?.spendAria ?? 'Monthly spend in US dollars'}
              />
              <span className="faint">{w?.aMonth ?? 'a month'}</span>
            </label>
          </div>
          <ul className="tier-be-list">
            {stakes.map((s) => (
              <li key={s.t.name}>
                <b>{s.t.name}</b>:{' '}
                {w
                  ? s.stake.amount != null
                    ? fillT(w.hold, { amount: num(s.stake.amount), token: s.stake.token })
                    : fillT(w.holdUnknown, { token: s.stake.token })
                  : `hold ${s.stake.amount != null ? s.stake.amount.toLocaleString('en-US') : 'an unpublished amount of'} ${s.stake.token}`}
                {s.value != null ? (
                  <>
                    {' '}
                    {w ? (
                      fillT(w.stakeToday, { value: F(s.value), token: s.stake.token, price: F(s.p!) })
                    ) : (
                      <>
                        = <b>{fmtUsd(s.value)}</b> today ({s.stake.token} at {fmtUsd(s.p!)}).
                      </>
                    )}{' '}
                    <span className="tier-be-stress">
                      {w ? fillT(w.stakeDrop, { x: F(s.drop!) }) : (
                        <>
                          −25% token drop: <span style={{ whiteSpace: 'nowrap' }}>−{fmtUsd(s.drop!)}</span>.
                        </>
                      )}{' '}
                      {w
                        ? s.months != null
                          ? fillT(w.earnBack, {
                              time: s.months < 1 ? w.underMonth : fillT(w.monthsN, { n: Math.ceil(s.months) }),
                              gain: F(s.gain),
                              entry: entry.name
                            })
                          : fillT(w.neverBack, { entry: entry.name })
                        : s.months != null
                          ? `Earning that back takes ${s.months < 1 ? 'under a month' : `${Math.ceil(s.months)} month${Math.ceil(s.months) === 1 ? '' : 's'}`} of the extra ${fmtUsd(s.gain)} a month this tier keeps you over ${entry.name}.`
                          : `At this spend the tier keeps you no more than ${entry.name}, so the cashback never earns it back.`}
                    </span>
                  </>
                ) : s.stake.amount == null ? (
                  (w?.stakeNP ?? '. The stake amount is not published.')
                ) : (
                  (w?.priceNA ?? '. Live price unavailable right now.')
                )}
              </li>
            ))}
          </ul>
          <p className="faint" style={{ fontSize: 12, margin: 0 }}>
            {w ? (
              w.stakeNote
            ) : (
              <>
                Prices from CoinGecko, updated hourly. A stake is your own money locked up, not a fee, but its value moves with
                the token.
              </>
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
