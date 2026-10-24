import Link from 'next/link';
import { getCards, getRank, lastUpdated } from '@/lib/cards';
import { getSponsor } from '@/lib/sponsor';
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

const BROWSE = [
  { label: 'No annual fee', href: '/cards?nofee=1' },
  { label: 'Self-custodial', href: '/cards?custody=self' },
  { label: 'Lounge access', href: '/cards?lounge=1' },
  { label: 'Metal cards', href: '/cards?metal=1' },
  { label: '2%+ cashback', href: '/cards?min=2' },
  { label: 'Lowest FX fee', href: '/cards?sort=fx:asc' },
  { label: 'US', href: '/cards?country=US' },
  { label: 'UK', href: '/cards?country=GB' },
  { label: 'India', href: '/cards?country=IN' },
  { label: 'UAE', href: '/cards?country=AE' }
];

const MARKETS: Market[] = ['US', 'GB', 'EU'];

// Re-check hourly so a sponsorship starts and ends on its dates without a new deploy.
export const revalidate = 3600;

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
      // The EU is not one country, so its link opens the full list; the visitor's own country is picked there.
      href: m === 'EU' ? '/cards' : `/cards?country=${m}`,
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
    href: '/cards',
    count: asia.length,
    cards: asia.slice(0, 3).map(({ c, n }) => ({ row: toRow(c), note: `${n} ${n === 1 ? 'country' : 'countries'} in Asia` }))
  });
  return panels;
}

export default function HomePage() {
  const cards = getCards();
  const rows = cards.map(toRow);
  // The Featured spot: a booked sponsor while its dates run, otherwise the top-ranked card.
  const sponsor = getSponsor();
  const featured = sponsor ?? cards[0];
  const selfCustodial = cards.filter((c) => c.custody === 'self-custodial').length;
  const noFee = cards.filter((c) => c.fees.annualUsd === 0).length;

  return (
    <>
      {/* Hero */}
      <div className="hero-shell">
        <GlyphField />
        <section className="wrap hero">
          <div className="hero-copy">
            <Eyebrow>the crypto card directory</Eyebrow>
            <h1 className="h1">
              <span className="line">Spend your</span>
              <br />
              <span className="line">
                <span className="metal-text" style={{ fontStyle: 'italic', paddingRight: '0.08em' }}>
                  bags better.
                </span>
              </span>
            </h1>
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
              <Link href="/cards" style={{ padding: '10px 0', fontWeight: 600, textUnderlineOffset: 4 }}>
                See all {cards.length} cards
              </Link>
              <Link href="/finder" style={{ padding: '10px 0', fontWeight: 600, textUnderlineOffset: 4 }}>
                Find your best card
              </Link>
            </div>
          </div>
          <aside className="hero-feature" data-tilt aria-label={sponsor ? 'Sponsored card' : 'Top-ranked card'}>
            <CardArt card={featured} />
            <div className="panel panel-pad hero-feature-panel">
              <div className="hero-feature-head">
                <Eyebrow>{sponsor ? 'sponsored' : 'top ranked'}</Eyebrow>
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
              <div className="hero-feature-actions">
                <OutboundLink
                  slug={featured.slug}
                  name={featured.name}
                  placement={sponsor ? 'hero-sponsored' : 'hero-top'}
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
                    Paid placement. It never changes a card&apos;s score or rank.{' '}
                    <Link href="/methodology#money">How G2M makes money</Link>
                  </>
                ) : (
                  <>
                    The highest G2M score worldwide right now. Card issuers can{' '}
                    <a href={`mailto:${site.contactEmail}?subject=${encodeURIComponent('Sponsored spot on G2M')}`}>
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
            <span>Self-custodial</span>
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

      {/* Browse */}
      <section className="wrap section-tight stack" style={{ gap: 14 }} aria-labelledby="browse">
        <h2 id="browse" className="eyebrow">
          [ browse by ]
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {BROWSE.map((b) => (
            <Link key={b.href} href={b.href} className="chip">
              {b.label}
            </Link>
          ))}
        </div>
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
            <span className="eyebrow">[ 3 questions ]</span>
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
