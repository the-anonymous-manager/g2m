import type { Metadata } from 'next';
import Link from 'next/link';
import { FEES_GUIDE, TOPICS, countryGuidePath, countryGuides, topicCards } from '@/lib/guides';
import { Eyebrow } from '@/components/bits';

// Rendered on request like the card pages (no incremental cache on the host); the data is bundled, so it is cheap.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Crypto card guides',
  description:
    'Plain guides to crypto cards: the best cards by country, cards with no FX fee or no annual fee, self-custodial cards, cards with an IBAN, and every fee explained.',
  alternates: { canonical: '/guides' }
};

export default function GuidesPage() {
  const countries = countryGuides();
  return (
    <div className="wrap section stack" style={{ gap: 36 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>guides</Eyebrow>
        <h1 className="h2">Crypto card guides</h1>
        <p className="lead">
          Short guides built from the same data as the rankings, so they change when a card&apos;s terms change.
        </p>
      </div>

      <section aria-labelledby="topics" className="stack" style={{ gap: 14 }}>
        <h2 id="topics" className="h3">
          By what you need
        </h2>
        <div className="grid-3">
          {TOPICS.map((t) => (
            <Link key={t.slug} href={`/guides/${t.slug}`} className="panel panel-pad stack" style={{ gap: 6, textDecoration: 'none' }}>
              <b>{t.title}</b>
              <span className="faint" style={{ fontSize: 14 }}>
                {topicCards(t).length} cards
              </span>
            </Link>
          ))}
          <Link href={`/guides/${FEES_GUIDE.slug}`} className="panel panel-pad stack" style={{ gap: 6, textDecoration: 'none' }}>
            <b>{FEES_GUIDE.title}</b>
            <span className="faint" style={{ fontSize: 14 }}>
              Every fee, and what it costs on a month of spending
            </span>
          </Link>
        </div>
      </section>

      <section id="countries" aria-labelledby="countries-title" className="stack" style={{ gap: 14, scrollMarginTop: 90 }}>
        <h2 id="countries-title" className="h3">
          Best crypto cards by country
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          Every country where at least five cards are confirmed, ranked with the G2M score for that country.
        </p>
        <ul className="guide-links">
          {[...countries]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((g) => (
              <li key={g.cc}>
                <Link href={countryGuidePath(g.cc)}>{g.name}</Link> <span className="faint">({g.confirmed.length})</span>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
