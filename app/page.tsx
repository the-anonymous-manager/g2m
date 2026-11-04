import type { Metadata } from 'next';
import Link from 'next/link';
import { getCards, getRank, lastUpdated } from '@/lib/cards';
import { getSponsor } from '@/lib/sponsor';
import { getPicks } from '@/lib/picks';
import { OutboundLink } from '@/components/OutboundLink';
import { HomeLeaderboard } from '@/components/HomeLeaderboard';
import { GlyphField } from '@/components/motion/GlyphField';
import { MarketPanels, type MarketPanel } from '@/components/MarketPanels';
import { toRow, type Card, type Market } from '@/lib/types';
import { MARKET_LABELS, availabilityIn } from '@/lib/regions';
import { ASIA } from '@/lib/countries.mjs';
import { cashbackLabel, fmtDate, pct, usd } from '@/lib/format';
import { site } from '@/lib/site';
import { CardArt } from '@/components/CardArt';
import { ArrowIcon, Eyebrow, MarketBadge, ScorePill, SearchIcon } from '@/components/bits';

const MARKETS: Market[] = ['US', 'GB', 'EU'];

// Rendered fresh on every request (not cached/ISR) so a sponsorship starts and ends on its dates without a new
// deploy, and so the page works the same on hosts with no incremental-cache storage configured.
export const dynamic = 'force-dynamic';

// The words people search for ("best crypto cards 2026") in the title, which search results show.
export function generateMetadata(): Metadata {
  const year = new Date().getUTCFullYear();
  const n = getCards().length;
  return {
    title: { absolute: `Best Crypto Cards ${year}: Fees, Cashback & Rewards Compared · ${site.name}` },
    description: `Compare ${n} crypto cards side by side: cashback, annual and FX fees, where each card works, sign-up bonuses and no-KYC options. Every card ranked by the same rules.`
  };
}

/** What the site is, for search engines: the site with its card search, who runs it, and the top of the ranking. */
function homeJsonLd(cards: Card[]) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: site.name,
      alternateName: site.expansion,
      url: site.url,
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${site.url}/cards?q={search_term_string}` },
        'query-input': 'required name=search_term_string'
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: site.name,
      url: site.url,
      logo: `${site.url}/brand/g2m-mark-512.png`,
      ...(site.twitter ? { sameAs: [`https://x.com/${site.twitter.replace(/^@/, '')}`] } : {})
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Top crypto cards by G2M score',
      itemListElement: cards.slice(0, 10).map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        url: `${site.url}/cards/${c.slug}`
      }))
    }
  ];
}

function confirmedIn(cards: Card[], m: Market) {
  return cards.filter((c) => c.coverage.markets[m] === 'yes');
}

// One panel each for the US, the UK and the EU, then Asia as a whole: a card counts there when it is
// confirmed in at least one Asian country, and says how many.
function regionPanels(cards: Card[]): MarketPanel[] {
  const panels: MarketPanel[] = MARKETS.map((m) => {
    const list = confirmedIn(cards, m);
    return {
      key: m,
      title: MARKET_LABELS[m],
      // The EU is a group of countries: its link opens the rankings for the whole region.
      href: m === 'EU' ? '/cards?region=EU' : `/cards?country=${m}`,
      count: list.length,
      cards: list.slice(0, 3).map((c) => ({ row: toRow(c) }))
    };
  });
  const asia = cards
    .map((c) => ({ c, n: ASIA.filter((cc) => availabilityIn(c, cc) === 'yes').length }))
    .filter((x) => x.n > 0);
  panels.push({
    key: 'ASIA',
    title: 'Asia',
    href: '/cards?region=ASIA',
    count: asia.length,
    cards: asia.slice(0, 3).map(({ c, n }) => ({ row: toRow(c), note: `${n} ${n === 1 ? 'country' : 'countries'} in Asia` }))
  });
  return panels;
}

