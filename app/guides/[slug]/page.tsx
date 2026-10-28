import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCards } from '@/lib/cards';
import { fmtDate } from '@/lib/format';
import { FEES_GUIDE, TOPICS, topicCards } from '@/lib/guides';
import { absoluteUrl, site } from '@/lib/site';
import { Eyebrow } from '@/components/bits';
import { BackButton } from '@/components/BackButton';
import { GuideList } from '@/components/GuideList';

// Rendered on request like the card pages (no incremental cache on the host); the data is bundled, so it is cheap.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

const topicOf = (slug: string) => TOPICS.find((t) => t.slug === slug);
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = topicOf(slug);
  if (!t) return {};
  const n = topicCards(t).length;
  const title = `${t.title} (${n} compared)`;
  return {
    title,
    description: t.description,
    alternates: { canonical: `/guides/${t.slug}` },
    openGraph: { title: `${t.title} · G2M`, description: t.description, url: absoluteUrl(`/guides/${t.slug}`) },
    twitter: { title: `${t.title} · G2M`, description: t.description }
  };
}

export default async function TopicGuidePage({ params }: Props) {
  const { slug } = await params;
  const t = topicOf(slug);
  if (!t) notFound();
  const all = getCards();
  const cards = topicCards(t);
  const lower = t.title.charAt(0).toLowerCase() + t.title.slice(1);
  const top = cards.slice(0, 3).map((c) => `${c.name} (${c.score.total}/100)`);
  const checked = cards.reduce((d, c) => (c.lastChecked > d ? c.lastChecked : d), '1970-01-01');
  const faq = cards.length
    ? [
        { q: `What are the best ${lower}?`, a: `On the G2M score, the top-ranked ${lower} are ${list(top)}. The score uses the same rules for every card: rewards, fees, where it works, banking features and who holds your funds.` },
        { q: `How many ${lower} are there?`, a: `${cards.length} of the ${all.length} crypto cards on G2M.` }
      ]
    : [];
  const url = absoluteUrl(`/guides/${t.slug}`);
  const jsonLd = [
    ...(faq.length
      ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }]
      : []),
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: t.title,
      itemListElement: cards.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(`/cards/${c.slug}`), name: c.name }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'G2M', item: site.url },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: absoluteUrl('/guides') },
        { '@type': 'ListItem', position: 3, name: t.title, item: url }
      ]
    }
  ];

  return (
    <article className="wrap section stack" style={{ gap: 36 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="stack" style={{ gap: 12 }}>
        <div className="back-row">
          <BackButton fallback="/guides" />
          <nav aria-label="Breadcrumb" className="faint" style={{ fontSize: 14 }}>
            <Link href="/guides" style={{ textDecoration: 'none' }}>
              Guides
            </Link>{' '}
            / <span aria-current="page">{t.title}</span>
          </nav>
        </div>
        <Eyebrow>guide</Eyebrow>
        <h1 className="h2">{t.title}</h1>
        <p className="lead">
          {cards.length} of the {all.length} cards on G2M, ranked by the G2M score
          {top.length ? `. Top ranked: ${list(top)}.` : '.'}
        </p>
        <div className="prose stack" style={{ gap: 10 }}>
          {t.intro.map((p) => (
            <p key={p} style={{ margin: 0 }}>
              {p}
            </p>
          ))}
        </div>
      </div>

      {cards.length ? <GuideList cards={cards} placement={`guide-${t.slug}`} /> : <p className="muted">No card matches yet.</p>}
      <p className="faint" style={{ fontSize: 13, margin: 0 }}>
        Cashback and annual fee are for each card&apos;s range of tiers and its entry tier. Card data last checked{' '}
        {fmtDate(checked)}; each review lists its sources.{' '}
        {t.rankings ? (
          <>
            <Link href={t.rankings}>See this list in the rankings</Link> to sort it by any column or pick your country.
          </>
        ) : null}
      </p>

      <section aria-labelledby="check" className="stack" style={{ gap: 12 }}>
        <h2 id="check" className="h3">
          What to check before you pick
        </h2>
        <ul className="vs-points">
          {t.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
          <li>
            <Link href="/calculator">The rewards calculator</Link> works out what each card keeps you a year at your own
            spending, after every fee.
          </li>
        </ul>
      </section>

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
          More guides
        </h2>
        <ul className="guide-links">
          {TOPICS.filter((x) => x.slug !== t.slug).map((x) => (
            <li key={x.slug}>
              <Link href={`/guides/${x.slug}`}>{x.title}</Link>
            </li>
          ))}
          <li>
            <Link href={`/guides/${FEES_GUIDE.slug}`}>{FEES_GUIDE.title}</Link>
          </li>
          <li>
            <Link href="/guides#countries">Best crypto cards by country</Link>
          </li>
        </ul>
      </section>
    </article>
  );
}
