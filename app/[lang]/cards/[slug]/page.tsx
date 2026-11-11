import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCard, getCards } from '@/lib/cards';
import { availabilityIn } from '@/lib/regions';
import { confirmedCountries, SCORE_WEIGHTS } from '@/lib/score';
import { countryGuides, countrySlug } from '@/lib/guides';
import { LOCALES, fill, hreflangOf, intlAlternatives, intlCard, intlCountry, intlGuides, intlHome, intlReferral, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { clean, formatters } from '@/lib/i18n/format';
import { note, noteOrNull } from '@/lib/i18n/notes';
import { hasReferralPage } from '@/lib/referral';
import { absoluteUrl, shareMeta, site } from '@/lib/site';
import { shortName } from '@/lib/versus';
import { CardArt } from '@/components/CardArt';
import { Eyebrow } from '@/components/bits';
import { OutboundLink } from '@/components/OutboundLink';
import { IntlScore } from '@/components/IntlCardList';
import { IntlText } from '@/components/IntlText';

// A card's page in another language: its facts, tiers, score and availability, all from the card data, with labels
// from that language's dictionary. The notes typed in the sheet (summary, pros, cons, bonus) come from data/i18n,
// in English until translated. Sources and tier conditions stay on the English review, which is linked.
// Built ahead of time at each deploy.
type Props = { params: Promise<{ lang: string; slug: string }> };

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
  const f = formatters(locale, d);
  const vars = {
    name: shortName(card.name),
    year: new Date().getUTCFullYear(),
    cb: f.cashbackS(card),
    fee: f.usdS(card.fees.annualUsd),
    fx: f.pctS(card.fees.fxPct),
    score: card.score.total
  };
  const title = fill(d.cardTitle, vars);
  // Direction marks help inside the page but not in a search result.
  const description = clean(fill(d.cardDesc, { ...vars, name: card.name }));
  const path = intlCard(locale, card.slug);
  return {
    title: { absolute: `${title} · ${site.name}` },
    description,
    alternates: { canonical: path, languages: languageLinks(`/cards/${card.slug}`, (l) => intlCard(l, card.slug)) },
    ...shareMeta(title, description, path, `/cards/${card.slug}/opengraph-image`)
  };
}

