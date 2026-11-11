import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getCard, getCards } from '@/lib/cards';
import type { Card } from '@/lib/types';
import { confirmedCountries } from '@/lib/score';
import { parseVersus, versusPath } from '@/lib/versus';
import { LOCALES, fill, hreflangOf, intlCard, intlHome, intlVersus, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { clean, formatters } from '@/lib/i18n/format';
import { intlVersusPoints } from '@/lib/i18n/verdict';
import { absoluteUrl, shareMeta, site } from '@/lib/site';
import { CardArt } from '@/components/CardArt';
import { Eyebrow } from '@/components/bits';
import { OutboundLink } from '@/components/OutboundLink';
import { IntlScore } from '@/components/IntlCardList';

// "X vs Y" in another language: the same verdict as the English page (lib/verdict.ts decides who wins each point),
// in sentences from the dictionary. The matchups between the top-ranked cards are built ahead of time; the others are
// put together on the first visit.
type Props = { params: Promise<{ lang: string; pair: string }> };

/** Cards whose matchups with each other are built ahead of time, in every language. */
const PREBUILT = 10;

export function generateStaticParams() {
  const top = getCards().slice(0, PREBUILT);
  const pairs = top.flatMap((a, i) => top.slice(i + 1).map((b) => versusPath(a.slug, b.slug).split('/').pop()!));
  return LOCALES.flatMap((l) => pairs.map((pair) => ({ lang: l.code, pair })));
}

function load(lang: string, pair: string) {
  const locale = localeByCode(lang);
  const slugs = parseVersus(pair);
  if (!locale || !slugs) return null;
  const [a, b] = slugs.map(getCard);
  return a && b ? { locale, a, b, d: DICTS[locale.code] } : null;
}

const pairOf = (a: Card, b: Card) => versusPath(a.slug, b.slug).split('/').pop()!;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, pair } = await params;
  const x = load(lang, pair);
  if (!x) return {};
  const { locale, a, b, d } = x;
  const f = formatters(locale, d);
  const canonical = pairOf(a, b);
  const title = clean(fill(d.vsTitle, { a: a.name, b: b.name, year: new Date().getUTCFullYear() }));
  const description = clean(
    fill(d.vsDesc, {
      a: a.name,
      b: b.name,
      sa: a.score.total,
      sb: b.score.total,
      ca: f.cashbackS(a),
      cb: f.cashbackS(b),
      fa: f.usdS(a.fees.annualUsd),
      fb: f.usdS(b.fees.annualUsd),
      xa: f.pctS(a.fees.fxPct),
      xb: f.pctS(b.fees.fxPct)
    })
  );
  const path = intlVersus(locale, canonical);
  return {
    title: { absolute: `${title} · ${site.name}` },
    description,
    alternates: { canonical: path, languages: languageLinks(`/compare/${canonical}`, (l) => intlVersus(l, canonical)) },
    ...shareMeta(title, description, path)
  };
}

