import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCards } from '@/lib/cards';
import { topicCards } from '@/lib/guides';
import { LOCALES, fill, hreflangOf, intlCard, intlGuide, intlGuides, intlHome, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { clean, formatters } from '@/lib/i18n/format';
import { intlTopic, intlTopics } from '@/lib/i18n/guides';
import { note, noteOrNull } from '@/lib/i18n/notes';
import { absoluteUrl, shareMeta, site } from '@/lib/site';
import { Eyebrow } from '@/components/bits';
import { IntlCardList } from '@/components/IntlCardList';
import { IntlText } from '@/components/IntlText';

// A topic guide ("Crypto cards with no FX fee") in another language: the explanation from data/i18n, and the same
// list of cards as the English guide. Built ahead of time at each deploy.
type Props = { params: Promise<{ lang: string; slug: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.flatMap((l) => intlTopics(l).map((t) => ({ lang: l.code, slug: t.slug })));
}

function load(lang: string, slug: string) {
  const locale = localeByCode(lang);
  const topic = locale && intlTopic(locale, slug);
  return locale && topic ? { locale, topic, d: DICTS[locale.code] } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  const x = load(lang, slug);
  if (!x) return {};
  const { locale, topic, d } = x;
  const title = fill(d.guideMeta, { title: noteOrNull(locale, topic.title)!, year: new Date().getUTCFullYear() });
  const description = noteOrNull(locale, topic.description)!;
  const path = intlGuide(locale, topic.slug);
  return {
    title: { absolute: `${title} · ${site.name}` },
    description,
    alternates: {
      canonical: path,
      languages: languageLinks(`/guides/${topic.slug}`, (l) => intlGuide(l, topic.slug), LOCALES.filter((l) => intlTopic(l, topic.slug)))
    },
    ...shareMeta(title, description, path)
  };
}

export default async function IntlTopicPage({ params }: Props) {
  const { lang, slug } = await params;
  const x = load(lang, slug);
  if (!x) notFound();
  const { locale, topic, d } = x;
  const f = formatters(locale, d);
  const all = getCards();
  const cards = topicCards(topic);
  const title = noteOrNull(locale, topic.title)!;
  const top = f.list(cards.slice(0, 3).map((c) => `${f.name(c.name)} (${c.score.total}/100)`));
  const faq = cards.length ? [{ q: fill(d.guideQBest, { title }), a: fill(d.guideABest, { top }) }] : [];
  const checked = cards.reduce((m, c) => (c.lastChecked > m ? c.lastChecked : m), '1970-01-01');
  const path = intlGuide(locale, topic.slug);
  const jsonLd = [
    ...(faq.length
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            inLanguage: hreflangOf(locale),
            mainEntity: faq.map((q) => ({ '@type': 'Question', name: clean(q.q), acceptedAnswer: { '@type': 'Answer', text: clean(q.a) } }))
          }
        ]
      : []),
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: title,
      inLanguage: hreflangOf(locale),
      itemListElement: cards.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(intlCard(locale, c.slug)), name: c.name }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'G2M', item: absoluteUrl(intlHome(locale)) },
        { '@type': 'ListItem', position: 2, name: d.guidesTitle, item: absoluteUrl(intlGuides(locale)) },
        { '@type': 'ListItem', position: 3, name: title, item: absoluteUrl(path) }
      ]
    }
  ];

  return (
    <article className="wrap section stack" style={{ gap: 36 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="stack" style={{ gap: 12 }}>
        <nav aria-label="Breadcrumb" className="faint" style={{ fontSize: 14 }}>
          <Link href={intlGuides(locale)} style={{ textDecoration: 'none' }}>
            {d.guidesTitle}
          </Link>{' '}
          / <span aria-current="page">{title}</span>
        </nav>
        <Eyebrow>{d.guideEyebrow}</Eyebrow>
        <h1 className="h2">{title}</h1>
        <p className="lead">
          {fill(d.guideLead, { n: cards.length, total: all.length })}
          {cards.length ? ` ${fill(d.guideTop, { top })}` : ''}
        </p>
        <div className="prose stack" style={{ gap: 10 }}>
          {topic.intro.map((p) => (
            <p key={p} style={{ margin: 0 }}>
              <IntlText note={note(locale, p)} label={d.inEnglish} />
            </p>
          ))}
        </div>
      </div>

      {cards.length ? <IntlCardList cards={cards} locale={locale} d={d} f={f} placement={`intl-${locale.code}-guide-${topic.slug}`} /> : null}

      <section aria-labelledby="check" className="stack" style={{ gap: 12 }}>
        <h2 id="check" className="h3">
          {d.guideCheck}
        </h2>
        <ul className="vs-points">
          {topic.tips.map((tip) => (
            <li key={tip}>
              <IntlText note={note(locale, tip)} label={d.inEnglish} />
            </li>
          ))}
        </ul>
      </section>

      {faq.length ? (
        <section aria-labelledby="faq" className="stack" style={{ gap: 14 }}>
          <h2 id="faq" className="h3">
            {d.faqTitle}
          </h2>
          {faq.map((q) => (
            <div key={q.q} className="stack" style={{ gap: 6 }}>
              <h3 style={{ fontSize: 17, margin: 0 }}>{q.q}</h3>
              <p className="muted" style={{ margin: 0 }}>
                {q.a}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="more" className="stack" style={{ gap: 12 }}>
        <h2 id="more" className="h3">
          {d.guideMore}
        </h2>
        <ul className="guide-links">
          {intlTopics(locale)
            .filter((t) => t.slug !== topic.slug)
            .map((t) => (
              <li key={t.slug}>
                <Link href={intlGuide(locale, t.slug)}>{noteOrNull(locale, t.title)}</Link>
              </li>
            ))}
          <li>
            <Link href={intlGuides(locale)}>{d.guidesTitle}</Link>
          </li>
        </ul>
      </section>

      <p className="faint" style={{ fontSize: 13, margin: 0 }}>
        {fill(d.builtNote, { date: f.date(checked) })}
      </p>
    </article>
  );
}