export default async function IntlCardPage({ params }: Props) {
  const { lang, slug } = await params;
  const x = load(lang, slug);
  if (!x) notFound();
  const { locale, card, d } = x;
  const f = formatters(locale, d);
  const total = getCards().length;
  const vars = {
    name: card.name,
    cb: f.cashbackS(card),
    fee: f.usdS(card.fees.annualUsd),
    fx: f.pctS(card.fees.fxPct),
    score: card.score.total,
    rank: card.rank,
    n: total
  };
  const yesNo = (v: boolean | null | undefined) => (v == null ? d.notPublished : v ? d.yes : d.no);
  const facts: [string, string][] = [
    [d.cashback, f.cashbackCell(card)],
    [d.annualFee, f.usdCell(card.fees.annualUsd)],
    [d.fxFee, f.pctCell(card.fees.fxPct)],
    [d.topUpFee, f.pctCell(card.fees.topUpPct)],
    [d.network, card.network],
    [d.type, f.type(card)],
    [d.custody, f.custody(card)],
    [d.physical, yesNo(card.forms.includes('physical') || card.forms.includes('metal'))],
    ['Apple Pay', yesNo(card.wallets.applePay)],
    ['Google Pay', yesNo(card.wallets.googlePay)],
    [d.noId, card.noIdCheck ? d.yes : d.no],
    [d.countries, f.num(confirmedCountries(card))],
    [d.lastChecked, f.date(card.lastChecked)]
  ];
  const parts: [string, number, number][] = [
    [d.rewards, card.score.rewards, SCORE_WEIGHTS.rewards],
    [d.fees, card.score.fees, SCORE_WEIGHTS.fees],
    [d.coverage, card.score.coverage, SCORE_WEIGHTS.coverage],
    [d.banking, card.score.ecosystem, SCORE_WEIGHTS.ecosystem],
    [d.control, card.score.control, SCORE_WEIGHTS.control]
  ];
  const withGuide = new Set(countryGuides().map((g) => g.cc));
  const markets = locale.markets.map((cc) => ({ cc, name: f.country(cc), status: availabilityIn(card, cc), guide: withGuide.has(cc) }));
  const statusText = { yes: d.available, no: d.notAvailable, unknown: d.unconfirmed } as const;
  const statusBadge = { yes: 'badge-yes', no: 'badge-no', unknown: '' } as const;
  const main = markets[0];
  const fee = card.fees.annualUsd;
  const none = !card.cashback.basePct && !card.cashback.maxPct;
  const faq = [
    { q: fill(d.qFee, vars), a: fee == null ? d.aUnknown : fee === 0 ? d.aFeeNone : fill(d.aFeeYes, { fee: f.usd(fee) }) },
    {
      q: fill(d.qCb, vars),
      a: card.cashback.basePct == null && card.cashback.maxPct == null ? d.aUnknown : none ? d.aCbNone : fill(d.aCb, { cb: f.cashbackCell(card) })
    },
    { q: fill(d.qFx, vars), a: card.fees.fxPct == null ? d.aUnknown : card.fees.fxPct === 0 ? d.aFxNone : fill(d.aFx, { fx: f.pct(card.fees.fxPct) }) },
    ...(main
      ? [
          {
            q: fill(d.qWhere, { country: main.name, name: card.name }),
            a: main.status === 'yes' ? d.aWhereYes : main.status === 'no' ? d.aWhereNo : d.aWhereUnknown
          }
        ]
      : [])
  ];
  const path = intlCard(locale, card.slug);
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
        { '@type': 'ListItem', position: 2, name: card.name, item: absoluteUrl(path) }
      ]
    }
  ];

  return (
    <article className="wrap section stack" style={{ gap: 36, maxWidth: 920 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="stack" style={{ gap: 12 }}>
        <nav aria-label="Breadcrumb" className="faint" style={{ fontSize: 14 }}>
          <Link href={intlHome(locale)} style={{ textDecoration: 'none' }}>
            {d.allCards}
          </Link>{' '}
          /{' '}
          <span aria-current="page">
            <bdi>{card.name}</bdi>
          </span>
        </nav>
        <Eyebrow>{d.cardEyebrow}</Eyebrow>
        <h1 className="h2">
          <bdi>{card.name}</bdi>
        </h1>
        <p className="lead">{fill(d.cardLead, vars)}</p>
        <p style={{ margin: 0, maxWidth: '75ch' }}>
          <IntlText note={note(locale, card.summary)} label={d.inEnglish} />
        </p>
      </div>

      <div className="panel panel-pad ref-hero">
        <div className="ref-hero-art">
          <CardArt card={card} width={220} />
        </div>
        <div className="stack" style={{ gap: 14, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <b>
              {d.score} · {fill(d.rankOf, { rank: card.rank, n: total })}
            </b>
            <IntlScore value={card.score.total} label={d.score} />
          </div>
          {card.links.affiliate && card.signupBonus ? (
            <div className="stack" style={{ gap: 4 }}>
              <b>{d.bonus}</b>
              <p className="muted" style={{ margin: 0 }}>
                <IntlText note={note(locale, card.signupBonus)} label={d.inEnglish} />
              </p>
            </div>
          ) : null}
          {card.links.affiliate && card.referralCode ? (
            <p style={{ margin: 0 }}>
              {d.referralCode}
              {f.colon}
              <code className="mono">{card.referralCode}</code>
            </p>
          ) : null}
          <div className="pick-actions">
            <OutboundLink slug={card.slug} name={card.name} placement={`intl-${locale.code}-card`} className="btn btn-metal">
              {d.getCard}
            </OutboundLink>
            <Link href={`/cards/${card.slug}`} className="btn" lang="en" hrefLang="en">
              {d.fullReview}
            </Link>
          </div>
        </div>
      </div>

      {card.pros.length || card.cons.length ? (
        <div className="grid-2">
          {(
            [
              ['pros', d.prosTitle, card.pros],
              ['cons', d.consTitle, card.cons]
            ] as const
          )
            .filter(([, , xs]) => xs.length)
            .map(([id, title, xs]) => (
              <section key={id} aria-labelledby={id} className="panel panel-pad stack" style={{ gap: 10 }}>
                <h2 id={id} className="h3" style={{ margin: 0 }}>
                  {title}
                </h2>
                <ul className="vs-points" style={{ margin: 0 }}>
                  {xs.map((x) => (
                    <li key={x}>
                      <IntlText note={note(locale, x)} label={d.inEnglish} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      ) : null}

      <section aria-labelledby="facts" className="stack" style={{ gap: 12 }}>
        <h2 id="facts" className="h3">
          {d.factsTitle}
        </h2>
        <div className="table-wrap">
          <table className="table intl-table" style={{ minWidth: 0 }}>
            <tbody>
              {facts.map(([k, v]) => (
                <tr key={k}>
                  <th scope="row" style={{ fontWeight: 500 }}>
                    {k}
                  </th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {markets.length ? (
        <section aria-labelledby="where" className="stack" style={{ gap: 12 }}>
          <h2 id="where" className="h3">
            {d.whereTitle}
          </h2>
          <ul className="intl-markets">
            {markets.map((m) => (
              <li key={m.cc}>
                {m.guide ? <Link href={intlCountry(locale, countrySlug(m.cc))}>{m.name}</Link> : <span>{m.name}</span>}
                <span className={`badge ${statusBadge[m.status]}`}>{statusText[m.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {card.tiers.length > 1 ? (
        <section aria-labelledby="tiers" className="stack" style={{ gap: 12 }}>
          <h2 id="tiers" className="h3">
            {d.tiersTitle}
          </h2>
          <div className="table-wrap">
            <table className="table intl-table">
              <thead>
                <tr>
                  <th scope="col">{d.tier}</th>
                  <th scope="col">{d.costPerYear}</th>
                  <th scope="col">{d.cashback}</th>
                  <th scope="col">{d.monthlyCap}</th>
                </tr>
              </thead>
              <tbody>
                {card.tiers.map((t) => (
                  <tr key={t.name}>
                    <td>
                      {/* Plain-word tier names ("Virtual card") are translated; product names ("Platinum") stay. */}
                      <bdi>{noteOrNull(locale, t.name) ?? t.name}</bdi>
                    </td>
                    <td>{f.usdCell(t.feeUsdYear)}</td>
                    <td>{f.pctCell(t.cashbackPct)}</td>
                    <td>{t.capMonthlyUsd == null ? '–' : f.usd(t.capMonthlyUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="score" className="stack" style={{ gap: 12 }}>
        <h2 id="score" className="h3">
          {d.scoreTitle}
        </h2>
        <div className="table-wrap">
          <table className="table intl-table" style={{ minWidth: 0 }}>
            <tbody>
              {parts.map(([k, v, max]) => (
                <tr key={k}>
                  <th scope="row" style={{ fontWeight: 500 }}>
                    {k}
                  </th>
                  <td className="mono">
                    <bdi>
                      {f.num(v)} / {max}
                    </bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {d.howText}
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

      <nav aria-label={d.guides} className="stack" style={{ gap: 8 }}>
        <ul className="guide-links">
          <li>
            <Link href={intlAlternatives(locale, card.slug)}>{d.altLink}</Link>
          </li>
          {hasReferralPage(card) ? (
            <li>
              <Link href={intlReferral(locale, card.slug)}>{d.refLink}</Link>
            </li>
          ) : null}
          <li>
            <Link href={intlGuides(locale)}>{d.guidesTitle}</Link>
          </li>
        </ul>
      </nav>

      <p className="faint" style={{ fontSize: 13, margin: 0 }}>
        {d.cardNote}{' '}
        <Link href={`/cards/${card.slug}`} lang="en" hrefLang="en">
          {d.fullReview}
        </Link>
      </p>
    </article>
  );
}