export default async function IntlVersusPage({ params }: Props) {
  const { lang, pair } = await params;
  const x = load(lang, pair);
  if (!x) notFound();
  const { locale, a, b, d } = x;
  // One address per pair, as in English.
  const canonical = pairOf(a, b);
  if (pair !== canonical) permanentRedirect(intlVersus(locale, canonical));
  const f = formatters(locale, d);
  const all = getCards();
  const points = intlVersusPoints(a, b, all.length, d, f);
  const text = (topic: string) => points.find((p) => p.topic === topic)!.text;
  const h1 = fill(d.vsH1, { a: f.name(a.name), b: f.name(b.name) });
  const yesNo = (v: boolean | null | undefined) => (v == null ? d.notPublished : v ? d.yes : d.no);
  const rows: [string, (c: Card) => React.ReactNode][] = [
    [d.score, (c) => <bdi className="mono">{c.score.total}/100</bdi>],
    [d.rank, (c) => fill(d.rankOf, { rank: c.rank, n: all.length })],
    [d.cashback, (c) => f.cashbackCell(c)],
    [d.annualFee, (c) => f.usdCell(c.fees.annualUsd)],
    [d.fxFee, (c) => f.pctCell(c.fees.fxPct)],
    [d.topUpFee, (c) => f.pctCell(c.fees.topUpPct)],
    [d.custody, (c) => f.custody(c)],
    [d.network, (c) => c.network],
    [d.type, (c) => f.type(c)],
    [d.countries, (c) => f.num(confirmedCountries(c))],
    ['Apple Pay', (c) => yesNo(c.wallets.applePay)],
    ['Google Pay', (c) => yesNo(c.wallets.googlePay)],
    [d.lastChecked, (c) => f.date(c.lastChecked)]
  ];
  const faq = [
    { q: fill(d.vsQBetter, { a: f.name(a.name), b: f.name(b.name) }), a: `${text('score')} ${d.depends}` },
    { q: fill(d.vsQFees, { a: f.name(a.name), b: f.name(b.name) }), a: `${text('annual')} ${text('fx')}` },
    { q: fill(d.vsQCb, { a: f.name(a.name), b: f.name(b.name) }), a: text('cashback') }
  ];
  const more = (c: Card, not: Card) => all.filter((y) => y.slug !== c.slug && y.slug !== not.slug).slice(0, 5);
  const path = intlVersus(locale, canonical);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: hreflangOf(locale),
      mainEntity: faq.map((q) => ({ '@type': 'Question', name: clean(q.q), acceptedAnswer: { '@type': 'Answer', text: clean(q.a) } }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'G2M', item: absoluteUrl(intlHome(locale)) },
        { '@type': 'ListItem', position: 2, name: clean(h1), item: absoluteUrl(path) }
      ]
    }
  ];

  return (
    <article className="wrap section stack" style={{ gap: 40 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="stack" style={{ gap: 12 }}>
        <nav aria-label="Breadcrumb" className="faint" style={{ fontSize: 14 }}>
          <Link href={intlHome(locale)} style={{ textDecoration: 'none' }}>
            {d.allCards}
          </Link>{' '}
          / <span aria-current="page">{h1}</span>
        </nav>
        <Eyebrow>{d.vsEyebrow}</Eyebrow>
        <h1 className="h2">{h1}</h1>
        <p className="lead">
          {text('score')} {d.depends}
        </p>
      </div>

      <div className="grid-2 vs-heads">
        {[a, b].map((c) => (
          <div key={c.slug} className="panel panel-pad stack" style={{ gap: 14 }}>
            <div className="vs-art">
              <CardArt card={c} width="min(100%, 260px)" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Link href={intlCard(locale, c.slug)} style={{ fontWeight: 700, fontSize: 19, textDecoration: 'none' }}>
                <bdi>{c.name}</bdi>
              </Link>
              <IntlScore value={c.score.total} label={d.score} />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <OutboundLink slug={c.slug} name={c.brand} placement={`intl-${locale.code}-versus`} className="btn btn-metal btn-sm">
                {d.getCard}
              </OutboundLink>
              <Link href={intlCard(locale, c.slug)} className="btn btn-sm">
                {d.details}
              </Link>
            </div>
          </div>
        ))}
      </div>

      <section aria-labelledby="verdict" className="stack" style={{ gap: 14 }}>
        <h2 id="verdict" className="h3">
          {d.vsAnswer}
        </h2>
        <ul className="vs-points">
          {points.map((p) => (
            <li key={p.topic}>{p.text}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="side" className="stack" style={{ gap: 12 }}>
        <h2 id="side" className="h3">
          {d.vsSide}
        </h2>
        <div className="table-wrap">
          <table className="table intl-table" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">{d.details}</span>
                </th>
                {[a, b].map((c) => (
                  <th key={c.slug} scope="col">
                    <bdi>{c.name}</bdi>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, cell]) => (
                <tr key={label}>
                  <th scope="row" style={{ fontWeight: 500 }}>
                    {label}
                  </th>
                  <td>{cell(a)}</td>
                  <td>{cell(b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="faint" style={{ fontSize: 13, margin: 0 }}>
          <Link href={`/compare/${canonical}`} lang="en" hrefLang="en">
            {d.vsFull}
          </Link>
        </p>
      </section>

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

      <section aria-labelledby="more-vs" className="stack" style={{ gap: 14 }}>
        <h2 id="more-vs" className="h3">
          {d.vsMore}
        </h2>
        <div className="grid-2">
          {[a, b].map((c) => (
            <ul key={c.slug} className="vs-links">
              {more(c, c === a ? b : a).map((y) => (
                <li key={y.slug}>
                  <Link href={intlVersus(locale, pairOf(c, y))}>{fill(d.vsH1, { a: f.name(c.name), b: f.name(y.name) })}</Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </section>

      <p className="faint" style={{ fontSize: 13, margin: 0 }}>
        {fill(d.builtNote, { date: f.date([a.lastChecked, b.lastChecked].sort()[0]) })}
      </p>
    </article>
  );
}
