import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCard, getCards } from '@/lib/cards';
import type { Card } from '@/lib/types';
import { versusPoints } from '@/lib/verdict';
import { versusPath } from '@/lib/versus';
import { alternativesTo } from '@/lib/alternatives';
import { LOCALES, fill, hreflangOf, intlAlternatives, intlCard, intlHome, intlVersus, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { clean, formatters } from '@/lib/i18n/format';
import { winWords } from '@/lib/i18n/verdict';
import { note } from '@/lib/i18n/notes';
import { absoluteUrl, metaDescription, metaTitle, shareMeta } from '@/lib/site';
import { shortName } from '@/lib/versus';
import { Eyebrow } from '@/components/bits';
import { IntlCardList } from '@/components/IntlCardList';
import { IntlText } from '@/components/IntlText';

// "Best X alternatives" in another language: the same list as the English page (lib/alternatives.ts), with what each
// alternative does better from the "X vs Y" verdict. Built ahead of time at each deploy.
type Props = { params: Promise<{ lang: string; slug: string }> };

const COUNT = 10;

export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.flatMap((l) => getCards().map((c) => ({ lang: l.code, slug: c.slug })));
}

function load(lang: string, slug: string) {
  const locale = localeByCode(lang);
  const card = getCard(slug);
  return locale && card ? { locale, card, d: DICTS[locale.code] } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  const x = load(lang, slug);
  if (!x) return {};
  const { locale, card, d } = x;
  const alts = alternativesTo(card, getCards(), COUNT);
  const title = fill(d.altTitle, { name: shortName(card.name), year: new Date().getUTCFullYear() });
  const description = clean(fill(d.altDesc, { name: card.name, n: alts.length }));
  const path = intlAlternatives(locale, card.slug);
  return {
    title: metaTitle(title),
    description: metaDescription(description),
    alternates: { canonical: path, languages: languageLinks(`/cards/${card.slug}/alternatives`, (l) => intlAlternatives(l, card.slug)) },
    ...shareMeta(title, description, path, `/cards/${card.slug}/opengraph-image`)
  };
}

export default async function IntlAlternativesPage({ params }: Props) {
  const { lang, slug } = await params;
  const x = load(lang, slug);
  if (!x) notFound();
  const { locale, card, d } = x;
  const f = formatters(locale, d);
  const all = getCards();
  const alts = alternativesTo(card, all, COUNT);
  const words = winWords(d);
  const wins = (alt: Card) =>
    versusPoints(alt, card, all.length)
      .filter((p) => p.topic !== 'score' && p.winner === alt)
      .map((p) => words[p.topic])
      .filter(Boolean);
  const pair = (c: Card) => versusPath(card.slug, c.slug).split('/').pop()!;
  const path = intlAlternatives(locale, card.slug);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: clean(fill(d.altH1, { name: card.name })),
      inLanguage: hreflangOf(locale),
      itemListElement: alts.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(intlCard(locale, c.slug)), name: c.name }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'G2M', item: absoluteUrl(intlHome(locale)) },
        { '@type': 'ListItem', position: 2, name: card.name, item: absoluteUrl(intlCard(locale, card.slug)) },
        { '@type': 'ListItem', position: 3, name: clean(fill(d.altH1, { name: card.name })), item: absoluteUrl(path) }
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
          /{' '}
          <Link href={intlCard(locale, card.slug)} style={{ textDecoration: 'none' }}>
            <bdi>{card.name}</bdi>
          </Link>
        </nav>
        <Eyebrow>{d.altEyebrow}</Eyebrow>
        <h1 className="h2">{fill(d.altH1, { name: f.name(card.name) })}</h1>
        <p className="lead">{fill(d.altLead, { name: f.name(card.name), score: card.score.total, rank: card.rank, n: all.length })}</p>
        {card.cons.length ? (
          <div className="prose stack" style={{ gap: 6 }}>
            <p style={{ margin: 0 }}>
              {d.altWhy}
              {f.colon.trimEnd()}
            </p>
            <ul style={{ margin: 0 }}>
              {card.cons.map((c) => (
                <li key={c}>
                  <IntlText note={note(locale, c)} label={d.inEnglish} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <IntlCardList
        cards={alts}
        locale={locale}
        d={d}
        f={f}
        placement={`intl-${locale.code}-alternatives-${card.slug}`}
        note={(c) => {
          const w = wins(c);
          return (
            <>
              {w.length ? fill(d.altBetter, { list: f.list(w) }) : fill(d.altScore, { x: c.score.total, y: card.score.total })}{' '}
              <Link href={intlVersus(locale, pair(c))}>{fill(d.vsH1, { a: f.name(card.name), b: f.name(c.name) })}</Link>
            </>
          );
        }}
      />

      <p className="faint" style={{ fontSize: 13, margin: 0 }}>
        {fill(d.builtNote, { date: f.date([card, ...alts].reduce((m, c) => (c.lastChecked > m ? c.lastChecked : m), '1970-01-01')) })}
      </p>
    </article>
  );
}
