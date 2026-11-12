'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CardRow } from '@/lib/types';
import { COUNTRIES, countryName, isCountry } from '@/lib/regions';
import { finderParams, recommend, type FinderAnswers, type Hold, type Money, type Priority, type Use, type Why } from '@/lib/finder';
import { CardArt } from '@/components/CardArt';
import { ScorePill } from '@/components/bits';
import { OutboundLink } from '@/components/OutboundLink';
import { ShareBar } from '@/components/ShareBar';
import { useRegion } from '@/components/RegionContext';
import { NomadBadge } from '@/components/NomadBar';
import { track } from '@/lib/analytics';
import { englishFmt, fillNodes, fillText, intlFmt, type ClientFmt } from '@/lib/i18n/clientFormat';
import { finderEn } from '@/lib/i18n/ui/finder/en';
import type { Ui } from '@/lib/i18n/ui/en';

type Option<T> = { value: T; label: string; hint?: string };

const TOTAL = 5;

type W = typeof finderEn;
const NONE = 'none' as const;
const qHold = (w: W): Option<Hold>[] => [
  { value: 'self', label: w.holdSelf, hint: w.holdSelfHint },
  { value: 'exchange', label: w.holdExchange, hint: w.holdExchangeHint },
  { value: 'any', label: w.noPref }
];
const qPriority = (w: W): Option<Priority>[] => [
  { value: 'cashback', label: w.prCashback },
  { value: 'fees', label: w.prFees },
  { value: 'travel', label: w.prTravel },
  { value: 'perks', label: w.prPerks }
];
const qUse = (w: W): Option<Use | typeof NONE>[] => [
  { value: 'wallets', label: w.useWallets },
  { value: 'physical', label: w.usePhysical },
  { value: 'credit', label: w.useCredit, hint: w.useCreditHint },
  { value: 'yield', label: w.useYield, hint: w.useYieldHint },
  { value: NONE, label: w.noPref }
];
const qMoney = (w: W): Option<Money>[] => [
  { value: 'free', label: w.moneyFree },
  { value: 'paid', label: w.moneyPaid },
  { value: 'bank', label: w.moneyBank }
];

/** One reason in the page's language (another language only; English shows lib/finder's own sentences). */
function whyText(r: Why, w: W, fmt: ClientFmt, tag: string, sheet?: Record<string, string>): string {
  const pc = (n: number) => fmt.pct(n);
  switch (r.k) {
    case 'confirmed':
      return fillText(w.wConfirmed, { place: fmt.country(r.cc) });
    case 'self':
      return w.wSelf;
    case 'free':
      return w.wFree;
    case 'ibanNamed':
      return w.wIbanNamed;
    case 'ibanShared':
      return w.wIbanShared;
    case 'payout':
      return w.wPayout;
    case 'use':
      return { wallets: w.wWallets, physical: w.wPhysical, credit: w.wCredit, yield: w.wYield }[r.use];
    case 'cashback':
      if (r.base != null && r.max != null && r.max > r.base) return fillText(w.wCashbackRange, { a: pc(r.base), b: pc(r.max) });
      if (r.base != null) return fillText(w.wCashback, { x: pc(r.base) });
      return fillText(w.wCashbackUpTo, { x: pc(r.max ?? 0) });
    case 'noAnnual':
      return w.wNoAnnual;
    case 'fxHome':
      return r.p === 0 ? fillText(w.wFxHomeNone, { cur: r.cur }) : fillText(w.wFxHome, { p: pc(r.p), cur: r.cur });
    case 'fx':
      return fillText(w.wFx, { p: pc(r.p) });
    case 'fxAbroadNone':
      return w.wFxAbroadNone;
    case 'fxAbroad':
      return fillText(w.wFxAbroad, { p: pc(r.p) });
    case 'lounge':
      return w.wLounge;
    case 'countries':
      return fillText(w.wCountries, { n: r.n.toLocaleString(tag) });
    case 'metal':
      return w.wMetal;
    case 'perk':
      return sheet?.[r.text] ?? r.text;
    case 'paid':
      return fillText(w.wPaid, { p: pc(r.p) });
    case 'score':
      return fillText(w.wScore, { n: r.n });
  }
}

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

type Props = {
  rows: CardRow[];
  initial: FinderAnswers | null;
  /** Another language (English when left out): its words, language tag, address prefix (/de), country names and
   *  the sheet text the finder shows (perks), English → translation. */
  ui?: Ui;
  tag?: string;
  prefix?: string;
  countryNames?: Record<string, string>;
  sheet?: Record<string, string>;
};

