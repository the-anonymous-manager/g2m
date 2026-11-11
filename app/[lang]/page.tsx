import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCards, getRank, lastUpdated } from '@/lib/cards';
import type { Card } from '@/lib/types';
import { getSponsor } from '@/lib/sponsor';
import { getPicks, type HomePick } from '@/lib/picks';
import { countryGuides, countrySlug } from '@/lib/guides';
import { fill, hreflangOf, intlCard, intlCountry, intlHome, intlMethodology, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS, type Dict } from '@/lib/i18n/dict';
import { clean, formatters, type Fmt } from '@/lib/i18n/format';
import { note } from '@/lib/i18n/notes';
import { absoluteUrl, shareMeta, site } from '@/lib/site';
import { CardArt } from '@/components/CardArt';
import { ArrowIcon, Eyebrow } from '@/components/bits';
import { GlyphField } from '@/components/motion/GlyphField';
import { IntlCardList, IntlScore } from '@/components/IntlCardList';
import { IntlText } from '@/components/IntlText';
import { OutboundLink } from '@/components/OutboundLink';

// The home page in another language (/de, /ar ...), laid out like the English home page: the hero with the top
// spot, the numbers, new cards, the ranking, cards by country, our picks, how cards are judged and the tools. Every
// word comes from that language's dictionary and every value from the card data.
// Rendered on every request, like the English home page, so a sponsorship starts and ends on its dates.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ lang: string }> };

/** Cards shown before "Show all cards". */
const TOP = 10;

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

/** The three facts shown for a card in the hero and the picks. */
function Facts({ card, d, f, className }: { card: Card; d: Dict; f: Fmt; className: string }) {
  return (
    <dl className={className}>
      <div>
        <dt>{d.cashback}</dt>
        <dd>{f.cashbackCell(card)}</dd>
      </div>
      <div>
        <dt>{d.annualFee}</dt>
        <dd>{f.usdCell(card.fees.annualUsd)}</dd>
      </div>
      <div>
        <dt>{d.fxFee}</dt>
        <dd>{f.pctCell(card.fees.fxPct)}</dd>
      </div>
    </dl>
  );
}

/** The sign-up bonus line, translated (or the English, marked as English, until it is). */
function Bonus({ card, d, f, locale }: { card: Card; d: Dict; f: Fmt; locale: NonNullable<ReturnType<typeof localeByCode>> }) {
  if (!card.links.affiliate || !card.signupBonus) return null;
  return (
    <p className="bonus-line">
      <strong>
        {d.bonus}
        {f.colon}
      </strong>
      <IntlText note={note(locale, card.signupBonus)} label={d.inEnglish} />
    </p>
  );
}

