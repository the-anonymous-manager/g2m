import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getCard, getCards } from '@/lib/cards';
import type { Card } from '@/lib/types';
import { toRow } from '@/lib/types';
import { cashbackLabel, fmtDate, pct, usd } from '@/lib/format';
import { allPairs, parseVersus, versusPath, versusTitle } from '@/lib/versus';
import { versusPoints, versusSummary } from '@/lib/verdict';
import { absoluteUrl, site, shareMeta } from '@/lib/site';
import { ROWS, best } from '@/components/compareRows';
import { CardArt } from '@/components/CardArt';
import { Eyebrow, ScorePill } from '@/components/bits';
import { OutboundLink } from '@/components/OutboundLink';
import { BackButton } from '@/components/BackButton';

// Built ahead of time at every deploy (the card data is bundled, and each sheet sync deploys), so the page is served
// ready-made instead of being put together on each visit. See open-next.config.ts.
export function generateStaticParams() {
  return allPairs(getCards()).map(([a, b]) => ({ pair: versusPath(a.slug, b.slug).split('/').pop()! }));
}


type Props = { params: Promise<{ pair: string }> };

function load(pair: string): [Card, Card] | null {
  const slugs = parseVersus(pair);
  if (!slugs) return null;
  const [a, b] = slugs.map(getCard);
  return a && b ? [a, b] : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pair } = await params;
  const cards = load(pair);
  if (!cards) return {};
  const [a, b] = cards;
  const path = versusPath(a.slug, b.slug);
  const title = versusTitle(a.name, b.name, new Date().getUTCFullYear());
  const description = `${a.name} vs ${b.name}: G2M score ${a.score.total} vs ${b.score.total}, cashback ${cashbackLabel(a.cashback.basePct, a.cashback.maxPct)} vs ${cashbackLabel(b.cashback.basePct, b.cashback.maxPct)}, annual fee ${usd(a.fees.annualUsd)} vs ${usd(b.fees.annualUsd)}, FX fee ${pct(a.fees.fxPct)} vs ${pct(b.fees.fxPct)}.`;
  return {
    title,
    description,
    alternates: { canonical: path },
    ...shareMeta(`${a.name} vs ${b.name} · G2M`, description, path)
  };
}