export function FinderClient({ rows, initial, ui, tag, prefix = '', countryNames, sheet }: Props) {
  const english = !ui || !tag;
  const w = english ? finderEn : ui.finder;
  const fmt = useMemo(() => (english ? englishFmt : intlFmt(tag ?? 'en', ui!, countryNames)), [english, tag, ui, countryNames]);
  const countryList = english ? COUNTRIES : fmt.countries();
  const place = (cc: string) => (english ? countryName(cc) : fmt.country(cc));
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
      nomad: answers.passport ? 'yes' : 'no',
      picks: picks.map((p) => p.card.slug).join(',')
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
          <legend className="sr-only">{w.q1}</legend>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
            <span className="mono faint" style={{ fontSize: 13 }}>
              1/{TOTAL}
            </span>
            <label className="h3" htmlFor="finder-country">
              {w.q1}
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
              {w.pickCountry}
            </option>
            {countryList.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
                {c.code === myCountry ? w.yourLocation : ''}
              </option>
            ))}
            <option value="ALL">{w.ratherNot}</option>
          </select>
          <span className="faint" style={{ fontSize: 13 }}>
            {w.q1Help}
          </span>
          {a.country && a.country !== 'ALL' ? (
            <div className="nomad-bar" data-on={passport ? 'true' : 'false'} style={{ maxWidth: 560, gridTemplateColumns: 'minmax(0, 1fr)' }}>
              <div className="field">
                <label className="field-label" htmlFor="finder-passport">
                  {w.passport}
                </label>
                <select
                  id="finder-passport"
                  className="select"
                  value={a.passport ?? ''}
                  onChange={(e) => setA({ ...a, passport: isCountry(e.target.value) ? e.target.value : undefined })}
                >
                  <option value="">{w.samePassport}</option>
                  {countryList.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="nomad-hint faint">
                {passport
                  ? fillText(w.passportOn, { passport: place(passport), home: place(a.country) })
                  : w.passportOff}
              </p>
            </div>
          ) : null}
        </fieldset>
        {Question({
          n: 2,
          title: w.q2,
          options: qHold(w),
          isOn: (v) => a.hold === v,
          onPick: (v) => setA({ ...a, hold: v })
        })}
        {Question({
          n: 3,
          title: w.q3,
          hint: w.pickOneOrMore,
          options: qPriority(w),
          isOn: (v) => a.priorities.includes(v),
          onPick: (v) => setA({ ...a, priorities: toggle(a.priorities, v) }),
          multi: true
        })}
        {Question({
          n: 4,
          title: w.q4,
          hint: w.pickAny,
          options: qUse(w),
          isOn: (v) => (v === NONE ? a.uses?.length === 0 : Boolean(a.uses?.includes(v))),
          onPick: pickUse,
          multi: true
        })}
        {Question({
          n: 5,
          title: w.q5,
          hint: w.pickOneOrMore,
          options: qMoney(w),
          isOn: (v) => Boolean(a.money?.includes(v)),
          onPick: pickMoney,
          multi: true
        })}
      </div>

      <section aria-live="polite" className="stack" style={{ gap: 16 }}>
        {!answers ? (
          <p className="muted">{fillText(w.answerAll, { toGo: left < TOTAL ? fillText(w.toGo, { n: english ? left : left.toLocaleString(tag) }) : '' })}</p>
        ) : picks.length === 0 ? (
          <div className="panel panel-pad stack" style={{ gap: 8 }}>
            <h2 className="h3">{w.noFit}</h2>
            <p className="muted">{w.noFitText}</p>
            <Link href={answers.country === 'ALL' ? `${prefix}/cards` : `${prefix}/cards?country=${answers.country}`} className="btn btn-sm" style={{ alignSelf: 'flex-start' }}>
              {w.browse}
            </Link>
          </div>
        ) : (
          <>
            <div className="pager">
              <h2 className="h2">{fillText(w.yourTop, { n: english ? picks.length : picks.length.toLocaleString(tag) })}</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href={`${prefix}/compare?c=${picks.map((p) => p.card.slug).join(',')}`} className="btn btn-sm">
                  {w.compareThese}
                </Link>
                <ShareBar text={fillText(w.shareText, { names: picks.map((p) => p.card.brand).join(', ') })} words={english ? undefined : ui.common} />
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
                      <Link href={`${prefix}/cards/${p.card.slug}`} style={{ fontWeight: 700, fontSize: 18, textDecoration: 'none' }}>
                        {p.card.name}
                      </Link>
                      <ScorePill value={p.card.score.total} />
                    </div>
                    {english ? <NomadBadge fit={p.nomad} /> : <NomadBadge fit={p.nomad} ui={ui} fmt={fmt} passport={answers.passport ?? ''} home={answers.country} />}
                    <ul className="list-plain" style={{ gap: 4 }}>
                      {(english ? p.reasons : p.why.map((r) => whyText(r, w, fmt, tag ?? 'en', sheet))).map((r) => (
                        <li key={r} style={{ fontSize: 15 }}>
                          <span className="dot" style={{ background: 'var(--ok)', marginTop: 7 }} />
                          {r}
                        </li>
                      ))}
                    </ul>
                    {p.caution ? (
                      <p style={{ fontSize: 14, color: 'var(--warn)' }}>
                        <b>{w.checkFirst}</b> {english || !p.cautionCc ? p.caution : fillText(w.caution, { place: place(p.cautionCc) })}
                      </p>
                    ) : null}
                  </div>
                  <OutboundLink slug={p.card.slug} name={p.card.brand} placement={`finder-${i + 1}`} className="btn btn-metal btn-sm">
                    {fillText(w.getCard, { brand: p.card.brand })}
                  </OutboundLink>
                </li>
              ))}
            </ol>
            <p className="faint" style={{ fontSize: 14 }}>
              {fillNodes(w.wantNumbers, { link: <Link href={`${prefix}/calculator`}>{w.calcLink}</Link> })}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
