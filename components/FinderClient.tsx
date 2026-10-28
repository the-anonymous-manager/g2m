'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CardRow } from '@/lib/types';
import { COUNTRIES, countryName, isCountry } from '@/lib/regions';
import { finderParams, recommend, type FinderAnswers, type Hold, type Money, type Priority, type Use } from '@/lib/finder';
import { CardArt } from '@/components/CardArt';
import { ScorePill } from '@/components/bits';
import { OutboundLink } from '@/components/OutboundLink';
import { ShareBar } from '@/components/ShareBar';
import { useRegion } from '@/components/RegionContext';
import { NomadBadge } from '@/components/NomadBar';
import { track } from '@/lib/analytics';

type Option<T> = { value: T; label: string; hint?: string };

const TOTAL = 5;

const Q_HOLD: Option<Hold>[] = [
  { value: 'self', label: 'In my own wallet', hint: 'Self-custodial: you keep the keys' },
  { value: 'exchange', label: 'On an exchange is fine', hint: 'Custodial: easier, the issuer holds funds' },
  { value: 'any', label: 'No preference' }
];
const Q_PRIORITY: Option<Priority>[] = [
  { value: 'cashback', label: 'The most cashback' },
  { value: 'fees', label: 'The lowest fees' },
  { value: 'travel', label: 'Travel and spending abroad' },
  { value: 'perks', label: 'Premium perks' }
];
const NONE = 'none' as const;
const Q_USE: Option<Use | typeof NONE>[] = [
  { value: 'wallets', label: 'Apple Pay or Google Pay' },
  { value: 'physical', label: 'Physical card' },
  { value: 'credit', label: 'Borrow against crypto (credit mode)', hint: 'Spend against your crypto without selling it' },
  { value: 'yield', label: 'Earn yield on balance', hint: 'A published yield or APY on what you keep on the card' },
  { value: NONE, label: 'No preference' }
];
const Q_MONEY: Option<Money>[] = [
  { value: 'free', label: 'Free tiers only ($0 yearly fee & no token stake)' },
  { value: 'paid', label: 'Open to paid plans or staking if net rewards are higher' },
  { value: 'bank', label: 'Need a bank account (IBAN) or direct bank payouts' }
];

/** null = not answered yet. uses: [] = no preference. */
type Draft = {
  country: string | null;
  hold: Hold | null;
  priorities: Priority[];
  uses: Use[] | null;
  money: Money[] | null;
  passport?: string;
};

const EMPTY: Draft = { country: null, hold: null, priorities: [], uses: null, money: null };

