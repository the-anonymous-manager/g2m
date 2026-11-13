'use client';

import { useState } from 'react';
import { track } from '@/lib/analytics';
import { fillNodes } from '@/lib/i18n/clientFormat';
import { submitEn } from '@/lib/i18n/ui/submit/en';

type Kind = 'new' | 'fix';

/** `words`: another language's pack (English when left out). The email it prepares stays in English, for G2M. */
export function SubmitForm({
  email,
  cards,
  initialCard,
  words = submitEn
}: {
  email: string;
  cards: { slug: string; name: string }[];
  initialCard: string;
  words?: typeof submitEn;
}) {
  const w = words;
  const [kind, setKind] = useState<Kind>(initialCard ? 'fix' : 'new');
  const [card, setCard] = useState(initialCard);
  const [name, setName] = useState('');
  const [site, setSite] = useState('');
  const [from, setFrom] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (kind === 'new' && !name.trim()) return setError(w.errName);
    if (kind === 'new' && site && !/^https?:\/\/\S+\.\S+/.test(site.trim())) return setError(w.errSite);
    if (kind === 'fix' && !card) return setError(w.errCard);
    if (details.trim().length < 10) return setError(w.errDetails);
    const cardName = kind === 'fix' ? cards.find((c) => c.slug === card)?.name ?? card : name.trim();
    const subject = kind === 'new' ? `New card for G2M: ${cardName}` : `Correction for ${cardName}`;
    const body = [
      kind === 'new' ? `Card: ${cardName}` : `Card: ${cardName} (g2m.life/cards/${card})`,
      kind === 'new' && site ? `Website: ${site.trim()}` : null,
      from ? `Reply to: ${from.trim()}` : null,
      '',
      details.trim()
    ]
      .filter((l) => l !== null)
      .join('\n');
    setReady({ subject, body });
    track('Submit', { kind });
  };

  const copy = async () => {
    if (!ready) return;
    try {
      await navigator.clipboard.writeText(`To: ${email}\nSubject: ${ready.subject}\n\n${ready.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <form className="panel panel-pad stack" style={{ gap: 16 }} onSubmit={submit} noValidate>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label={w.kindAria}>
          <button type="button" role="radio" aria-checked={kind === 'new'} className={`chip ${kind === 'new' ? 'is-on' : ''}`} onClick={() => setKind('new')}>
            {w.kindNew}
          </button>
          <button type="button" role="radio" aria-checked={kind === 'fix'} className={`chip ${kind === 'fix' ? 'is-on' : ''}`} onClick={() => setKind('fix')}>
            {w.kindFix}
          </button>
        </div>

        {kind === 'new' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div className="field">
              <label className="field-label" htmlFor="s-name">
                {w.name}
              </label>
              <input id="s-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="s-site">
                {w.site}
              </label>
              <input id="s-site" className="input" type="url" placeholder="https://" value={site} onChange={(e) => setSite(e.target.value)} maxLength={200} />
            </div>
          </div>
        ) : (
          <div className="field">
            <label className="field-label" htmlFor="s-card">
              {w.card}
            </label>
            <select id="s-card" className="select" value={card} onChange={(e) => setCard(e.target.value)}>
              <option value="">{w.pickCard}</option>
              {cards.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="s-details">
            {kind === 'new' ? w.detailsNew : w.detailsFix}
          </label>
          <textarea id="s-details" className="textarea" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={3000} />
        </div>
        <div className="field" style={{ maxWidth: 420 }}>
          <label className="field-label" htmlFor="s-from">
            {w.from}
          </label>
          <input id="s-from" className="input" value={from} onChange={(e) => setFrom(e.target.value)} maxLength={120} />
        </div>
        {error ? (
          <p role="alert" style={{ color: 'var(--bad)', fontSize: 14 }}>
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-metal" style={{ alignSelf: 'flex-start' }}>
          {w.prepare}
        </button>
      </form>

      {ready ? (
        <div className="panel panel-pad stack" style={{ gap: 12 }} aria-live="polite">
          <h2 className="h3">{w.ready}</h2>
          <p className="muted">{fillNodes(w.sendTo, { email: <b style={{ color: 'var(--text)', userSelect: 'all' }}>{email}</b> })}</p>
          {w.englishNote ? (
            <p className="faint" style={{ fontSize: 13, margin: 0 }}>
              {w.englishNote}
            </p>
          ) : null}
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', background: 'var(--surface-2)', padding: 14, borderRadius: 12, fontSize: 13, margin: 0, overflowWrap: 'anywhere' }}>
            {`Subject: ${ready.subject}\n\n${ready.body}`}
          </pre>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a className="btn btn-sm btn-metal" href={`mailto:${email}?subject=${encodeURIComponent(ready.subject)}&body=${encodeURIComponent(ready.body)}`}>
              {w.openEmail}
            </a>
            <button type="button" className="btn btn-sm" onClick={copy}>
              {copied ? w.copied : w.copy}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
