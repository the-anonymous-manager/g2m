'use client';

import { useMemo, useState } from 'react';
import type { CardRow, Tier } from '@/lib/types';
import { BREAK_EVEN_LIMIT, hasRate, tierMonth, tierPayoffs, type TierPayoff } from '@/lib/calc';
import { money } from '@/lib/format';
import type { Ui } from '@/lib/i18n/ui/en';

const fillT = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k) => String(v[k] ?? m));

type Props = {
  card: CardRow;
  /** Live USD prices by CoinGecko id. Missing = unavailable. */
  prices: Record<string, number>;
  /** The card page's words in the page's language (English included). */
  words: Ui['card'];
  /** BCP 47 tag for amounts in another language. English ("$1,234") when left out. */
  tag?: string;
  /** Tier names and requirements in the page's language, by tier index. English when left out. */
  names?: string[];
  needs?: (string | null)[];
};

/**
 * "Which tier pays off?" on the card page: every tier against its starting tier at the visitor's monthly spend and
 * share of spending in other currencies, with cashback (bands and cap), the yearly fee, the tier's FX fee and the
 * card's other fees counted, the spend from which it pays off (a stated minimum spend included), and what else the
 * tier asks for marked under its name. A token stake gets its live value and a 25% drop test below.
 */
export function TierBreakEven({ card, prices, words: w, tag, names, needs }: Props) {
  const intl = useMemo(
    () => (tag ? new Intl.NumberFormat(tag, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }) : null),
    [tag]
  );
  const intl2 = useMemo(
    () => (tag ? new Intl.NumberFormat(tag, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null),
    [tag]
  );
  /** Whole dollars (spend levels). */
  const M = (n: number) => (intl ? intl.format(n) : money(n));
  /** Monthly amounts: cents under $100. */
  const F = (n: number): string => {
    if (n <= -0.005) return `−${F(-n)}`;
    const a = Math.abs(n);
    if (intl) return a >= 1000 ? intl.format(a) : intl2!.format(a);
    return a >= 1000 ? money(a) : `$${a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const signed = (n: number) => (Math.abs(n) < 0.005 ? F(0) : `${n > 0 ? '+' : '−'}${F(Math.abs(n))}`);
  const num = (n: number) => (tag ? n.toLocaleString(tag) : n.toLocaleString('en-US'));
  const name = (i: number) => names?.[i] ?? card.tiers[i].name;
  const need = (i: number, p: TierPayoff) => (p.condition ? (needs?.[i] ?? p.condition) : null);

  const [spendText, setSpendText] = useState('1000');
  const [abroadText, setAbroadText] = useState('20');
  const spend = Math.min(Math.max(Number(spendText) || 0, 0), 1_000_000);
  const abroad = Math.min(Math.max(Number(abroadText) || 0, 0), 100);

  // Pay-off points depend on the share abroad only; the monthly figures on both inputs.
  const payoffs = useMemo(() => tierPayoffs(card, abroad), [card, abroad]);
  const months = useMemo(() => {
    const m = new Map<number, ReturnType<typeof tierMonth>>();
    for (const i of payoffs.keys()) m.set(i, tierMonth(card, i, spend, abroad));
    return m;
  }, [card, payoffs, spend, abroad]);

  const rows = [...payoffs.entries()];
  const showOther = rows.some(([i]) => (months.get(i)?.other ?? 0) >= 0.005);
  const entries = [...new Set(rows.map(([, p]) => p.entry))];
  // The entry tier named in the lead: the first group's (a second line-up, e.g. US tiers, has its own row marked).
  const leadEntry = entries[0];

  const stakes = card.tiers
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.stake && !t.comingSoon)
    .map(({ t, i }) => {
      const stake = t.stake!;
      const p = stake.coingeckoId ? prices[stake.coingeckoId] : undefined;
      const value = p != null && stake.amount != null ? p * stake.amount : null;
      // Extra kept each month on this tier vs its starting tier. When the stake replaces the yearly fee ("$199 a
      // year, or lock 20,000 XPL"), staking means not paying that fee.
      const pay = payoffs.get(i);
      const entry = pay?.entry ?? card.tiers.findIndex((x) => !x.comingSoon);
      const mine = tierMonth(card, i, spend, abroad);
      const base = tierMonth(card, entry, spend, abroad);
      const short = pay?.minSpend != null && spend < pay.minSpend;
      const gain = i === entry || short || pay?.noRate ? 0 : mine.net + (t.feeUsdYear ? mine.fee : 0) - base.net;
      const drop = value != null ? value * 0.25 : null;
      return { t, i, entry, stake, p, value, gain, drop, months: drop != null && gain > 0 ? drop / gain : null };
    });

  if (rows.length === 0 && stakes.length === 0) return null;

  const paysOff = (i: number, p: TierPayoff) => {
    if (i === p.entry) return <span className="faint">{w.beBase}</span>;
    if (p.unpriced) return <span className="faint">{w.priceNP}</span>;
    if (p.noRate) return <span className="faint">{w.beNoRate}</span>;
    if (p.from == null) return <span className="tier-be-never">{fillT(w.beNever, { x: M(BREAK_EVEN_LIMIT) })}</span>;
    const text =
      p.from <= 1
        ? p.until != null
          ? fillT(w.beUpTo, { y: M(p.until) })
          : w.beAny
        : p.until != null
          ? fillT(w.beRange, { x: M(p.from), y: M(p.until) })
          : fillT(w.beFrom, { x: M(p.from) });
    return <b className="tier-be-pays">{text}</b>;
  };

  return (
    <div className="panel tier-be">
      <div className="tier-be-head">
        <span className="field-label">[ {w.beTag} ]</span>
        <h3 className="tier-be-title">{w.beTitle}</h3>
        {leadEntry != null ? (
          <p className="muted" style={{ margin: 0 }}>
            {fillT(w.beLead, { entry: name(leadEntry) })}
          </p>
        ) : null}
        <div className="tier-be-inputs">
          <label className="tier-be-field">
            <span>{w.beSpend}</span>
            <span className="tier-be-input">
              <span className="faint">$</span>
              <input
                className="input num"
                inputMode="decimal"
                value={spendText}
                onChange={(e) => setSpendText(e.target.value.replace(/[^\d.]/g, ''))}
                aria-label={w.spendAria}
              />
              <span className="faint">{w.aMonth}</span>
            </span>
          </label>
          <label className="tier-be-field">
            <span>{w.beAbroad}</span>
            <span className="tier-be-input">
              <input
                className="input num"
                inputMode="numeric"
                value={abroadText}
                onChange={(e) => setAbroadText(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                aria-label={w.beAbroadAria}
                style={{ width: 72 }}
              />
              <span className="faint">%</span>
            </span>
          </label>
        </div>
      </div>

      {rows.length ? (
        <div className="table-wrap stack-wrap">
          <table className="table stack-table tier-be-table">
            <thead>
              <tr>
                <th scope="col">{w.tier}</th>
                <th scope="col">{w.cashback}</th>
                <th scope="col">{w.beFx}</th>
                <th scope="col">{w.bePlan}</th>
                {showOther ? <th scope="col">{w.beOther}</th> : null}
                <th scope="col">{w.beKeep}</th>
                <th scope="col">{fillT(w.beVs, { entry: name(leadEntry) })}</th>
                <th scope="col">{w.bePays}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([i, p]) => {
                const m = months.get(i)!;
                const base = months.get(p.entry)!;
                const short = p.minSpend != null && spend < p.minSpend;
                const gain = m.net - base.net;
                const cond = need(i, p);
                const t: Tier = card.tiers[i];
                const isEntry = i === p.entry;
                return (
                  <tr key={t.name} className={isEntry ? 'tier-be-entry' : undefined}>
                    <td className="tier-be-name">
                      <b>{name(i)}</b>
                      {isEntry && p.entry !== leadEntry ? <span className="faint tier-be-sub">{w.beBase}</span> : null}
                      {cond ? (
                        <span className="tier-be-need">
                          <span className="tier-be-need-tag">{w.beNeeds}</span> {cond}
                        </span>
                      ) : null}
                      {t.stake && t.feeUsdYear ? (
                        <span className="faint tier-be-sub">
                          {fillT(w.beOrStake, { amount: t.stake.amount != null ? num(t.stake.amount) : '?', token: t.stake.token })}
                        </span>
                      ) : null}
                    </td>
                    <td className="num" data-label={w.cashback}>
                      {hasRate(t) ? F(m.cashback) : <span className="faint">{w.beNoRate}</span>}
                    </td>
                    <td className="num" data-label={w.beFx}>
                      {m.fx >= 0.005 ? `−${F(m.fx)}` : F(0)}
                    </td>
                    <td className="num" data-label={w.bePlan}>
                      {t.feeUsdYear == null ? <span className="faint">{w.priceNP}</span> : m.fee >= 0.005 ? `−${F(m.fee)}` : F(0)}
                    </td>
                    {showOther ? (
                      <td className="num" data-label={w.beOther}>
                        {m.other >= 0.005 ? `−${F(m.other)}` : F(0)}
                      </td>
                    ) : null}
                    <td className="num tier-be-keep" data-label={w.beKeep}>
                      {t.feeUsdYear == null || !hasRate(t) ? '—' : F(m.net)}
                    </td>
                    <td
                      className={`num ${!isEntry && !short && !p.unpriced && !p.noRate ? (gain > 0.005 ? 'tier-be-up' : gain < -0.005 ? 'tier-be-down' : '') : ''}`}
                      data-label={fillT(w.beVs, { entry: name(p.entry) })}
                    >
                      {isEntry || p.unpriced || p.noRate ? '—' : short ? <span className="faint">{fillT(w.beMinShort, { x: M(p.minSpend!) })}</span> : signed(gain)}
                    </td>
                    <td data-label={w.bePays}>{paysOff(i, p)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="tier-be-foot">
        <p className="faint">{w.beMonthNote}</p>
        <p className="faint">{w.beNotCounted}</p>
      </div>

      {stakes.length ? (
        <div className="stack tier-be-stakes" style={{ gap: 10 }}>
          <span className="field-label">[ {w.stakeTag} ]</span>
          <ul className="tier-be-list">
            {stakes.map((s) => (
              <li key={s.t.name}>
                <b>{name(s.i)}</b>:{' '}
                {s.stake.amount != null
                  ? fillT(w.hold, { amount: num(s.stake.amount), token: s.stake.token })
                  : fillT(w.holdUnknown, { token: s.stake.token })}
                {s.value != null ? (
                  <>
                    {' '}
                    {fillT(w.stakeToday, { value: F(s.value), token: s.stake.token, price: F(s.p!) })}{' '}
                    <span className="tier-be-stress">
                      {fillT(w.stakeDrop, { x: F(s.drop!) })}{' '}
                      {s.months != null
                        ? fillT(w.earnBack, {
                            time: s.months < 1 ? w.underMonth : !tag && Math.ceil(s.months) === 1 ? '1 month' : fillT(w.monthsN, { n: Math.ceil(s.months) }),
                            gain: F(s.gain),
                            entry: name(s.entry)
                          })
                        : fillT(w.neverBack, { entry: name(s.entry) })}
                    </span>
                  </>
                ) : s.stake.amount == null ? (
                  w.stakeNP
                ) : (
                  w.priceNA
                )}
              </li>
            ))}
          </ul>
          <p className="faint" style={{ fontSize: 12, margin: 0 }}>
            {w.stakeNote}
          </p>
        </div>
      ) : null}
    </div>
  );
}
