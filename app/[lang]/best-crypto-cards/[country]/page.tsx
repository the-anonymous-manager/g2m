import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Card } from '@/lib/types';
import { homeFx } from '@/lib/fx';
import { countryGuide, countryGuides, countrySlug } from '@/lib/guides';
import { LOCALES, fill, hreflangOf, intlCard, intlCountry, intlHome, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { formatters } from '@/lib/i18n/format';
import { absoluteUrl, metaDescription, metaTitle, shareMeta } from '@/lib/site';
import { Eyebrow } from '@/components/bits';
import { IntlCardList } from '@/components/IntlCardList';

// "Crypto cards: <country>" in another language: the cards confirmed in that country, ranked with the country's own
// score, like the English country guides. Each language's own markets are built ahead of time; the other countries
// are put together on the first visit.
type Props = { params: Promise<{ lang: string; country: string }> };

export function generateStaticParams() {
  const withGuide = new Set(countryGuides().map((g) => g.cc));
  return LOCALES.flatMap((l) => l.markets.filter((cc) => withGuide.has(cc)).map((cc) => ({ lang: l.code, country: countrySlug(cc) })));
}

function load(lang: string, country: string) {
  const locale = localeByCode(lang);
  const guide = countryGuide(country);
  return locale && guide ? { locale, guide, d: DICTS[locale.code] } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, country } = await params;
  const x = load(lang, country);
  if (!x) return {};
  const { locale, guide, d } = x;
  const f = formatters(locale, d);
  const vars = { country: f.country(guide.cc), year: new Date().getUTCFullYear(), n: guide.confirmed.length };
  const title = fill(d.countryTitle, vars);
  const description = fill(d.countryDesc, vars);
  const slug = countrySlug(guide.cc);
  return {
    title: metaTitle(title),
    description: metaDescription(description),
    alternates: { canonical: intlCountry(locale, slug), languages: languageLinks(`/guides/best-crypto-cards/${slug}`, (l) => intlCountry(l, slug)) },
    ...shareMeta(title, description, intlCountry(locale, slug))
  };
}

export default async function IntlCountryPage({ params }: Props) {
  const { lang, country } = await params;
  const x = load(lang, country);
  if (!x) notFound();
  const { locale, guide, d } = x;
  const f = formatters(locale, d);
  const name = f.country(guide.cc);
  const vars = { country: name, year: new Date().getUTCFullYear(), n: guide.confirmed.length, m: guide.unconfirmed };
  const slug = countrySlug(guide.cc);
  const others = countryGuides()
    .filter((g) => g.cc !== guide.cc)
    .slice(0, 24);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: fill(d.countryH1, vars),
      inLanguage: hreflangOf(locale),
      itemListElement: guide.confirmed.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(intlCard(locale, c.slug)), name: c.name }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'G2M', item: absoluteUrl(intlHome(locale)) },
        { '@type': 'ListItem', position: 2, name, item: absoluteUrl(intlCountry(locale, slug)) }
      ]
    }
  ];

  return (
    <article className="wrap section stack" style={{ gap: 36 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="stack" style={{ gap: 12 }}>
        <nav aria-label="Breadcrumb" className="faint" style={{ fontSize: 14 }}>
          <Link href={intlHome(locale)} style={{ textDecoration: 'none' }}>
            {d.allCards}
          </Link>{' '}
          / <span aria-current="page">{name}</span>
        </nav>
        <Eyebrow>{d.countryEyebrow}</Eyebrow>
        <h1 className="h2">{fill(d.countryH1, vars)}</h1>
        <p className="lead">
          {fill(d.countryLead, vars)}
          {guide.unconfirmed ? ` ${fill(d.countryMore, vars)}` : ''}
        </p>
      </div>

      <IntlCardList
        cards={guide.confirmed}
        locale={locale}
        d={d}
        f={f}
        placement={`intl-${locale.code}-country-${guide.cc}`}
        fxLabel={d.countryFx}
        fx={(c: Card) => f.pctCell(homeFx(c, null, guide.cc).pct)}
      />

      <section aria-labelledby="more" className="stack" style={{ gap: 12 }}>
        <h2 id="more" className="h3">
          {d.countriesTitle}
        </h2>
        <ul className="guide-links">
          {others.map((g) => (
            <li key={g.cc}>
              <Link href={intlCountry(locale, countrySlug(g.cc))}>{f.country(g.cc)}</Link>
            </li>
          ))}
          <li>
            <Link href={intlHome(locale)}>{d.allCards}</Link>
          </li>
        </ul>
      </section>
    </article>
  );
}
