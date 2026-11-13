import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCards, getRank, lastUpdated } from '@/lib/cards';
import type { Card } from '@/lib/types';
import { getSponsor } from '@/lib/sponsor';
import { getPicks, type HomePick } from '@/lib/picks';
import { fill, hreflangOf, intlCard, intlHome, intlMethodology, intlRankings, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS, type Dict } from '@/lib/i18n/dict';
import { clean, formatters, type Fmt } from '@/lib/i18n/format';
import { note } from '@/lib/i18n/notes';
import { absoluteUrl, metaDescription, metaTitle, shareMeta, site } from '@/lib/site';
import { CardArt } from '@/components/CardArt';
import { HomeLeaderboard } from '@/components/HomeLeaderboard';
import { MarketPanels, type MarketPanel } from '@/components/MarketPanels';
import { UI } from '@/lib/i18n/ui';
import { ASIA } from '@/lib/countries.mjs';
import { COUNTRIES, availabilityIn } from '@/lib/regions';
import { toRow, type Market } from '@/lib/types';
import { ArrowIcon, Eyebrow, SearchIcon } from '@/components/bits';
import { GlyphField } from '@/components/motion/GlyphField';
import { IntlScore } from '@/components/IntlCardList';
import { IntlText } from '@/components/IntlText';
import { OutboundLink } from '@/components/OutboundLink';
import { BookSpotForm } from '@/components/BookSpotForm';

// The home page in another language (/de, /ar ...), section for section the same as the English home page
// (app/(en)/page.tsx): hero with search and the top spot, the numbers, New on G2M, the top-5 leaderboard, cards
// confirmed where you live, our picks, how cards are judged and the tools. Words come from the language's dictionary
// (lib/i18n/dict) and, for the interactive parts, its tool pack (lib/i18n/ui); values come from the card data.
// Rendered on every request, like the English home page, so a sponsorship starts and ends on its dates.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ lang: string }> };