export default async function VersusPage({ params }: Props) {
  const { pair } = await params;
  const cards = load(pair);
  if (!cards) notFound();
  // One address per pair: kast-vs-tria, never tria-vs-kast.
  const path = versusPath(cards[0].slug, cards[1].slug);
  if (`/compare/${pair}` !== path) permanentRedirect(path);
  const [a, b] = cards;
  const all = getCards();
  const points = versusPoints(a, b, all.length);
  const summary = versusSummary(a, b, points);
  const rows = [toRow(a), toRow(b)];
  const text = (topic: string) => points.find((p) => p.topic === topic)!.text;
  const faq = [
    { q: `Which is better, ${a.name} or ${b.name}?`, a: `${summary} The better card for you depends on where you live and how you spend; the G2M calculator works it out for your own spending.` },
    { q: `Which has lower fees, ${a.name} or ${b.name}?`, a: `${text('annual')} ${text('fx')}` },
    { q: `Which pays more cashback, ${a.name} or ${b.name}?`, a: text('cashback') },
    { q: `Which works in more countries, ${a.name} or ${b.name}?`, a: text('countries') },
    { q: `Who holds my funds with ${a.name} and ${b.name}?`, a: text('custody') }
  ];
  // Other matchups for each card: the best-ranked cards first.
  const more = (c: Card, not: Card) => all.filter((x) => x.slug !== c.slug && x.slug !== not.slug).slice(0, 5);
  const checked = [a.lastChecked, b.lastChecked].sort()[0];
  const url = absoluteUrl(path);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'G2M', item: site.url },
        { '@type': 'ListItem', position: 2, name: 'Compare', item: absoluteUrl('/compare') },
        { '@type': 'ListItem', position: 3, name: `${a.name} vs ${b.name}`, item: url }
      ]
    }
  ];

  return (
    <article className="wrap section stack" style={{ gap: 40 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="stack" style={{ gap: 12 }}>
        <div className="back-row">
          <BackButton fallback="/compare" />
          <nav aria-label="Breadcrumb" className="faint" style={{ fontSize: 14 }}>
            <Link href="/compare" style={{ textDecoration: 'none' }}>
              Compare
            </Link>{' '}
            / <span aria-current="page">{`${a.name} vs ${b.name}`}</span>
          </nav>
        </div>
        <Eyebrow>head to head</Eyebrow>
        <h1 className="h2">
          {a.name} vs {b.name}
        </h1>
        <p className="lead">{summary}</p>
      </div>

      <div className="grid-2 vs-heads">
        {[a, b].map((c) => (
          <div key={c.slug} className="panel panel-pad stack" style={{ gap: 14 }}>
            <div className="vs-art">
              <CardArt card={c} width="min(100%, 260px)" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Link href={`/cards/${c.slug}`} style={{ fontWeight: 700, fontSize: 19, textDecoration: 'none' }}>
                {c.name}
              </Link>
              <ScorePill value={c.score.total} />
            </div>
            <p className="faint" style={{ margin: 0, fontSize: 14 }}>
              #{c.rank} of {all.length} · {cashbackLabel(c.cashback.basePct, c.cashback.maxPct)} back · annual fee{' '}
              {usd(c.fees.annualUsd).toLowerCase() === 'free' ? 'none' : usd(c.fees.annualUsd)}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <OutboundLink slug={c.slug} name={c.brand} placement="versus" className="btn btn-metal btn-sm">
                Get {c.brand}
              </OutboundLink>
              <Link href={`/cards/${c.slug}`} className="btn btn-sm">
                Read the review
              </Link>
            </div>
          </div>
        ))}
      </div>

      <section aria-labelledby="verdict" className="stack" style={{ gap: 14 }}>
        <h2 id="verdict" className="h3">
          The short answer
        </h2>
        <ul className="vs-points">
          {points.map((p) => (
            <li key={p.topic}>{p.text}</li>
          ))}
        </ul>
        <p className="muted" style={{ fontSize: 15, margin: 0 }}>
          Want the answer for your own spending, or the next tier up of each?{' '}
          <Link href={`/calculator?mode=tiers&cards=${a.slug},${b.slug}`}>See what each keeps you a year</Link> or{' '}
          <Link href={`/compare?c=${a.slug},${b.slug}`}>pick tiers and add a third card</Link>.
        </p>
      </section>

      <section aria-labelledby="side" className="stack" style={{ gap: 14 }}>
        <h2 id="side" className="h3">
          Side by side
        </h2>
        <div className="table-wrap">
          <div role="table" aria-label={`${a.name} vs ${b.name}`} className="cmp-table" style={{ minWidth: 610, ['--cmp-n' as string]: 2 }}>
            <div role="row" className="cmp-row cmp-head" style={{ gridTemplateColumns: COLUMNS }}>
              <div role="columnheader" className="cmp-label">
                <span className="sr-only">Detail</span>
              </div>
              {rows.map((c) => (
                <div role="columnheader" key={c.slug} className="cmp-cell" style={{ fontWeight: 700, fontSize: 17 }}>
                  {c.name}
                </div>
              ))}
            </div>
            {ROWS.map((row) => {
              const winners = best(rows, row);
              return (
                <div role="row" key={row.label} className="cmp-row" style={{ gridTemplateColumns: COLUMNS }}>
                  <div role="rowheader" className="cmp-label">
                    {row.label}
                  </div>
                  {rows.map((c) => (
                    <div role="cell" key={c.slug} className={`cmp-cell ${winners.has(c.slug) ? 'cmp-best' : ''}`}>
                      {row.render(c)}
                      {winners.has(c.slug) ? <span className="sr-only"> (better)</span> : null}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <p className="faint" style={{ fontSize: 13, margin: 0 }}>
          Highlighted values are the better of the two. “Not published” means the issuer does not state it. Card data last
          checked {fmtDate(checked)}; see each card&apos;s review for its sources.
        </p>
      </section>

      <section aria-labelledby="faq" className="stack" style={{ gap: 14 }}>
        <h2 id="faq" className="h3">
          Questions
        </h2>
        <div className="stack" style={{ gap: 18 }}>
          {faq.map((f) => (
            <div key={f.q} className="stack" style={{ gap: 6 }}>
              <h3 style={{ fontSize: 17, margin: 0 }}>{f.q}</h3>
              <p className="muted" style={{ margin: 0 }}>
                {f.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="more-vs" className="stack" style={{ gap: 14 }}>
        <h2 id="more-vs" className="h3">
          More comparisons
        </h2>
        <div className="grid-2">
          {[a, b].map((c) => (
            <ul key={c.slug} className="vs-links">
              {more(c, c === a ? b : a).map((x) => (
                <li key={x.slug}>
                  <Link href={versusPath(c.slug, x.slug)}>
                    {c.name} vs {x.name}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </section>

      <p className="faint" style={{ fontSize: 14 }}>
        Scores use the same rules for every card (<Link href="/methodology">how the score works</Link>). Referral links never
        change a score or rank. Not financial advice.
      </p>
    </article>
  );
}

const COLUMNS = 'minmax(130px, 170px) repeat(2, minmax(210px, 1fr))';
