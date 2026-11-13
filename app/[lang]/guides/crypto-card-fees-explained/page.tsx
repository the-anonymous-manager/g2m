import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BASKET_PURCHASES, BASKET_USD } from '@/lib/score';
import { feesStats } from '@/lib/feesGuide';
import { LOCALES, fill, hreflangOf, intlCalculator, intlCard, intlFeesGuide, intlGuide, intlGuides, intlHome, intlMethodology, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { clean, formatters } from '@/lib/i18n/format';
import { FEES } from '@/lib/i18n/fees';
import { intlTopic, intlTopics } from '@/lib/i18n/guides';
import { noteOrNull } from '@/lib/i18n/notes';
import { absoluteUrl, metaDescription, metaTitle, shareMeta } from '@/lib/site';
import { Eyebrow } from '@/components/bits';

// The fees guide in another language (/de/guides/crypto-card-fees-explained): the same sections, numbers and table as
// the English guide, with the text from lib/i18n/fees and numbers, money and dates from Intl. Built ahead of time at
// each deploy (a static folder, so it wins over the topic guides' [slug]).
type Props = { params: Promise<{ lang: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l.code }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) return {};
  const t = FEES[locale.code];
  return {
    title: metaTitle(t.title),
    description: metaDescription(t.description),
    alternates: { canonical: intlFeesGuide(locale), languages: languageLinks('/guides/crypto-card-fees-explained', intlFeesGuide) },
    ...shareMeta(t.title, t.description, intlFeesGuide(locale))
  };
}

export default async function IntlFeesGuidePage({ params }: Props) {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) notFound();
  const t = FEES[locale.code];
  const d = DICTS[locale.code];
  const f = formatters(locale, d);
  const { n, annual, paidAnnual, fx, fxMedian, topUp, perPurchase, small, smallForeign, smallFree, rows, cheapest, checked } = feesStats();
  const money = (x: number) => f.usd(Math.round(x));
  const num = f.num;
  // A topic guide's link: its translated page when it has one, else the English guide.
  const topicLink = (slug: string, text: string) =>
    intlTopic(locale, slug) ? <Link href={intlGuide(locale, slug)}>{text}</Link> : <Link href={`/guides/${slug}`} hrefLang="en">{text}</Link>;

  const faq = [
    { q: t.q1, a: t.a1 },
    {
      q: t.q2,
      a: fill(t.a2, { count: num(fx.length), min: f.pct(Math.min(...fx)), max: f.pct(Math.max(...fx)), median: f.pct(fxMedian ?? 0), zero: num(fx.filter((x) => x === 0).length) })
    },
    { q: t.q3, a: fill(t.a3, { x: money(BASKET_USD), list: f.list(cheapest.map((r) => `${f.name(r.c.name)} (${money(r.abroad!)})`)) }) }
  ];
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
        { '@type': 'ListItem', position: 2, name: d.guidesTitle, item: absoluteUrl(intlGuides(locale)) },
        { '@type': 'ListItem', position: 3, name: t.title, item: absoluteUrl(intlFeesGuide(locale)) }
      ]
    }
  ];
  const smallText = fill(t.pSmall, {
    n: num(small.length),
    total: num(n),
    foreign: smallForeign ? fill(t.smallForeign, { n: num(smallForeign) }) : '',
    free: smallFree ? fill(smallFree === 1 ? t.smallFreeOne : t.smallFreeMany, { n: num(smallFree) }) : ''
  });

  return (
    <article className="wrap section stack" style={{ gap: 36 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="stack" style={{ gap: 12 }}>
        <nav aria-label="Breadcrumb" className="faint" style={{ fontSize: 14 }}>
          <Link href={intlGuides(locale)} style={{ textDecoration: 'none' }}>
            {d.guidesTitle}
          </Link>{' '}
          / <span aria-current="page">{t.title}</span>
        </nav>
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <h1 className="h2">{t.title}</h1>
        <p className="lead">{fill(t.lead, { n: num(n) })}</p>
      </div>

      <div className="prose">
        <h2 id="annual">{t.hAnnual}</h2>
        <p>
          {fill(t.pAnnual, {
            free: num(annual.filter((x) => x === 0).length),
            total: num(annual.length),
            min: f.usd(Math.min(...paidAnnual)),
            max: f.usd(Math.max(...paidAnnual))
          })}
          {topicLink('no-annual-fee-crypto-cards', t.noAnnualLink)}.
        </p>

        <h2 id="fx">{t.hFx}</h2>
        <p>
          {fill(t.pFx, { count: num(fx.length), min: f.pct(Math.min(...fx)), max: f.pct(Math.max(...fx)), median: f.pct(fxMedian ?? 0) })}
          {topicLink('no-fx-fee-crypto-cards', t.noFxLink)}.
        </p>

        <h2 id="topup">{t.hTopUp}</h2>
        <p>{fill(t.pTopUp, { free: num(topUp.filter((x) => x === 0).length), total: num(topUp.length), max: f.pct(Math.max(...topUp)) })}</p>

        <h2 id="purchase">{t.hPurchase}</h2>
        <p>{fill(t.pPurchase, { n: num(perPurchase), total: num(n) })}</p>

        <h2 id="small">{t.hSmall}</h2>
        <p>{smallText}</p>

        <h2 id="atm">{t.hAtm}</h2>
        <p>{t.pAtm}</p>
      </div>

      <section aria-labelledby="month" className="stack" style={{ gap: 14 }}>
        <div className="prose">
          <h2 id="month">{fill(t.hMonth, { x: money(BASKET_USD) })}</h2>
          <p>{fill(t.pMonth, { x: money(BASKET_USD), purchases: num(BASKET_PURCHASES), a: f.usd(10), b: f.usd(200) })}</p>
        </div>
        <div className="table-wrap">
          <table className="table intl-table" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th scope="col">{t.thCard}</th>
                <th scope="col">{t.thHome}</th>
                <th scope="col">{t.thAbroad}</th>
                <th scope="col">{t.thAnnual}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, home, abroad }) => (
                <tr key={c.slug}>
                  <td>
                    <Link href={intlCard(locale, c.slug)}>{c.name}</Link>
                  </td>
                  <td className="num">{home == null ? d.notPublished : money(home)}</td>
                  <td className="num">{abroad == null ? d.notPublished : money(abroad)}</td>
                  <td className="num">{f.usdCell(c.fees.annualUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="faint" style={{ fontSize: 13, margin: 0 }}>
          {fill(t.foot, { date: f.date(checked) })}
          <Link href={`${intlMethodology(locale)}#basket`}>{t.basketLink}</Link>.
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
        <p className="muted" style={{ margin: 0 }}>
          {t.calcLine.split('{link}').flatMap((part, i) => (i ? [<Link key={i} href={intlCalculator(locale)}>{t.calcLink}</Link>, part] : [part]))}
        </p>
      </section>

      <section aria-labelledby="more" className="stack" style={{ gap: 12 }}>
        <h2 id="more" className="h3">
          {d.guideMore}
        </h2>
        <ul className="guide-links">
          {intlTopics(locale).map((x) => (
            <li key={x.slug}>
              <Link href={intlGuide(locale, x.slug)}>{noteOrNull(locale, x.title)}</Link>
            </li>
          ))}
          <li>
            <Link href={`${intlGuides(locale)}#countries`}>{d.countriesTitle}</Link>
          </li>
        </ul>
      </section>
    </article>
  );
}