/** A pick's badge and line in this language. The automatic picks have fixed English labels in lib/picks.ts. */
function pickWords(p: HomePick, d: Dict, locale: NonNullable<ReturnType<typeof localeByCode>>): { label: string; note: React.ReactNode } {
  if (p.kind === 'featured' || p.kind === 'pick') {
    // "Why" is typed in the sheet's Picks tab: shown when translated, else in English, marked.
    return { label: p.kind === 'featured' ? d.pickFeatured : d.pickOur, note: p.note ? <IntlText note={note(locale, p.note)} label={d.inEnglish} /> : null };
  }
  if (p.kind === 'new') return { label: d.newTitle, note: d.pickNewNote };
  if (p.label === 'Best with no annual fee') return { label: d.pickNoFee, note: d.pickNoFeeNote };
  if (p.label === 'Best non-custodial') return { label: d.pickNonCustodial, note: d.pickNonCustodialNote };
  return { label: d.pickTop, note: fill(d.pickTopNote, { score: p.card.score.total }) };
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
  const nonCustodial = cards.filter((c) => c.custody === 'self-custodial' || c.custody === 'both').length;
  // The top spot, as on the English home page: a paid booking while its dates run (always marked Sponsored), or
  // G2M's own pick, else the top-ranked card.
  const booked = getSponsor();
  const sponsor = booked?.paid ? booked.card : null;
  const ourPick = booked && !booked.paid ? booked.card : null;
  const featured = booked?.card ?? cards[0];
  const picks = getPicks(cards);
  const anyFeatured = picks.some((p) => p.kind === 'featured');
  const newest = cards
    .filter((c) => c.addedOn)
    .sort((a, b) => b.addedOn!.localeCompare(a.addedOn!) || a.rank - b.rank)
    .slice(0, 3);
  const top = f.list(cards.slice(0, 3).map((c) => `${f.name(c.name)} (${c.score.total}/100)`));
  // This language's own markets first, then the countries with the most confirmed cards.
  const guides = countryGuides();
  const withGuide = new Set(guides.map((g) => g.cc));
  const countries = [...locale.markets.filter((cc) => withGuide.has(cc)), ...guides.map((g) => g.cc).filter((cc) => !locale.markets.includes(cc))].slice(0, 30);
  const faq = [
    { q: d.q1, a: d.a1 },
    { q: d.q2, a: fill(d.a2, { top }) },
    { q: d.q3, a: fill(d.a3, { nofee: noFee, n: cards.length }) }
  ];
  const tools: [string, string, string][] = [
    ['/finder', d.toolFinder, d.toolFinderText],
    ['/calculator', d.toolCalc, d.toolCalcText],
    ['/wallet', d.toolWallet, d.toolWalletText],
    ['/receipt', d.toolReceipt, d.toolReceiptText],
    ['/corridors', d.toolCorridor, d.toolCorridorText],
    ['/compare', d.toolCompare, d.toolCompareText]
  ];
  const clean = (s: string) => s.replace(/[⁦-⁩]/g, '');
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: hreflangOf(locale),
      mainEntity: faq.map((x) => ({ '@type': 'Question', name: clean(x.q), acceptedAnswer: { '@type': 'Answer', text: clean(x.a) } }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: fill(d.homeH1, vars),
      inLanguage: hreflangOf(locale),
      itemListElement: cards.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(intlCard(locale, c.slug)), name: c.name }))
    }
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <div className="hero-shell">
        <GlyphField />
        <section className="wrap hero">
          <div className="hero-copy">
            <h1 className="eyebrow" style={{ margin: 0 }}>
              [ {fill(d.homeH1, vars)} ]
            </h1>
            <p className="h1" style={{ margin: 0 }}>
              <span className="line">{d.heroLine1}</span>
              <br />
              <span className="line">
                <span className="metal-text" style={{ fontStyle: 'italic', paddingInlineEnd: '0.08em' }}>
                  {d.heroLine2}
                </span>
              </span>
            </p>
            <p className="lead">{fill(d.homeLead, vars)}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
              <a href="#ranking" style={{ padding: '10px 0', fontWeight: 600, textUnderlineOffset: 4 }}>
                {d.heroRanking}
              </a>
              <Link href="/finder" lang="en" hrefLang="en" style={{ padding: '10px 0', fontWeight: 600, textUnderlineOffset: 4 }}>
                {d.heroFinder}
              </Link>
            </div>
          </div>
          <aside className="hero-feature" data-tilt aria-label={sponsor ? d.pickFeatured : ourPick ? d.pickOur : d.pickTop}>
            <CardArt card={featured} />
            <div className="panel panel-pad hero-feature-panel">
              <div className="hero-feature-head">
                <Eyebrow>{sponsor ? d.spotFeatured : ourPick ? d.spotPick : d.spotTop}</Eyebrow>
                <span className="mono faint" style={{ fontSize: 12 }}>
                  {fill(d.rankOf, { rank: getRank(featured.slug), n: cards.length })}
                </span>
              </div>
              <div className="hero-feature-title">
                <h2 className="h3">
                  <bdi>{featured.name}</bdi>
                </h2>
                <IntlScore value={featured.score.total} label={d.score} />
              </div>
              <Facts card={featured} d={d} f={f} className="hero-feature-facts" />
              <Bonus card={featured} d={d} f={f} locale={locale} />
              <div className="hero-feature-actions">
                <OutboundLink
                  slug={featured.slug}
                  name={featured.name}
                  placement={`intl-${locale.code}-${sponsor ? 'hero-sponsored' : ourPick ? 'hero-pick' : 'hero-top'}`}
                  campaign={sponsor ? 'sponsored' : undefined}
                  className="btn btn-metal btn-sm"
                >
                  {d.getCard}
                </OutboundLink>
                <Link href={intlCard(locale, featured.slug)} className="btn btn-sm">
                  {d.details}
                </Link>
              </div>
              <p className="faint" style={{ fontSize: 13, margin: 0 }}>
                {sponsor ? (
                  <>
                    {d.spotSponsored} <Link href={intlMethodology(locale)}>{d.moneyLink}</Link>
                  </>
                ) : ourPick ? (
                  d.spotPickNote
                ) : (
                  d.spotTopNote
                )}
              </p>
            </div>
          </aside>
        </section>
      </div>

      {/* Numbers */}
      <section className="wrap section-tight">
        <div className="panel panel-pad stats" style={{ justifyContent: 'space-between' }}>
          <div className="stat">
            <b>{f.num(cards.length)}</b>
            <span>{d.statCards}</span>
          </div>
          <div className="stat">
            <b>{f.num(nonCustodial)}</b>
            <span>{d.nonCustodial}</span>
          </div>
          <div className="stat">
            <b>{f.num(noFee)}</b>
            <span>{d.statNoFee}</span>
          </div>
          <div className="stat">
            <b>{f.num(5)}</b>
            <span>{d.statMarkets}</span>
          </div>
          <div className="stat">
            <b style={{ fontSize: '1.15rem', paddingBlock: 6 }}>{f.date(lastUpdated())}</b>
            <span>{d.lastChecked}</span>
          </div>
        </div>
      </section>

      {/* New on G2M */}
      {newest.length ? (
        <section className="wrap section-tight stack" style={{ gap: 14 }} aria-labelledby="new">
          <div className="stack" style={{ gap: 8 }}>
            <Eyebrow>{d.newEyebrow}</Eyebrow>
            <h2 id="new" className="h3" style={{ margin: 0 }}>
              {d.newTitle}
            </h2>
          </div>
          <div className="grid-3">
            {newest.map((c) => (
              <Link key={c.slug} href={intlCard(locale, c.slug)} className="panel new-card">
                <span className="new-card-art">
                  <CardArt card={c} width={96} />
                </span>
                <span className="stack" style={{ gap: 4, minWidth: 0 }}>
                  <span className="new-card-name">
                    <bdi>{c.name}</bdi>
                  </span>
                  <span className="faint mono" style={{ fontSize: 12 }}>
                    {fill(d.addedOn, { date: f.date(c.addedOn!) })}
                  </span>
                  <span className="muted" style={{ fontSize: 14 }}>
                    {d.cashback}
                    {f.colon}
                    {f.cashbackCell(c)} · {d.annualFee}
                    {f.colon}
                    {f.usdCell(c.fees.annualUsd)}
                  </span>
                </span>
                <IntlScore value={c.score.total} label={d.score} showBar={false} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* The ranking: the top ten, then the rest behind "Show all" (still in the page for search engines) */}
      <section id="ranking" className="wrap section stack" style={{ gap: 20, scrollMarginTop: 90 }} aria-labelledby="ranking-title">
        <div className="stack" style={{ gap: 8 }}>
          <Eyebrow>{d.topEyebrow}</Eyebrow>
          <h2 id="ranking-title" className="h2">
            {d.rankingTitle}
          </h2>
        </div>
        <IntlCardList cards={cards.slice(0, TOP)} locale={locale} d={d} f={f} placement={`intl-${locale.code}-home`} />
        {cards.length > TOP ? (
          <details className="rank-more">
            <summary className="btn" style={{ alignSelf: 'flex-start', listStyle: 'none', cursor: 'pointer' }}>
              {fill(d.showAll, { n: cards.length })} <ArrowIcon />
            </summary>
            <div style={{ marginTop: 14 }}>
              <IntlCardList cards={cards.slice(TOP)} locale={locale} d={d} f={f} placement={`intl-${locale.code}-home`} start={TOP + 1} />
            </div>
          </details>
        ) : null}
      </section>

      {/* Cards by country */}
      {countries.length ? (
        <section className="wrap section stack" style={{ gap: 20 }} aria-labelledby="countries">
          <div className="stack" style={{ gap: 8 }}>
            <Eyebrow>{d.regionsEyebrow}</Eyebrow>
            <h2 id="countries" className="h2">
              {d.countriesTitle}
            </h2>
            <p className="lead">{d.regionsLead}</p>
          </div>
          <ul className="guide-links">
            {countries.map((cc) => (
              <li key={cc}>
                <Link href={intlCountry(locale, countrySlug(cc))}>{f.country(cc)}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Our picks */}
      <section className="wrap section stack" style={{ gap: 20 }} aria-labelledby="picks">
        <div className="stack" style={{ gap: 8 }}>
          <Eyebrow>{d.picksEyebrow}</Eyebrow>
          <h2 id="picks" className="h2">
            {d.picksTitle}
          </h2>
        </div>
        <div className="grid-3 picks-grid">
          {picks.map((p) => {
            const w = pickWords(p, d, locale);
            return (
              <article key={p.slot} className="panel panel-pad stack pick-card" data-kind={p.kind}>
                <div className="pick-head">
                  <span className={`badge ${p.kind === 'featured' ? 'badge-warn' : p.kind === 'new' ? 'badge-yes' : 'badge-accent'}`}>{w.label}</span>
                  <IntlScore value={p.card.score.total} label={d.score} />
                </div>
                <Link href={intlCard(locale, p.card.slug)} className="pick-art" aria-label={p.card.name}>
                  <CardArt card={p.card} />
                </Link>
                <h3 className="h3" style={{ margin: 0 }}>
                  <Link href={intlCard(locale, p.card.slug)} style={{ textDecoration: 'none' }}>
                    <bdi>{p.card.name}</bdi>
                  </Link>
                </h3>
                {w.note ? (
                  <p className="muted" style={{ margin: 0 }}>
                    {w.note}
                  </p>
                ) : null}
                {p.kind === 'featured' ? <p className="faint pick-paid">{d.pickSponsored}</p> : null}
                <Facts card={p.card} d={d} f={f} className="pick-facts" />
                <Bonus card={p.card} d={d} f={f} locale={locale} />
                <div className="pick-actions">
                  <OutboundLink
                    slug={p.card.slug}
                    name={p.card.name}
                    placement={`intl-${locale.code}-pick-${p.slot}`}
                    campaign={p.kind === 'featured' ? 'sponsored' : undefined}
                    className="btn btn-metal btn-sm"
                  >
                    {d.getCard}
                  </OutboundLink>
                  <Link href={intlCard(locale, p.card.slug)} className="btn btn-sm">
                    {d.details}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
        {anyFeatured ? (
          <p className="faint" style={{ fontSize: 13, margin: 0 }}>
            {d.pickSponsored} <Link href={intlMethodology(locale)}>{d.moneyLink}</Link>
          </p>
        ) : null}
      </section>

      {/* How cards are judged */}
      <section className="wrap section stack" style={{ gap: 20 }} aria-labelledby="how">
        <div className="stack" style={{ gap: 8 }}>
          <Eyebrow>{d.howEyebrow}</Eyebrow>
          <h2 id="how" className="h2">
            {d.howH2}
          </h2>
        </div>
        <div className="grid-3">
          {(
            [
              [d.how1Title, d.how1],
              [d.how2Title, d.how2],
              [d.how3Title, d.how3]
            ] as const
          ).map(([t, x]) => (
            <div key={t} className="panel panel-pad stack" style={{ gap: 10 }}>
              <h3 className="h3">{t}</h3>
              <p className="muted">{x}</p>
            </div>
          ))}
        </div>
        <p className="muted" style={{ margin: 0, maxWidth: '75ch' }}>
          {d.howText}
        </p>
        <Link href={intlMethodology(locale)} style={{ fontWeight: 600, textUnderlineOffset: 4, alignSelf: 'flex-start', padding: '8px 0' }}>
          {d.methodLink}
        </Link>
      </section>

      {/* Tools (English pages) */}
      <section className="wrap section stack" style={{ gap: 20 }} aria-labelledby="tools">
        <h2 id="tools" className="h3">
          {d.toolsTitle}
        </h2>
        <div className="grid-3">
          {tools.map(([href, t, x]) => (
            <Link key={href} href={href} hrefLang="en" className="panel panel-pad stack" style={{ gap: 10, textDecoration: 'none' }}>
              <span className="h3">{t}</span>
              <span className="muted">{x}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Questions */}
      <section className="wrap section stack" style={{ gap: 14 }} aria-labelledby="faq">
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
        <p className="faint" style={{ fontSize: 13, margin: 0 }}>
          {fill(d.builtNote, { date: f.date(lastUpdated()) })}
        </p>
      </section>
    </>
  );
}