export default function HomePage() {
  const cards = getCards();
  const rows = cards.map(toRow);
  // The top spot: a paid booking while its dates run (labelled Sponsored), or G2M's own pick, else the top-ranked card.
  const booked = getSponsor();
  const sponsor = booked?.paid ? booked.card : null;
  const ourPick = booked && !booked.paid ? booked.card : null;
  const picks = getPicks(cards);
  const anyFeatured = picks.some((p) => p.kind === 'featured');
  const featured = booked?.card ?? cards[0];
  const selfCustodial = cards.filter((c) => c.custody === 'self-custodial' || c.custody === 'both').length;
  const noFee = cards.filter((c) => c.fees.annualUsd === 0).length;
  // The three cards listed most recently (addedOn is set by the sheet sync on the day a card first appears).
  const newest = cards
    .filter((c) => c.addedOn)
    .sort((a, b) => b.addedOn!.localeCompare(a.addedOn!) || a.rank - b.rank)
    .slice(0, 3);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd(cards)) }} />
      {/* Hero */}
      <div className="hero-shell">
        <GlyphField />
        <section className="wrap hero">
          <div className="hero-copy">
            <h1 className="eyebrow" style={{ margin: 0 }}>
              [ Best crypto cards of {new Date().getUTCFullYear()}, compared ]
            </h1>
            <p className="h1" style={{ margin: 0 }}>
              <span className="line">Spend your</span>
              <br />
              <span className="line">
                <span className="metal-text" style={{ fontStyle: 'italic', paddingRight: '0.08em' }}>
                  bags better.
                </span>
              </span>
            </p>
            <p className="lead">
              {site.subline} Every crypto card ranked on rewards, fees and where it actually works, so you can pick the one
              that pays you back.
            </p>
            <form action="/cards" method="get" role="search" className="search">
              <label htmlFor="home-q" className="sr-only">
                Search cards
              </label>
              <SearchIcon />
              <input id="home-q" name="q" type="search" placeholder="Search a card, brand or region" autoComplete="off" />
              <button type="submit" className="btn btn-metal">
                Search
              </button>
            </form>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
              <Link href="/cards?country=all" style={{ padding: '10px 0', fontWeight: 600, textUnderlineOffset: 4 }}>
                See all {cards.length} cards
              </Link>
              <Link href="/finder" style={{ padding: '10px 0', fontWeight: 600, textUnderlineOffset: 4 }}>
                Find your best card
              </Link>
            </div>
          </div>
          <aside className="hero-feature" data-tilt aria-label={sponsor ? 'Featured card (sponsored)' : ourPick ? 'Our pick' : 'Top-ranked card'}>
            <CardArt card={featured} />
            <div className="panel panel-pad hero-feature-panel">
              <div className="hero-feature-head">
                <Eyebrow>{sponsor ? 'featured' : ourPick ? 'our pick' : 'top ranked'}</Eyebrow>
                <span className="mono faint" style={{ fontSize: 12 }}>
                  #{getRank(featured.slug)} of {cards.length} worldwide
                </span>
              </div>
              <div className="hero-feature-title">
                <h2 className="h3">{featured.name}</h2>
                <ScorePill value={featured.score.total} />
              </div>
              <dl className="hero-feature-facts">
                <div>
                  <dt>Cashback</dt>
                  <dd>{cashbackLabel(featured.cashback.basePct, featured.cashback.maxPct)}</dd>
                </div>
                <div>
                  <dt>Annual fee</dt>
                  <dd>{usd(featured.fees.annualUsd)}</dd>
                </div>
                <div>
                  <dt>FX fee</dt>
                  <dd>{pct(featured.fees.fxPct)}</dd>
                </div>
              </dl>
              {featured.links.affiliate && featured.signupBonus ? (
                <p className="bonus-line">
                  <strong>Sign-up bonus:</strong> {featured.signupBonus}
                </p>
              ) : null}
              <div className="hero-feature-actions">
                <OutboundLink
                  slug={featured.slug}
                  name={featured.name}
                  placement={sponsor ? 'hero-sponsored' : ourPick ? 'hero-pick' : 'hero-top'}
                  campaign={sponsor ? 'sponsored' : undefined}
                  className="btn btn-metal btn-sm"
                >
                  Get the card
                </OutboundLink>
                <Link href={`/cards/${featured.slug}`} className="btn btn-sm">
                  Read the review
                </Link>
              </div>
              <p className="faint" style={{ fontSize: 13, margin: 0 }}>
                {sponsor ? (
                  <>
                    Sponsored. It never changes a card&apos;s score or rank.{' '}
                    <Link href="/methodology#money">How G2M makes money</Link>
                  </>
                ) : ourPick ? (
                  'Our pick, chosen by G2M.'
                ) : (
                  <>
                    The highest G2M score worldwide right now. Card issuers can{' '}
                    <a href={`mailto:${site.contactEmail}?subject=${encodeURIComponent('Featured spot on G2M')}`}>
                      book this spot
                    </a>{' '}
                    as a labelled sponsor.
                  </>
                )}
              </p>
            </div>
          </aside>
        </section>
      </div>

      {/* Stats */}
      <section className="wrap section-tight">
        <div className="panel panel-pad stats" style={{ justifyContent: 'space-between' }}>
          <div className="stat">
            <b data-count>{cards.length}</b>
            <span>Cards tracked</span>
          </div>
          <div className="stat">
            <b data-count>{selfCustodial}</b>
            <span>Non-custodial</span>
          </div>
          <div className="stat">
            <b data-count>{noFee}</b>
            <span>No annual fee</span>
          </div>
          <div className="stat">
            <b>5</b>
            <span>Markets checked</span>
          </div>
          <div className="stat">
            <b style={{ fontSize: '1.15rem', paddingBlock: 6 }}>{fmtDate(lastUpdated())}</b>
            <span>Last checked</span>
          </div>
        </div>
      </section>

      {/* New on G2M: the three latest cards */}
      {newest.length ? (
        <section className="wrap section-tight stack" style={{ gap: 14 }} aria-labelledby="new">
          <div className="pager" style={{ alignItems: 'flex-end' }}>
            <div className="stack" style={{ gap: 8 }}>
              <Eyebrow>just added</Eyebrow>
              <h2 id="new" className="h3" style={{ margin: 0 }}>
                New on G2M
              </h2>
            </div>
            <Link href="/cards?country=all" className="muted" style={{ fontSize: 15 }}>
              See all {cards.length} cards
            </Link>
          </div>
          <div className="grid-3">
            {newest.map((c) => (
              <Link key={c.slug} href={`/cards/${c.slug}`} className="panel new-card">
                <span className="new-card-art">
                  <CardArt card={c} width={96} />
                </span>
                <span className="stack" style={{ gap: 4, minWidth: 0 }}>
                  <span className="new-card-name">{c.name}</span>
                  <span className="faint mono" style={{ fontSize: 12 }}>
                    Added {fmtDate(c.addedOn!)}
                  </span>
                  <span className="muted" style={{ fontSize: 14 }}>
                    {cashbackLabel(c.cashback.basePct, c.cashback.maxPct)} back ·{' '}
                    {c.fees.annualUsd === 0 ? 'no annual fee' : c.fees.annualUsd == null ? 'fee not published' : `${usd(c.fees.annualUsd)} a year`}
                  </span>
                  {c.links.affiliate && c.signupBonus ? (
                    <span className="bonus-line">
                      <strong>Sign-up bonus:</strong> {c.signupBonus}
                    </span>
                  ) : null}
                </span>
                <ScorePill value={c.score.total} showBar={false} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Leaderboard preview */}
      <section className="wrap section stack" style={{ gap: 20 }} aria-labelledby="top">
        <div className="pager" style={{ alignItems: 'flex-end' }}>
          <div className="stack" style={{ gap: 8 }}>
            <Eyebrow>leaderboard</Eyebrow>
            <h2 id="top" className="h2">
              Top crypto cards right now
            </h2>
          </div>
          <Link href="/cards" className="btn">
            Full rankings <ArrowIcon />
          </Link>
        </div>
        <HomeLeaderboard rows={rows} />
      </section>

      {/* Markets */}
      <section className="wrap section stack" style={{ gap: 20 }} aria-labelledby="regions">
        <div className="stack" style={{ gap: 8 }}>
          <Eyebrow>where you live matters</Eyebrow>
          <h2 id="regions" className="h2">
            Cards confirmed where you live
          </h2>
          <p className="lead">
            A card is only useful if you can get it. We check every card country by country, and say clearly when an
            issuer has not confirmed a country.
          </p>
        </div>
        <MarketPanels rows={rows} panels={regionPanels(cards)} />
      </section>

      {/* Our picks: three slots, each an editorial pick or a labelled sponsorship (data/picks.json), else automatic. */}
      <section className="wrap section stack" style={{ gap: 20 }} aria-labelledby="picks">
        <div className="stack" style={{ gap: 8 }}>
          <Eyebrow>our picks</Eyebrow>
          <h2 id="picks" className="h2">
            Three cards worth a look
          </h2>
        </div>
        <div className="grid-3 picks-grid">
          {picks.map((p) => (
            <article key={p.slot} className="panel panel-pad stack pick-card" data-kind={p.kind}>
              <div className="pick-head">
                <span className={`badge ${p.kind === 'featured' ? 'badge-warn' : p.kind === 'new' ? 'badge-yes' : 'badge-accent'}`}>{p.label}</span>
                <ScorePill value={p.card.score.total} />
              </div>
              <Link href={`/cards/${p.card.slug}`} className="pick-art" aria-label={p.card.name}>
                <CardArt card={p.card} />
              </Link>
              <h3 className="h3" style={{ margin: 0 }}>
                <Link href={`/cards/${p.card.slug}`} style={{ textDecoration: 'none' }}>
                  {p.card.name}
                </Link>
              </h3>
              {p.note ? (
                <p className="muted" style={{ margin: 0 }}>
                  {p.note}
                </p>
              ) : null}
              {p.kind === 'featured' ? <p className="faint pick-paid">Sponsored. It never changes the score or rank.</p> : null}
              <dl className="pick-facts">
                <div>
                  <dt>Cashback</dt>
                  <dd>{cashbackLabel(p.card.cashback.basePct, p.card.cashback.maxPct)}</dd>
                </div>
                <div>
                  <dt>Annual fee</dt>
                  <dd>{usd(p.card.fees.annualUsd)}</dd>
                </div>
                <div>
                  <dt>FX fee</dt>
                  <dd>{pct(p.card.fees.fxPct)}</dd>
                </div>
              </dl>
              {p.card.links.affiliate && p.card.signupBonus ? (
                <p className="bonus-line">
                  <strong>Sign-up bonus:</strong> {p.card.signupBonus}
                </p>
              ) : null}
              <div className="pick-actions">
                <OutboundLink
                  slug={p.card.slug}
                  name={p.card.name}
                  placement={`pick-${p.slot}`}
                  campaign={p.kind === 'featured' ? 'sponsored' : undefined}
                  className="btn btn-metal btn-sm"
                >
                  Get the card
                </OutboundLink>
                <Link href={`/cards/${p.card.slug}`} className="btn btn-sm">
                  Read the review
                </Link>
              </div>
            </article>
          ))}
        </div>
        <p className="faint" style={{ fontSize: 13, margin: 0 }}>
          {anyFeatured ? (
            <>
              Featured cards marked Sponsored are paid for; that never changes a card&apos;s score or rank.{' '}
              <Link href="/methodology#money">How G2M makes money</Link>.{' '}
            </>
          ) : null}
          Card issuers can{' '}
          <a href={`mailto:${site.contactEmail}?subject=${encodeURIComponent('Featured pick on G2M')}`}>book one of these spots</a>.
        </p>
      </section>

      {/* How we judge */}
      <section className="wrap section stack" style={{ gap: 20 }} aria-labelledby="how">
        <div className="stack" style={{ gap: 8 }}>
          <Eyebrow>how cards are judged</Eyebrow>
          <h2 id="how" className="h2">
            One score, the same rules for every card
          </h2>
        </div>
        <div className="grid-3">
          <div className="panel panel-pad stack" style={{ gap: 10 }}>
            <h3 className="h3">Rewards, decoded</h3>
            <p className="muted">
              We score the cashback most people actually get, not the headline rate that needs a top tier or a token
              lockup.
            </p>
          </div>
          <div className="panel panel-pad stack" style={{ gap: 10 }}>
            <h3 className="h3">Every fee, upfront</h3>
            <p className="muted">Annual, FX, top-up and per-purchase fees side by side, so you see the real cost before you apply.</p>
          </div>
          <div className="panel panel-pad stack" style={{ gap: 10 }}>
            <h3 className="h3">Where it works</h3>
            <p className="muted">Country coverage, Apple Pay and Google Pay, and who holds your funds while you spend.</p>
          </div>
        </div>
        <Link href="/methodology" style={{ fontWeight: 600, textUnderlineOffset: 4, alignSelf: 'flex-start', padding: '8px 0' }}>
          Read the methodology
        </Link>
      </section>

      {/* Tools */}
      <section className="wrap section" aria-labelledby="tools">
        <h2 id="tools" className="sr-only">
          Tools
        </h2>
        <div className="grid-3">
          <Link href="/finder" className="panel panel-pad stack" style={{ gap: 10, textDecoration: 'none' }}>
            <span className="eyebrow">[ 5 questions ]</span>
            <span className="h3">Card finder</span>
            <span className="muted">Tell us where you live and what matters to you. Get three cards that fit.</span>
          </Link>
          <Link href="/calculator" className="panel panel-pad stack" style={{ gap: 10, textDecoration: 'none' }}>
            <span className="eyebrow">[ your numbers ]</span>
            <span className="h3">Rewards calculator</span>
            <span className="muted">Enter your monthly spend and see what each card earns you after fees in a year.</span>
          </Link>
          <Link href="/wallet" className="panel panel-pad stack" style={{ gap: 10, textDecoration: 'none' }}>
            <span className="eyebrow">[ 2-card wallet ]</span>
            <span className="h3">Wallet builder</span>
            <span className="muted">The two cards that keep you the most together, with lounges, yield or a bank account if you need them.</span>
          </Link>
          <Link href="/receipt" className="panel panel-pad stack" style={{ gap: 10, textDecoration: 'none' }}>
            <span className="eyebrow">[ one purchase ]</span>
            <span className="h3">Real swipe receipt</span>
            <span className="muted">What a coffee or a hotel really costs on a card, fee by fee. Post the receipt on X.</span>
          </Link>
          <Link href="/corridors" className="panel panel-pad stack" style={{ gap: 10, textDecoration: 'none' }}>
            <span className="eyebrow">[ off-ramp ]</span>
            <span className="h3">Corridor and IBAN finder</span>
            <span className="muted">Move USDC or USDT to a bank: SEPA, ACH, Faster Payments, AED, INR or SWIFT.</span>
          </Link>
          <Link href="/compare" className="panel panel-pad stack" style={{ gap: 10, textDecoration: 'none' }}>
            <span className="eyebrow">[ side by side ]</span>
            <span className="h3">Compare cards</span>
            <span className="muted">Put up to three cards next to each other, fee by fee and perk by perk.</span>
          </Link>
        </div>
      </section>
    </>
  );
}
