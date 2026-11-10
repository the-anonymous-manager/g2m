import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCard, getCards } from '@/lib/cards';
import type { Card } from '@/lib/types';
import { fmtDate, pct, usd } from '@/lib/format';
import { WIN_WORDS, versusPoints } from '@/lib/verdict';
import { versusPath } from '@/lib/versus';
import { alternativesPath, alternativesTo } from '@/lib/alternatives';
import { absoluteUrl, site, shareMeta } from '@/lib/site';
import { Eyebrow } from '@/components/bits';
import { BackButton } from '@/components/BackButton';
import { GuideList } from '@/components/GuideList';

// "Best X alternatives": built only from the card data, like the guides and the "X vs Y" pages.
export const dynamic = 'force-dynamic';

const COUNT = 10;
type Props = { params: Promise<{ slug: string }> };

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** What an alternative does better than the card, in the words of the "X vs Y" verdict. */
function wins(alt: Card, card: Card, total: number): string[] {
  return versusPoints(alt, card, total)
    .filter((p) => p.topic !== 'score' && p.winner === alt)
    .map((p) => WIN_WORDS[p.topic])
    .filter(Boolean);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const card = getCard(slug);
  if (!card) return {};
  const alts = alternativesTo(card, getCards(), COUNT);
  const year = new Date().getUTCFullYear();
  const title = `Best ${card.brand} Alternatives ${year}: ${alts.length} Crypto Cards Compared`;
  const description = `Cards to consider instead of the ${card.name}, ranked by the G2M score: ${list(alts.slice(0, 3).map((c) => c.name))} and more, with cashback, annual fee and FX fee side by side.`;
  return {
    title,
    description,
    alternates: { canonical: alternativesPath(card.slug) },
    ...shareMeta(`${card.brand} alternatives · G2M`, description, alternativesPath(card.slug), `/cards/${card.slug}/opengraph-image`)
  };
}

