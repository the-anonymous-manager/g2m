import Link from 'next/link';
import { BookSpotForm } from '@/components/BookSpotForm';
import { Eyebrow } from '@/components/bits';
import { bookEn } from '@/lib/i18n/ui/book/en';

/**
 * The body of /book and /de/book ...: what can be booked, the Sponsored rule and the booking form.
 * `spot` and `card` come from the address (?spot=top from the top card on the home page, ?card=kast).
 */
export function BookPage({
  cards,
  email,
  words = bookEn,
  tag = 'en',
  lang = 'en',
  moneyHref = '/methodology#money',
  spot,
  card
}: {
  cards: { slug: string; name: string }[];
  email: string;
  words?: typeof bookEn;
  tag?: string;
  lang?: string;
  moneyHref?: string;
  spot?: string;
  card?: string;
}) {
  const w = words;
  return (
    <div className="wrap section stack" style={{ gap: 28, maxWidth: 860 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>{w.eyebrow}</Eyebrow>
        <h1 className="h2">{w.title}</h1>
        <p className="lead">{w.intro}</p>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <h2 className="h3" style={{ margin: 0 }}>
          {w.whatTitle}
        </h2>
        <ul className="muted" style={{ margin: 0, paddingInlineStart: 20, display: 'grid', gap: 4 }}>
          <li>{w.whatTop}</li>
          <li>{w.whatPicks}</li>
        </ul>
        <p className="faint" style={{ fontSize: 14, margin: 0 }}>
          {w.rules} <Link href={moneyHref}>{w.moneyLink}</Link>
        </p>
      </div>
      <BookSpotForm cards={cards} email={email} words={words} tag={tag} lang={lang} initialSpot={spot} initialCard={card} />
    </div>
  );
}
