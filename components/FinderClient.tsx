'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CardRow } from '@/lib/types';
import { COUNTRIES, countryName, isCountry } from '@/lib/regions';
import { recommend, type FinderAnswers, type Hold, type Priority } from '@/lib/finder';
import { CardArt } from '@/components/CardArt';
import { ScorePill } from '@/components/bits';
import { OutboundLink } from '@/components/OutboundLink';
import { ShareBar } from '@/components/ShareBar';
import { useRegion } from '@/components/RegionContext';
import { NomadBadge } from '@/components/NomadBar';
import { track } from '@/lib/analytics';

type Option<T> = { value: T; label: string; hint?: string };

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

type Draft = { country: string | null; hold: Hold | null; priority: Priority | null; passport?: string };

export function FinderClient({ rows, initial }: { rows: CardRow[]; initial: FinderAnswers | null }) {
  const [a, setA] = useState<Draft>(initial ?? { country: null, hold: null, priority: null });
  const { country: myCountry, ready } = useRegion();

  // Pre-select the viewer's country the first time, if they have not answered yet.
  useEffect(() => {
    if (ready && myCountry && !initial) setA((prev) => (prev.country ? prev : { ...prev, country: myCountry }));
  }, [ready, myCountry, initial]);

  const done = a.country && a.hold && a.priority;
  const passport = a.passport && a.passport !== a.country && a.country !== 'ALL' ? a.passport : '';
  const answers = done ? ({ ...(a as FinderAnswers), passport: passport || undefined } as FinderAnswers) : null;
  const picks = useMemo(() => (answers ? recommend(rows, answers) : []), [rows, answers?.country, answers?.hold, answers?.priority, answers?.passport]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!answers) return;
    const qs = `m=${answers.country}&h=${answers.hold}&p=${answers.priority}${answers.passport ? `&pp=${answers.passport}` : ''}`;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${qs}`);
    track('Finder', { country: answers.country, hold: answers.hold, priority: answers.priority, nomad: answers.passport ? 'yes' : 'no' });
  }, [answers?.country, answers?.hold, answers?.priority, answers?.passport]); // eslint-disable-line react-hooks/exhaustive-deps

  const Question = <T extends string>({
    n,
    title,
    name,
    options,
    value,
    onPick
  }: {
    n: number;
    title: string;
    name: string;
    options: Option<T>[];
    value: T | null;
    onPick: (v: T) => void;
  }) => (
    <fieldset className="panel panel-pad stack" style={{ gap: 14, border: '1px solid var(--border)', margin: 0, minWidth: 0 }}>
      <legend className="sr-only">{title}</legend>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
        <span className="mono faint" style={{ fontSize: 13 }}>
          {n}/3
        </span>
        <span className="h3" aria-hidden="true">
          {title}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="radiogroup" aria-label={title}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`chip ${value === o.value ? 'is-on' : ''}`}
            onClick={() => onPick(o.value)}
            title={o.hint}
            name={name}
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
              1/3
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
        {Question({ n: 2, title: 'Where do you want to keep your crypto?', name: 'hold', options: Q_HOLD, value: a.hold, onPick: (v) => setA({ ...a, hold: v }) })}
        {Question({ n: 3, title: 'What matters most?', name: 'priority', options: Q_PRIORITY, value: a.priority, onPick: (v) => setA({ ...a, priority: v }) })}
      </div>

      <section aria-live="polite" className="stack" style={{ gap: 16 }}>
        {!answers ? (
          <p className="muted">Answer all three to see your matches.</p>
        ) : picks.length === 0 ? (
          <div className="panel panel-pad stack" style={{ gap: 8 }}>
            <h2 className="h3">No card fits all three yet</h2>
            <p className="muted">Try “No preference” on question 2, or browse every card for your region.</p>
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