export function FinderClient({ rows, initial }: { rows: CardRow[]; initial: FinderAnswers | null }) {
  const [a, setA] = useState<Draft>(initial ?? EMPTY);
  const { country: myCountry, ready } = useRegion();

  // Pre-select the viewer's country the first time, if they have not answered yet.
  useEffect(() => {
    if (ready && myCountry && !initial) setA((prev) => (prev.country ? prev : { ...prev, country: myCountry }));
  }, [ready, myCountry, initial]);

  const passport = a.passport && a.passport !== a.country && a.country !== 'ALL' ? a.passport : '';
  const answers: FinderAnswers | null =
    a.country && a.hold && a.priorities.length && a.uses && a.money
      ? { country: a.country, hold: a.hold, priorities: a.priorities, uses: a.uses, money: a.money, passport: passport || undefined }
      : null;
  const key = answers ? finderParams(answers) : '';
  const picks = useMemo(() => (answers ? recommend(rows, answers) : []), [rows, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const left = [a.country, a.hold, a.priorities.length ? 1 : null, a.uses, a.money].filter((x) => x == null).length;

  useEffect(() => {
    if (!answers) return;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${key}`);
    track('Finder', {
      country: answers.country,
      hold: answers.hold,
      priority: answers.priorities.join('+'),
      use: answers.uses.join('+') || 'none',
      money: answers.money.join('+'),
      nomad: answers.passport ? 'yes' : 'no'
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const pickUse = (v: Use | typeof NONE) => {
    // "No preference" clears the others; any other choice clears "No preference".
    if (v === NONE) return setA({ ...a, uses: a.uses && a.uses.length === 0 ? null : [] });
    const next = toggle(a.uses ?? [], v);
    setA({ ...a, uses: next.length ? next : null });
  };
  const pickMoney = (v: Money) => {
    let next = toggle(a.money ?? [], v);
    // Free tiers only and open to paid tiers can't both be true: the newest choice wins.
    if (v === 'free' && next.includes('free')) next = next.filter((x) => x !== 'paid');
    if (v === 'paid' && next.includes('paid')) next = next.filter((x) => x !== 'free');
    setA({ ...a, money: next.length ? next : null });
  };

  const Question = <T extends string>({
    n,
    title,
    hint,
    options,
    isOn,
    onPick,
    multi
  }: {
    n: number;
    title: string;
    hint?: string;
    options: Option<T>[];
    isOn: (v: T) => boolean;
    onPick: (v: T) => void;
    multi?: boolean;
  }) => (
    <fieldset className="panel panel-pad stack" style={{ gap: 14, border: '1px solid var(--border)', margin: 0, minWidth: 0 }}>
      <legend className="sr-only">{title}</legend>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="mono faint" style={{ fontSize: 13 }}>
          {n}/{TOTAL}
        </span>
        <span className="h3" aria-hidden="true">
          {title}
        </span>
        {hint ? (
          <span className="faint" style={{ fontSize: 13 }}>
            {hint}
          </span>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role={multi ? 'group' : 'radiogroup'} aria-label={title}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={isOn(o.value)}
            className={`chip chip-wrap ${isOn(o.value) ? 'is-on' : ''}`}
            onClick={() => onPick(o.value)}
            title={o.hint}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="stack" style={{ gap: 28 }}>
      <div className="stack" style={{ gap: 14 }}>
        <fieldset className="panel panel-pad stack" style={{ gap: 14, border: '1px solid var(--border)', margin: 0, minWidth: 0 }}>
          <legend className="sr-only">Where do you live?</legend>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
            <span className="mono faint" style={{ fontSize: 13 }}>
              1/{TOTAL}
            </span>
            <label className="h3" htmlFor="finder-country">
              Where do you live?
            </label>
          </div>
          <select
            id="finder-country"
            className="select"
            style={{ maxWidth: 420 }}
            value={a.country ?? ''}
            onChange={(e) => setA({ ...a, country: e.target.value === 'ALL' || isCountry(e.target.value) ? e.target.value : null })}
          >
            <option value="" disabled>
              Pick your country
            </option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
                {c.code === myCountry ? ' (your location)' : ''}
              </option>
            ))}
            <option value="ALL">I&apos;d rather not say</option>
          </select>
          <span className="faint" style={{ fontSize: 13 }}>
            We leave out cards not offered there, and count FX fees on your everyday spending in your own currency.
          </span>
          {a.country && a.country !== 'ALL' ? (
            <div className="nomad-bar" data-on={passport ? 'true' : 'false'} style={{ maxWidth: 560, gridTemplateColumns: 'minmax(0, 1fr)' }}>
              <div className="field">
                <label className="field-label" htmlFor="finder-passport">
                  My passport
                </label>
                <select
                  id="finder-passport"
                  className="select"
                  value={a.passport ?? ''}
                  onChange={(e) => setA({ ...a, passport: isCountry(e.target.value) ? e.target.value : undefined })}
                >
                  <option value="">Same as where I live</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="nomad-hint faint">
                {passport
                  ? `Only cards that accept a passport from ${countryName(passport)}, or a residence ID from ${countryName(a.country)}.`
                  : 'Living abroad? Pick your passport to leave out cards whose ID checks you cannot pass.'}
              </p>
            </div>
          ) : null}
        </fieldset>
        {Question({
          n: 2,
          title: 'Where do you want to keep your crypto?',
          options: Q_HOLD,
          isOn: (v) => a.hold === v,
          onPick: (v) => setA({ ...a, hold: v })
        })}
        {Question({
          n: 3,
          title: 'What matters most?',
          hint: 'Pick one or more',
          options: Q_PRIORITY,
          isOn: (v) => a.priorities.includes(v),
          onPick: (v) => setA({ ...a, priorities: toggle(a.priorities, v) }),
          multi: true
        })}
        {Question({
          n: 4,
          title: 'How do you want to spend or use your balance?',
          hint: 'Pick any that matter',
          options: Q_USE,
          isOn: (v) => (v === NONE ? a.uses?.length === 0 : Boolean(a.uses?.includes(v))),
          onPick: pickUse,
          multi: true
        })}
        {Question({
          n: 5,
          title: 'What about annual fees, staking and banking?',
          hint: 'Pick one or more',
          options: Q_MONEY,
          isOn: (v) => Boolean(a.money?.includes(v)),
          onPick: pickMoney,
          multi: true
        })}
      </div>

      <section aria-live="polite" className="stack" style={{ gap: 16 }}>
        {!answers ? (
          <p className="muted">
            Answer all five to see your matches{left < TOTAL ? ` (${left} to go)` : ''}.
          </p>
        ) : picks.length === 0 ? (
          <div className="panel panel-pad stack" style={{ gap: 8 }}>
            <h2 className="h3">No card fits all five yet</h2>
            <p className="muted">Try “No preference” on question 2 or 4, or browse every card for your region.</p>
            <Link href={answers.country === 'ALL' ? '/cards' : `/cards?country=${answers.country}`} className="btn btn-sm" style={{ alignSelf: 'flex-start' }}>
              Browse cards
            </Link>
          </div>
        ) : (
          <>
            <div className="pager">
              <h2 className="h2">Your top {picks.length}</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href={`/compare?c=${picks.map((p) => p.card.slug).join(',')}`} className="btn btn-sm">
                  Compare these
                </Link>
                <ShareBar text={`My best crypto cards on G2M: ${picks.map((p) => p.card.brand).join(', ')}`} />
              </div>
            </div>
            <ol className="stack" style={{ gap: 14, listStyle: 'none', margin: 0, padding: 0 }}>
              {picks.map((p, i) => (
                <li key={p.card.slug} className="panel panel-pad" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className={`rank ${i === 0 ? 'rank-1' : ''}`} style={{ fontSize: 22, width: 28 }}>
                    {i + 1}
                  </span>
                  <CardArt card={p.card} width={120} />
                  <div className="stack" style={{ gap: 8, flex: '1 1 260px', minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Link href={`/cards/${p.card.slug}`} style={{ fontWeight: 700, fontSize: 18, textDecoration: 'none' }}>
                        {p.card.name}
                      </Link>
                      <ScorePill value={p.card.score.total} />
                    </div>
                    <NomadBadge fit={p.nomad} />
                    <ul className="list-plain" style={{ gap: 4 }}>
                      {p.reasons.map((r) => (
                        <li key={r} style={{ fontSize: 15 }}>
                          <span className="dot" style={{ background: 'var(--ok)', marginTop: 7 }} />
                          {r}
                        </li>
                      ))}
                    </ul>
                    {p.caution ? (
                      <p style={{ fontSize: 14, color: 'var(--warn)' }}>
                        <b>Check first:</b> {p.caution}
                      </p>
                    ) : null}
                  </div>
                  <OutboundLink slug={p.card.slug} name={p.card.brand} placement={`finder-${i + 1}`} className="btn btn-metal btn-sm">
                    Get {p.card.brand}
                  </OutboundLink>
                </li>
              ))}
            </ol>
            <p className="faint" style={{ fontSize: 14 }}>
              Want numbers? Put your monthly spend into the <Link href="/calculator">rewards calculator</Link>.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
