import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCards, lastUpdated } from '@/lib/cards';
import { countryGuides, countrySlug } from '@/lib/guides';
import { LOCALES, fill, hreflangOf, intlCard, intlCountry, intlHome, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { formatters } from '@/lib/i18n/format';
import { absoluteUrl, shareMeta, site } from '@/lib/site';
import { Eyebrow } from '@/components/bits';
import { IntlCardList } from '@/components/IntlCardList';

// The home page in another language (/de, /ar ...): the full ranking with every word from that language's
// dictionary and every value from the card data. Built ahead of time at each deploy.
type Props = { params: Promise<{ lang: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l.code }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) return {};
  const d = DICTS[locale.code];
  const vars = { year: new Date().getUTCFullYear(), n: getCards().length };
  const title = fill(d.homeTitle, vars);
  const description = fill(d.homeDesc, vars);
  return {
    title: { absolute: `${title} · ${site.name}` },
    description,
    alternates: { canonical: intlHome(locale), languages: languageLinks('/', intlHome) },
    ...shareMeta(title, description, intlHome(locale))
  };
}

export default async function IntlHomePage({ params }: Props) {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) notFound();
  const d = DICTS[locale.code];
  const f = formatters(locale, d);
  const cards = getCards();
  const vars = { year: new Date().getUTCFullYear(), n: cards.length };
  const noFee = cards.filter((c) => c.fees.annualUsd === 0).length;
  const top = cards
    .slice(0, 3)
    .map((c) => `${c.name} (${c.score.total}/100)`)
    .join(', ');
  // This language's own markets first, then the countries with the most confirmed cards.
  const guides = countryGuides();
  const withGuide = new Set(guides.map((g) => g.cc));
  const countries = [...locale.markets.filter((cc) => withGuide.has(cc)), ...guides.map((g) => g.cc).filter((cc) => !locale.markets.includes(cc))].slice(0, 30);
  const faq = [
    { q: d.q1, a: d.a1 },
    { q: d.q2, a: fill(d.a2, { top }) },
    { q: d.q3, a: fill(d.a3, { nofee: noFee, n: cards.length }) }
  ];
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: hreflangOf(locale), mainEntity: faq.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: fill(d.homeH1, vars),
      inLanguage: hreflangOf(locale),
      itemListElement: cards.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(intlCard(locale, c.slug)), name: c.name }))
    }
  ];

  return (
    <article className="wrap section stack" style={{ gap: 36 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>{d.homeEyebrow}</Eyebrow>
        <h1 className="h2">{fill(d.homeH1, vars)}</h1>
        <p className="lead">{fill(d.homeLead, vars)}</p>
      </div>

      <section aria-labelledby="ranking" className="stack" style={{ gap: 14 }}>
        <h2 id="ranking" className="h3">
          {d.rankingTitle}
        </h2>
        <IntlCardList cards={cards} locale={locale} d={d} f={f} placement={`intl-${locale.code}-home`} />
      </section>

      <section aria-labelledby="how" className="stack" style={{ gap: 10 }}>
        <h2 id="how" className="h3">
          {d.howTitle}
        </h2>
        <p className="muted" style={{ margin: 0, maxWidth: '75ch' }}>
          {d.howText}
        </p>
        <p style={{ margin: 0 }}>
          <Link href="/methodology" lang="en" hrefLang="en">
            {d.methodLink}
          </Link>
        </p>
      </section>

      {countries.length ? (
        <section aria-labelledby="countries" className="stack" style={{ gap: 12 }}>
          <h2 id="countries" className="h3">
            {d.countriesTitle}
          </h2>
          <ul className="guide-links">
            {countries.map((cc) => (
              <li key={cc}>
                <Link href={intlCountry(locale, countrySlug(cc))}>{f.country(cc)}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="faq" className="stack" style={{ gap: 14 }}>
        <h2 id="faq" className="h3">
          {d.faqTitle}
        </h2>
        {faq.map((x) => (
          <div key={x.q} className="stack" style={{ gap: 6 }}>
            <h3 style={{ fontSize: 17, margin: 0 }}>{x.q}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {x.a}
            </p>
          </div>
        ))}
      </section>

      <p className="faint" style={{ fontSize: 13, margin: 0 }}>
        {fill(d.builtNote, { date: f.date(lastUpdated()) })}
      </p>
    </article>
  );
}