const MARKETS: Market[] = ['US', 'GB', 'EU'];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) return {};
  const d = DICTS[locale.code];
  const vars = { year: new Date().getUTCFullYear(), n: getCards().length };
  const title = fill(d.homeTitle, vars);
  const description = fill(d.homeDesc, vars);
  return {
    title: metaTitle(title),
    description: metaDescription(description),
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
  const ui = UI[locale.code];
  const rows = cards.map(toRow);
  const prefix = `/${locale.code}`;
  const rankings = intlRankings(locale);
  // Country names from the server, so the leaderboard and panels match in the browser (see intlFmt).
  const countryNames = Object.fromEntries(COUNTRIES.map((c) => [c.code, f.country(c.code)]));
  // The same four panels as the English home page: the US, the UK, the EU, then Asia as a whole.
  const panels: MarketPanel[] = [
    ...MARKETS.map((m) => {
      const list = cards.filter((c) => c.coverage.markets[m] === 'yes');
      return {
        key: m,
        title: m === 'EU' ? ui.regions.EU : f.country(m),
        href: m === 'EU' ? `${rankings}?region=EU` : `${rankings}?country=${m}`,
        count: list.length,
        cards: list.slice(0, 3).map((c) => ({ row: toRow(c) }))
      };
    }),
    (() => {
      const asia = cards
        .map((c) => ({ c, n: ASIA.filter((cc: string) => availabilityIn(c, cc) === 'yes').length }))
        .filter((x) => x.n > 0);
      return {
        key: 'ASIA',
        title: ui.regions.ASIA,
        href: `${rankings}?region=ASIA`,
        count: asia.length,
        cards: asia.slice(0, 3).map(({ c, n }) => ({ row: toRow(c), note: fill(ui.home.asiaN, { n }) }))
      };
    })()
  ];
  const tools: [string, string, string, string][] = [
    [`${prefix}/finder`, d.toolFinderTag, d.toolFinder, d.toolFinderText],
    [`${prefix}/calculator`, d.toolCalcTag, d.toolCalc, d.toolCalcText],
    [`${prefix}/wallet`, d.toolWalletTag, d.toolWallet, d.toolWalletText],
    [`${prefix}/receipt`, d.toolReceiptTag, d.toolReceipt, d.toolReceiptText],
    [`${prefix}/corridors`, d.toolCorridorTag, d.toolCorridor, d.toolCorridorText],
    [`${prefix}/compare`, d.toolCompareTag, d.toolCompare, d.toolCompareText]
  ];
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: fill(d.homeH1, vars),
      inLanguage: hreflangOf(locale),
      itemListElement: cards.slice(0, 10).map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(intlCard(locale, c.slug)), name: c.name }))
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
            <p className="lead">{d.heroLead}</p>
            {/* Searches this language's rankings table, like the English search box searches /cards. */}
            <form action={rankings} method="get" role="search" className="search">
              <label htmlFor="home-q" className="sr-only">
                {d.searchLabel}
              </label>
              <SearchIcon />
              <input id="home-q" name="q" type="search" placeholder={d.searchPlaceholder} autoComplete="off" />
              <button type="submit" className="btn btn-metal">
                {d.searchButton}
              </button>
            </form>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
              <Link href={`${rankings}?country=all`} style={{ padding: '10px 0', fontWeight: 600, textUnderlineOffset: 4 }}>
                {fill(d.seeAllN, { n: cards.length })}
              </Link>
              <Link href={`${prefix}/finder`} style={{ padding: '10px 0', fontWeight: 600, textUnderlineOffset: 4 }}>
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
                    {' · '}
                    <a href="#book-top">{UI[locale.code].book.bookTop}</a>
                  </>
                ) : ourPick ? (
                  <>
                    {d.spotPickNote} <a href="#book-top">{UI[locale.code].book.bookTop}</a>
                  </>
                ) : (
                  <>
                    {d.spotTopNote} <a href="#book-top">{d.bookSpot}</a>
                  </>
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
          <div className="pager" style={{ alignItems: 'flex-end' }}>
            <div className="stack" style={{ gap: 8 }}>
              <Eyebrow>{d.newEyebrow}</Eyebrow>
              <h2 id="new" className="h3" style={{ margin: 0 }}>
                {d.newTitle}
              </h2>
            </div>
            <Link href={`${rankings}?country=all`} className="muted" style={{ fontSize: 15 }}>
              {fill(d.seeAllN, { n: cards.length })}
            </Link>
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
                  {c.links.affiliate && c.signupBonus ? (
                    <span className="bonus-line">
                      <strong>
                        {d.bonus}
                        {f.colon}
                      </strong>
                      <IntlText note={note(locale, c.signupBonus)} label={d.inEnglish} />
                    </span>
                  ) : null}
                </span>
                <IntlScore value={c.score.total} label={d.score} showBar={false} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Leaderboard: the top five, for the visitor's country when known */}
      <section className="wrap section stack" style={{ gap: 20 }} aria-labelledby="top">
        <div className="pager" style={{ alignItems: 'flex-end' }}>
          <div className="stack" style={{ gap: 8 }}>
            <Eyebrow>{d.topEyebrow}</Eyebrow>
            <h2 id="top" className="h2">
              {d.topTitle}
            </h2>
          </div>
          <Link href={rankings} className="btn">
            {d.fullRankings} <ArrowIcon />
          </Link>
        </div>
        <HomeLeaderboard rows={rows} ui={ui} tag={locale.tag} prefix={prefix} countryNames={countryNames} />
      </section>

      {/* Markets */}
      <section className="wrap section stack" style={{ gap: 20 }} aria-labelledby="regions">
        <div className="stack" style={{ gap: 8 }}>
          <Eyebrow>{d.regionsEyebrow}</Eyebrow>
          <h2 id="regions" className="h2">
            {d.regionsTitle}
          </h2>
          <p className="lead">{d.regionsLead}</p>
        </div>
        <MarketPanels rows={rows} panels={panels} ui={ui} tag={locale.tag} prefix={prefix} countryNames={countryNames} />
      </section>

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
        <BookSpotForm
          cards={cards.map((c) => ({ slug: c.slug, name: c.name }))}
          email={site.contactEmail}
          words={UI[locale.code].book}
          tag={locale.tag}
          lang={locale.code}
          before={
            anyFeatured ? (
              <>
                {d.pickSponsored} <Link href={intlMethodology(locale)}>{d.moneyLink}</Link>.{' '}
              </>
            ) : null
          }
        />
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
        <Link href={intlMethodology(locale)} style={{ fontWeight: 600, textUnderlineOffset: 4, alignSelf: 'flex-start', padding: '8px 0' }}>
          {d.methodLink}
        </Link>
      </section>

      {/* Tools (the tool pages are in English for now; the header says so) */}
      <section className="wrap section" aria-labelledby="tools">
        <h2 id="tools" className="sr-only">
          {d.toolsTitle}
        </h2>
        <div className="grid-3">
          {tools.map(([href, tag, t, x]) => (
            <Link key={href} href={href} hrefLang={href.startsWith(prefix) ? undefined : 'en'} className="panel panel-pad stack" style={{ gap: 10, textDecoration: 'none' }}>
              <span className="eyebrow">[ {tag} ]</span>
              <span className="h3">{t}</span>
              <span className="muted">{x}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
