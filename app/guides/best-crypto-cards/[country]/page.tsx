import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Card } from '@/lib/types';
import { fmtDate, pct } from '@/lib/format';
import { homeFx } from '@/lib/fx';
import { currencyOf } from '@/lib/currencies.mjs';
import { TOPICS, countryGuide, countryGuidePath, countryGuides } from '@/lib/guides';
import { absoluteUrl, site } from '@/lib/site';
import { Eyebrow } from '@/components/bits';
import { BackButton } from '@/components/BackButton';
import { GuideList } from '@/components/GuideList';

// Rendered on request like the card pages (no incremental cache on the host); the data is bundled, so it is cheap.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ country: string }> };

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params;
  const g = countryGuide(country);
  if (!g) return {};
  const path = countryGuidePath(g.cc);
  const title = `Best crypto cards in ${g.name}: ${g.confirmed.length} compared`;
  const description = `${g.confirmed.length} crypto cards confirmed in ${g.name}, ranked by the G2M score for ${g.name}: cashback, annual fee, FX fee on local spending and custody. Top ranked: ${list(g.confirmed.slice(0, 3).map((c) => c.name))}.`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `Best crypto cards in ${g.name} · G2M`, description, url: absoluteUrl(path) },
    twitter: { title: `Best crypto cards in ${g.name} · G2M`, description }
  };
}

export default async function CountryGuidePage({ params }: Props) {
  const { country } = await params;
  const g = countryGuide(country);
  if (!g) notFound();
  const { cc, name, confirmed } = g;
  const currency = currencyOf(cc) as string | null;
  const fxHere = (c: Card) => homeFx(c, null, cc);
  const noFx = confirmed.filter((c) => fxHere(c).pct === 0);
  const noFee = confirmed.filter((c) => c.fees.annualUsd === 0);
  const selfCustody = confirmed.filter((c) => c.custody === 'self-custodial' || c.custody === 'both');
  const top = confirmed.slice(0, 3).map((c) => `${c.name} (${c.score.total}/100)`);
  const names = (cs: Card[]) =>
    cs.length > 4 ? `${cs.slice(0, 4).map((c) => c.name).join(', ')} and ${cs.length - 4} more` : list(cs.map((c) => c.name));
  const checked = confirmed.reduce((d, c) => (c.lastChecked > d ? c.lastChecked : d), '1970-01-01');
  const spending = currency ? `spending in ${currency}` : 'everyday spending';

  const faq = [
    {
      q: `What is the best crypto card in ${name}?`,
      a: `On the G2M score for ${name}, the top-ranked cards confirmed there are ${list(top)}. The score uses the same rules for every card, with fees worked out on ${spending}.`
    },
    {
      q: `Is there a crypto card with no FX fee on ${spending} in ${name}?`,
      a: noFx.length
        ? `Yes: ${names(noFx)} ${noFx.length === 1 ? 'charges' : 'charge'} no FX fee on ${spending}.`
        : `Not among the cards confirmed in ${name}: each one adds an FX fee on ${spending} or does not say which currencies it bills in.`
    },
    {
      q: `Which crypto cards in ${name} have no annual fee?`,
      a: noFee.length ? `${names(noFee)}.` : `None of the cards confirmed in ${name} has a free entry tier.`
    },
    {
      q: `Is there a self-custodial crypto card in ${name}?`,
      a: selfCustody.length
        ? `Yes: ${names(selfCustody)} ${selfCustody.length === 1 ? 'lets' : 'let'} you keep control of your funds until you spend.`
        : `Not among the cards confirmed in ${name} so far.`
    }
  ];
  const path = countryGuidePath(cc);
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Best crypto cards in ${name}`,
      itemListElement: confirmed.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(`/cards/${c.slug}`), name: c.name }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'G2M', item: site.url },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: absoluteUrl('/guides') },
        { '@type': 'ListItem', position: 3, name: `Best crypto cards in ${name}`, item: absoluteUrl(path) }
      ]
    }
  ];
  // The countries with the most confirmed cards; the full list is on /guides.
  const others = countryGuides()
    .filter((x) => x.cc !== cc)
    .slice(0, 24)
    .sort((a, b) => a.name.localeCompare(b.name));

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
            / <span aria-current="page">{name}</span>
          </nav>
        </div>
        <Eyebrow>country guide</Eyebrow>
        <h1 className="h2">Best crypto cards in {name}</h1>
        <p className="lead">
          {confirmed.length} cards on G2M are confirmed in {name}. They are ranked with the G2M score for {name}: the same
          rules for every card, with fees worked out on {spending}. Top ranked: {list(top)}.
        </p>
      </div>

      <section aria-labelledby="quick" className="stack" style={{ gap: 12 }}>
        <h2 id="quick" className="h3">
          At a glance
        </h2>
        <ul className="vs-points">
          <li>{faq[1].a}</li>
          <li>No annual fee: {noFee.length ? `${names(noFee)}.` : 'none of the confirmed cards.'}</li>
          <li>
            Keep control of your funds (self-custodial): {selfCustody.length ? `${names(selfCustody)}.` : 'none of the confirmed cards so far.'}
          </li>
          {g.unconfirmed ? (
            <li>
              {g.unconfirmed} more {g.unconfirmed === 1 ? 'card has' : 'cards have'} not confirmed {name} either way.{' '}
              <Link href={`/cards?country=${cc}`}>See every card for {name}</Link> in the rankings.
            </li>
          ) : null}
        </ul>
      </section>

      <section aria-labelledby="ranked" className="stack" style={{ gap: 14 }}>
        <h2 id="ranked" className="h3">
          Ranked for {name}
        </h2>
        <GuideList
          cards={confirmed}
          placement={`guide-country-${cc}`}
          fxLabel={currency ? `FX on ${currency}` : 'FX fee'}
          fx={(c) => pct(fxHere(c).pct)}
        />
        <p className="faint" style={{ fontSize: 13, margin: 0 }}>
          Scores and order are for {name}. The FX column is the fee on {spending}: 0% when a card bills in {currency ?? 'it'};
          when an issuer does not say which currencies it bills in, we count its usual FX fee. Card data last checked{' '}
          {fmtDate(checked)}. Confirm on the issuer&apos;s site before you apply.
        </p>
      </section>

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
        <p className="muted" style={{ margin: 0 }}>
          <Link href="/calculator">The rewards calculator</Link> works out what each card keeps you a year in {name} at your
          own spending, and <Link href="/finder">the card finder</Link> picks one in five questions.
        </p>
      </section>

      <section aria-labelledby="more" className="stack" style={{ gap: 12 }}>
        <h2 id="more" className="h3">
          More guides
        </h2>
        <ul className="guide-links">
          {TOPICS.map((x) => (
            <li key={x.slug}>
              <Link href={`/guides/${x.slug}`}>{x.title}</Link>
            </li>
          ))}
        </ul>
        <h3 style={{ fontSize: 16, margin: '8px 0 0' }}>Other countries</h3>
        <ul className="guide-links">
          {others.map((x) => (
            <li key={x.cc}>
              <Link href={countryGuidePath(x.cc)}>{x.name}</Link>
            </li>
          ))}
          <li>
            <Link href="/guides#countries">All countries</Link>
          </li>
        </ul>
      </section>
    </article>
  );
}