export default async function AlternativesPage({ params }: Props) {
  const { slug } = await params;
  const card = getCard(slug);
  if (!card) notFound();
  const all = getCards();
  const alts = alternativesTo(card, all, COUNT);
  const url = absoluteUrl(alternativesPath(card.slug));
  const higher = alts.filter((c) => c.score.total > card.score.total);
  const noFee = alts.find((c) => c.fees.annualUsd === 0 && card.fees.annualUsd !== 0);
  const lowFx = [...alts]
    .filter((c) => c.fees.fxPct != null && (card.fees.fxPct == null || c.fees.fxPct < card.fees.fxPct))
    .sort((a, b) => (a.fees.fxPct ?? 0) - (b.fees.fxPct ?? 0) || a.rank - b.rank)[0];
  const moreCash = [...alts]
    .filter((c) => c.cashback.basePct != null && c.cashback.basePct > (card.cashback.basePct ?? 0))
    .sort((a, b) => (b.cashback.basePct ?? 0) - (a.cashback.basePct ?? 0) || a.rank - b.rank)[0];
  const checked = [card, ...alts].reduce((d, c) => (c.lastChecked > d ? c.lastChecked : d), '1970-01-01');

  const faq = [
    alts[0] && {
      q: `What is the best alternative to the ${card.name}?`,
      a: `On the G2M score, ${alts[0].name} (${alts[0].score.total}/100) is the top-ranked alternative, against ${card.score.total}/100 for the ${card.name}. ${
        alts[1] ? `Next are ${list(alts.slice(1, 3).map((c) => `${c.name} (${c.score.total}/100)`))}.` : ''
      }`.trim()
    },
    noFee && {
      q: `Is there a free alternative to the ${card.name}?`,
      a:
        card.fees.annualUsd == null
          ? `${card.name} does not publish its annual fee. ${noFee.name} has no annual fee on its entry tier.`
          : `Yes: ${noFee.name} has no annual fee on its entry tier; the ${card.name} costs ${usd(card.fees.annualUsd)} a year.`
    },
    lowFx && {
      q: `Which alternative to the ${card.name} has a lower FX fee?`,
      a: `${lowFx.name} charges ${pct(lowFx.fees.fxPct)} on foreign currency, against ${pct(card.fees.fxPct)} on the ${card.name}.`
    },
    moreCash && {
      q: `Which alternative to the ${card.name} pays more cashback?`,
      a: `${moreCash.name} pays ${pct(moreCash.cashback.basePct)} on its entry tier, against ${pct(card.cashback.basePct ?? 0)} on the ${card.name}.`
    }
  ].filter(Boolean) as { q: string; a: string }[];

  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${card.brand} alternatives`,
      itemListElement: alts.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(`/cards/${c.slug}`), name: c.name }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'G2M', item: site.url },
        { '@type': 'ListItem', position: 2, name: 'Cards', item: absoluteUrl('/cards') },
        { '@type': 'ListItem', position: 3, name: card.name, item: absoluteUrl(`/cards/${card.slug}`) },
        { '@type': 'ListItem', position: 4, name: 'Alternatives', item: url }
      ]
    }
  ];

  return (
    <article className="wrap section stack" style={{ gap: 36 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="stack" style={{ gap: 12 }}>
        <div className="back-row">
          <BackButton fallback={`/cards/${card.slug}`} />
          <nav aria-label="Breadcrumb" className="faint" style={{ fontSize: 14 }}>
            <Link href="/cards" style={{ textDecoration: 'none' }}>
              Cards
            </Link>{' '}
            /{' '}
            <Link href={`/cards/${card.slug}`} style={{ textDecoration: 'none' }}>
              {card.name}
            </Link>{' '}
            / <span aria-current="page">Alternatives</span>
          </nav>
        </div>
        <Eyebrow>alternatives</Eyebrow>
        <h1 className="h2">Best {card.brand} alternatives</h1>
        <p className="lead">
          The {card.name} scores {card.score.total}/100 (#{card.rank} of {all.length} cards). Here are the {alts.length}{' '}
          best-scored cards available in at least one of the same markets
          {higher.length ? (higher.length === alts.length ? '; all of them score higher' : `; ${higher.length} of them score higher`) : ''}.
        </p>
        {card.cons.length ? (
          <div className="prose stack" style={{ gap: 6 }}>
            <p style={{ margin: 0 }}>Why people look for an alternative to the {card.name}:</p>
            <ul style={{ margin: 0 }}>
              {card.cons.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <GuideList
        cards={alts}
        placement={`alternatives-${card.slug}`}
        note={(c) => {
          const w = wins(c, card, all.length);
          return (
            <>
              {w.length ? `Better than ${card.brand} on ${list(w)}. ` : `Scores ${c.score.total}/100 against ${card.score.total}/100. `}
              <Link href={versusPath(card.slug, c.slug)}>
                {card.brand} vs {c.brand}
              </Link>
            </>
          );
        }}
      />
      <p className="faint" style={{ fontSize: 13, margin: 0 }}>
        Ranked by the worldwide G2M score. Cashback and annual fee are for each card&apos;s range of tiers and its entry
        tier. Card data last checked {fmtDate(checked)}; each review lists its sources. Pick your country in the{' '}
        <Link href="/cards">rankings</Link> to see only cards that work where you live.
      </p>

      {faq.length ? (
        <section aria-labelledby="faq" className="stack" style={{ gap: 14 }}>
          <h2 id="faq" className="h3">
            Questions
          </h2>
          {faq.map((f) => (
            <div key={f.q} className="stack" style={{ gap: 6 }}>
              <h3 style={{ fontSize: 17, margin: 0 }}>{f.q}</h3>
              <p className="muted" style={{ margin: 0 }}>
                {f.a}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="more" className="stack" style={{ gap: 12 }}>
        <h2 id="more" className="h3">
          Keep looking
        </h2>
        <ul className="guide-links">
          <li>
            <Link href={`/cards/${card.slug}`}>Read the {card.name} review</Link>
          </li>
          <li>
            <Link href={`/compare?c=${[card.slug, ...alts.slice(0, 2).map((a) => a.slug)].join(',')}`}>
              Compare {card.brand} with {list(alts.slice(0, 2).map((a) => a.brand))}
            </Link>
          </li>
          <li>
            <Link href="/finder">Find the card that fits you</Link>
          </li>
          <li>
            <Link href="/guides">All guides</Link>
          </li>
        </ul>
      </section>
    </article>
  );
}
