'use client';

import { useEffect, useState } from 'react';
import { track } from '@/lib/analytics';
import { fillNodes, fillText } from '@/lib/i18n/clientFormat';
import { bookEn } from '@/lib/i18n/ui/book/en';

type Words = typeof bookEn;
const SPOTS = ['any', 'slot1', 'slot2', 'slot3', 'top'] as const;
const MONTHS = [1, 3, 6, 12] as const;
const OTHER = '__other';

/**
 * "Card issuers can book one of these spots", with a form that opens in place: card, spot, monthly budget, length,
 * start month and how to reach them (Telegram and/or email). Sent to /api/book and listed on /stats. If saving fails,
 * it offers the same request as a prepared email. `words` and `tag`: another language (English when left out).
 */
export function BookSpotForm({
  cards,
  email: g2mEmail,
  words = bookEn,
  tag = 'en',
  lang = 'en',
  before
}: {
  cards: { slug: string; name: string }[];
  email: string;
  words?: Words;
  tag?: string;
  lang?: string;
  /** Text shown before the "Book a spot" link on the same line (e.g. the Sponsored note). */
  before?: React.ReactNode;
}) {
  const w = words;
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState('');
  const [cardName, setCardName] = useState('');
  const [spot, setSpot] = useState<(typeof SPOTS)[number]>('any');
  const [budget, setBudget] = useState('');
  const [months, setMonths] = useState(3);
  const [start, setStart] = useState('');
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [telegram, setTelegram] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [trap, setTrap] = useState('');
  const [error, setError] = useState('');
  const [fallback, setFallback] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  // The next 12 months, worded by the browser after it loads (so the page's HTML never depends on today's date).
  const [startMonths, setStartMonths] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    setStartMonths(
      Array.from({ length: 12 }, (_, i) => {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
        return { value: d.toISOString().slice(0, 7), label: fmt.format(d) };
      })
    );
    // "#book" opens the form; "#book-top" (the "book this spot" link on the top card) also picks the top spot.
    const fromHash = () => {
      if (location.hash === '#book' || location.hash === '#book-top') setOpen(true);
      if (location.hash === '#book-top') {
        setSpot('top');
        document.getElementById('book')?.scrollIntoView({ block: 'start' });
      }
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [tag]);

  const spotLabel: Record<(typeof SPOTS)[number], string> = { any: w.spotAny, slot1: w.spot1, slot2: w.spot2, slot3: w.spot3, top: w.spotTop };
  const tg = telegram.trim().replace(/^(?:https?:\/\/)?(?:t\.me\/|telegram\.me\/)?@?/i, '');
  const reply = [tg ? `@${tg}` : '', email.trim()].filter(Boolean).join(' / ');
  const cardText = card === OTHER ? cardName.trim() : cards.find((c) => c.slug === card)?.name ?? '';

  const mailto = () => {
    const body = [
      `Card: ${cardText}`,
      `Spot: ${bookEn[({ any: 'spotAny', slot1: 'spot1', slot2: 'spot2', slot3: 'spot3', top: 'spotTop' } as const)[spot]]}`,
      `Budget: $${budget} a month for ${months} month${months > 1 ? 's' : ''}`,
      `Start: ${start || 'as soon as possible'}`,
      `Company: ${company.trim()}`,
      name.trim() ? `Name: ${name.trim()}` : null,
      tg ? `Telegram: @${tg}` : null,
      email.trim() ? `Email: ${email.trim()}` : null,
      note.trim() ? `\n${note.trim()}` : null
    ]
      .filter((l) => l !== null)
      .join('\n');
    return `mailto:${g2mEmail}?subject=${encodeURIComponent(`Spot booking on G2M: ${cardText}`)}&body=${encodeURIComponent(body)}`;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFallback(false);
    const amount = Number(budget.replace(/[^\d.]/g, ''));
    if (!cardText) return setError(w.errCard);
    if (!amount || amount < 1) return setError(w.errBudget);
    if (!company.trim()) return setError(w.errCompany);
    if (!tg && !email.trim()) return setError(w.errContact);
    if (tg && !/^[A-Za-z0-9_]{5,32}$/.test(tg)) return setError(w.errTelegram);
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(w.errEmail);
    setState('sending');
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card: card === OTHER ? '' : card,
          cardName: card === OTHER ? cardName : '',
          spot,
          budget: amount,
          months,
          start,
          company,
          name,
          telegram: tg,
          email,
          note,
          lang,
          website: trap
        })
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (out.ok) {
        setState('done');
        track('Book', { spot, card: card === OTHER ? 'other' : card });
        return;
      }
      setState('idle');
      if (out.error === 'invalid') return setError(w.errContact);
      setError(out.error === 'limit' ? w.errLimit : w.errOffline);
      setFallback(true);
    } catch {
      setState('idle');
      setError(w.errOffline);
      setFallback(true);
    }
  };

  const field = (id: string, label: string, input: React.ReactNode) => (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {input}
    </div>
  );

  return (
    <div id="book" className="stack" style={{ gap: 14, scrollMarginTop: 96 }}>
      <p className="faint" style={{ fontSize: 13, margin: 0 }}>
        {before}
        {w.lead}{' '}
        <button type="button" className="link-button" aria-expanded={open} aria-controls="book-form" onClick={() => setOpen(!open)}>
          {open ? w.close : w.open}
        </button>
      </p>

      {open ? (
        state === 'done' ? (
          <div className="panel panel-pad stack" style={{ gap: 6, maxWidth: 720 }} role="status">
            <h3 className="h3" style={{ margin: 0 }}>
              {w.thanks}
            </h3>
            <p className="muted" style={{ margin: 0 }}>
              {fillNodes(w.thanksNote, { contact: <b style={{ color: 'var(--text)' }}>{reply}</b> })}
            </p>
          </div>
        ) : (
          <form id="book-form" className="panel panel-pad stack" style={{ gap: 16, maxWidth: 720, position: 'relative' }} onSubmit={submit} onChange={() => error && !fallback && setError('')} noValidate>
            <div className="stack" style={{ gap: 4 }}>
              <h3 className="h3" style={{ margin: 0 }}>
                {w.title}
              </h3>
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>
                {w.intro}
              </p>
            </div>
            <div className="book-grid">
              {field(
                'b-card',
                w.card,
                <select id="b-card" className="select" value={card} onChange={(e) => setCard(e.target.value)}>
                  <option value="">{w.pickCard}</option>
                  {cards.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                  <option value={OTHER}>{w.otherCard}</option>
                </select>
              )}
              {card === OTHER
                ? field('b-cardname', w.cardName, <input id="b-cardname" className="input" value={cardName} onChange={(e) => setCardName(e.target.value)} maxLength={80} />)
                : null}
              {field(
                'b-spot',
                w.spot,
                <select id="b-spot" className="select" value={spot} onChange={(e) => setSpot(e.target.value as (typeof SPOTS)[number])}>
                  {SPOTS.map((s) => (
                    <option key={s} value={s}>
                      {spotLabel[s]}
                    </option>
                  ))}
                </select>
              )}
              {field(
                'b-budget',
                w.budget,
                <div className="book-money">
                  <span aria-hidden="true">$</span>
                  <input
                    id="b-budget"
                    className="input"
                    inputMode="numeric"
                    autoComplete="off"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
                  />
                </div>
              )}
              {field(
                'b-months',
                w.months,
                <select id="b-months" className="select" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m === 1 ? w.monthsOne : fillText(w.monthsMany, { n: m })}
                    </option>
                  ))}
                </select>
              )}
              {field(
                'b-start',
                w.start,
                <select id="b-start" className="select" value={start} onChange={(e) => setStart(e.target.value)}>
                  <option value="">{w.startAsap}</option>
                  {startMonths.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
              {field('b-company', w.company, <input id="b-company" className="input" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={100} />)}
              {field('b-name', w.name, <input id="b-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />)}
              {field(
                'b-telegram',
                w.telegram,
                <div className="book-money">
                  <span aria-hidden="true">@</span>
                  <input
                    id="b-telegram"
                    className="input"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={telegram}
                    onChange={(e) => setTelegram(e.target.value)}
                    maxLength={80}
                  />
                </div>
              )}
              {field('b-email', w.email, <input id="b-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />)}
            </div>
            <p className="faint" style={{ fontSize: 13, margin: '-6px 0 0' }}>
              {w.either}
            </p>
            {field('b-note', w.note, <textarea id="b-note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} />)}
            {/* Hidden from people; bots that fill in every field give themselves away. */}
            <div aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', opacity: 0 }}>
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
              </label>
            </div>
            <p className="faint" style={{ fontSize: 13, margin: 0 }}>
              {w.rules}
            </p>
            {error ? (
              <p role="alert" style={{ color: 'var(--bad)', fontSize: 14, margin: 0 }}>
                {error}{' '}
                {fallback ? (
                  <a href={mailto()} style={{ color: 'inherit' }}>
                    {w.emailUs}
                  </a>
                ) : null}
              </p>
            ) : null}
            <button type="submit" className="btn btn-metal" style={{ alignSelf: 'flex-start' }} disabled={state === 'sending'}>
              {state === 'sending' ? w.sending : w.send}
            </button>
          </form>
        )
      ) : null}
    </div>
  );
}
