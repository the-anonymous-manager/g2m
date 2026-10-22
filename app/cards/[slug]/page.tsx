import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCard, getCards, getRank, standings } from '@/lib/cards';
import type { Card, Market, Tier } from '@/lib/types';
import { MARKET_LABELS } from '@/lib/regions';
import { CUSTODY_LABEL, NP, TYPE_LABEL, cashbackLabel, fmtDate, pct, perPurchaseFee, usd } from '@/lib/format';
import { SCORE_WEIGHTS } from '@/lib/score';
import { absoluteUrl, site } from '@/lib/site';
import { CardArt } from '@/components/CardArt';
import { Eyebrow, MarketBadge, ScorePill } from '@/components/bits';
import { OutboundLink } from '@/components/OutboundLink';
import { ShareBar } from '@/components/ShareBar';
import { CountryStanding } from '@/components/CountryStanding';

export const dynamicParams = false;

export function generateStaticParams() {
  return getCards().map((c) => ({ slug: c.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const card = getCard(slug);
  if (!card) return {};
  const cb = cashbackLabel(card.cashback.basePct, card.cashback.maxPct);
  const title = `${card.name} review: fees, cashback and countries`;
  const description = `${card.name}: ${cb} back, ${usd(card.fees.annualUsd)} annual fee, ${pct(card.fees.fxPct)} FX fee. G2M score ${card.score.total}/100. ${card.summary}`;
  return {
    title,
    description,
    alternates: { canonical: `/cards/${card.slug}` },
    openGraph: { title: `${card.name} · G2M score ${card.score.total}`, description, url: absoluteUrl(`/cards/${card.slug}`) },
    twitter: { title: `${card.name} · G2M score ${card.score.total}`, description }
  };
}

const MARKETS: Market[] = ['IN', 'AE', 'US', 'GB', 'EU'];

function tierCashback(t: Tier): string {
  if (t.bands && t.bands.length) {
    return t.bands
      .map((b, i) => {
        const from = i === 0 ? 0 : t.bands![i - 1].uptoUsd ?? 0;
        if (b.uptoUsd == null) return `${pct(b.pct)} above $${from.toLocaleString('en-US')}`;
        return `${pct(b.pct)} up to $${b.uptoUsd.toLocaleString('en-US')}/mo`;
      })
      .join(', ');
  }
  return pct(t.cashbackPct);
}

function jsonLd(card: Card) {
  const url = absoluteUrl(`/cards/${card.slug}`);
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'PaymentCard',
      name: card.name,
      description: card.summary,
      url,
      brand: { '@type': 'Brand', name: card.brand },
      provider: { '@type': 'Organization', name: card.brand, url: card.links.official },
      contactlessPayment: true,
      ...(card.cashback.basePct != null || card.cashback.maxPct != null
        ? { cashBack: (card.cashback.basePct ?? card.cashback.maxPct ?? 0) / 100 }
        : {}),
      feesAndCommissionsSpecification: `Annual fee: ${usd(card.fees.annualUsd)}. FX fee: ${pct(card.fees.fxPct)}.`,
      areaServed: card.coverage.scope
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'G2M', item: site.url },
        { '@type': 'ListItem', position: 2, name: 'Rankings', item: absoluteUrl('/cards') },
        { '@type': 'ListItem', position: 3, name: card.name, item: url }
      ]
    }
  ];
}

export default async function CardPage({ params }: Props) {
  const { slug } = await params;
  const card = getCard(slug);
  if (!card) notFound();
  const all = getCards();
  const rank = getRank(card.slug);

  // Alternatives: the best-scored cards that are available in at least one of the same confirmed markets.
  const myMarkets = MARKETS.filter((m) => card.coverage.markets[m] === 'yes');
  const alternatives = all
    .filter((c) => c.slug !== card.slug)
    .filter((c) => !myMarkets.length || myMarkets.some((m) => c.coverage.markets[m] !== 'no'))
    .slice(0, 3);

  const breakdown = [
    { label: 'Rewards', value: card.score.rewards, max: SCORE_WEIGHTS.rewards },
    { label: 'Fees', value: card.score.fees, max: SCORE_WEIGHTS.fees },
    { label: 'Coverage', value: card.score.coverage, max: SCORE_WEIGHTS.coverage },
    { label: 'Control', value: card.score.control, max: SCORE_WEIGHTS.control }
  ];

  const wallets = [
    card.wallets.applePay ? 'Apple Pay' : null,
    card.wallets.googlePay ? 'Google Pay' : null
  ].filter(Boolean);
  const walletText =
    wallets.length > 0
      ? wallets.join(' + ')
      : card.wallets.applePay === false && card.wallets.googlePay === false
        ? 'Not supported'
        : NP;

  return (
    <article className="wrap section stack" style={{ gap: 40 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(card)) }} />

      <nav aria-label="Breadcrumb" className="faint" style={{ fontSize: 14 }}>
        <Link href="/cards" style={{ textDecoration: 'none' }}>
          Rankings
        </Link>{' '}
        / <span aria-current="page">{card.name}</span>
      </nav>

      {/* Hero */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'center' }}>
        <div style={{ flex: '1 1 420px', minWidth: 0 }} className="stack">
          <div className="stack" style={{ gap: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="badge badge-accent">#{rank} of {all.length}</span>
              <span className="badge badge-unknown">{card.network}</span>
              <span className="badge badge-unknown">{TYPE_LABEL[card.type]}</span>
              <span className={`badge ${card.custody === 'self-custodial' ? 'badge-accent' : 'badge-unknown'}`}>
                {CUSTODY_LABEL[card.custody]}
              </span>
            </div>
            <h1 className="h2" style={{ fontSize: 'clamp(2rem, 4.4vw, 3.2rem)' }}>
              {card.name}
            </h1>
            <p className="lead">{card.summary}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <OutboundLink slug={card.slug} name={card.brand} placement="card-hero">
                Get the {card.brand} card
              </OutboundLink>
              <Link href={`/compare?c=${[card.slug, ...alternatives.slice(0, 2).map((a) => a.slug)].join(',')}`} className="btn">
                Compare
              </Link>
            </div>
            <ShareBar
              text={`${card.name}: G2M score ${card.score.total}/100, ${cashbackLabel(card.cashback.basePct, card.cashback.maxPct)} back`}
              label="Share this card"
            />
          </div>
        </div>
        <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
          <CardArt
            card={card}
            width="min(100%, 380px)"
            style={{ boxShadow: 'var(--card-shadow)', transform: 'rotate(-4deg)' }}
          />
        </div>
      </div>

      {/* Key facts */}
      <section aria-labelledby="facts" className="stack" style={{ gap: 14 }}>
        <h2 id="facts" className="h3">
          Key facts
        </h2>
        <dl className="facts">
          <div className="fact">
            <dt>Cashback</dt>
            <dd>
              {cashbackLabel(card.cashback.basePct, card.cashback.maxPct)}
              {card.cashback.payout ? <small> in {card.cashback.payout}</small> : null}
            </dd>
          </div>
          <div className="fact">
            <dt>Annual fee</dt>
            <dd>{usd(card.fees.annualUsd)}</dd>
          </div>
          <div className="fact">
            <dt>FX fee</dt>
            <dd>{pct(card.fees.fxPct)}</dd>
          </div>
          <div className="fact">
            <dt>Top-up fee</dt>
            <dd>{pct(card.fees.topUpPct)}</dd>
          </div>
          <div className="fact">
            <dt>Per-purchase fee</dt>
            <dd>{perPurchaseFee(card.fees)}</dd>
          </div>
          <div className="fact">
            <dt>ATM</dt>
            <dd style={{ fontSize: 15, fontWeight: 600 }}>{card.fees.atm ?? NP}</dd>
          </div>
          <div className="fact">
            <dt>Card types</dt>
            <dd style={{ textTransform: 'capitalize' }}>{card.forms.join(', ')}</dd>
          </div>
          <div className="fact">
            <dt>Mobile wallets</dt>
            <dd>{walletText}</dd>
          </div>
        </dl>
        {card.cashback.note || card.fees.fxNote ? (
          <div className="stack" style={{ gap: 6 }}>
            {card.cashback.note ? <p className="muted" style={{ fontSize: 14 }}>Cashback: {card.cashback.note}</p> : null}
            {card.fees.fxNote ? <p className="muted" style={{ fontSize: 14 }}>FX: {card.fees.fxNote}</p> : null}
          </div>
        ) : null}
      </section>

      <div className="grid-2">
        {/* Score */}
        <section className="panel panel-pad stack" style={{ gap: 18 }} aria-labelledby="score">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <h2 id="score" className="h3">
              G2M score <span className="faint" style={{ fontSize: 14, fontWeight: 500 }}>worldwide</span>
            </h2>
            {/* paddingRight: the metal fill only paints inside the box, and tight letter-spacing pushes the last digit past it. */}
            <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', paddingRight: '0.12em' }} className="metal-text num">
              {card.score.total}
              <span style={{ fontSize: 16 }}>/100</span>
            </span>
          </div>
          <CountryStanding standings={standings(card.slug)} />
          <div className="breakdown">
            {breakdown.map((b) => (
              <div className="breakdown-row" key={b.label}>
                <span>{b.label}</span>
                <span className="bar" aria-hidden="true">
                  <i style={{ width: `${(b.value / b.max) * 100}%` }} />
                </span>
                <span className="mono num" style={{ textAlign: 'right', fontSize: 13 }}>
                  {b.value}/{b.max}
                </span>
              </div>
            ))}
          </div>
          <Link href="/methodology" className="muted" style={{ fontSize: 14 }}>
            How the score works
          </Link>
        </section>

        {/* Availability */}
        <section className="panel panel-pad stack" style={{ gap: 16 }} aria-labelledby="where">
          <h2 id="where" className="h3">
            Where it works
          </h2>
          <ul className="list-plain">
            {MARKETS.map((m) => (
              <li key={m} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{MARKET_LABELS[m]}</span>
                <MarketBadge value={card.coverage.markets[m]} market={m} />
              </li>
            ))}
          </ul>
          <p className="muted" style={{ fontSize: 14 }}>
            {card.coverage.scope}
            {/* Skip the count when the description already says it ("48 countries incl. ..."). */}
            {card.coverage.countries && !card.coverage.scope.includes(String(card.coverage.countries))
              ? ` · ${card.coverage.countries} countries`
              : ''}
            .{' '}
            {card.coverage.examples.length ? `Includes ${card.coverage.examples.join(', ')}.` : ''}
          </p>
        </section>
      </div>

      {/* Tiers */}
      <section aria-labelledby="tiers" className="stack" style={{ gap: 14 }}>
        <h2 id="tiers" className="h3">
          Tiers and plans
        </h2>
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">Cost per year</th>
                <th scope="col">Cashback</th>
                <th scope="col">Monthly cap</th>
                <th scope="col">FX fee</th>
                <th scope="col">How to get it</th>
                <th scope="col">Perks</th>
              </tr>
            </thead>
            <tbody>
              {card.tiers.map((t) => (
                <tr key={t.name}>
                  <td style={{ fontWeight: 650 }}>
                    {t.name}
                    {t.comingSoon ? (
                      <span className="badge badge-warn" style={{ marginLeft: 8 }}>
                        Coming soon
                      </span>
                    ) : null}
                  </td>
                  <td className="num">
                    {usd(t.feeUsdYear)}
                    {t.feeNote ? (
                      <span className="faint" style={{ display: 'block', fontSize: 12 }}>
                        {t.feeNote}
                      </span>
                    ) : null}
                  </td>
                  <td className="num">{tierCashback(t)}</td>
                  <td className="num">{t.capMonthlyUsd != null ? usd(t.capMonthlyUsd) : '—'}</td>
                  <td className="num">{pct(t.fxPct ?? card.fees.fxPct)}</td>
                  <td style={{ fontSize: 14 }}>{t.requirement ?? (t.feeUsdYear === 0 ? 'Free to join' : '—')}</td>
                  <td style={{ fontSize: 14 }}>{t.perks.length ? t.perks.join(' · ') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-2">
        <section className="panel panel-pad stack" style={{ gap: 14 }} aria-labelledby="good">
          <h2 id="good" className="h3">
            What&apos;s good
          </h2>
          <ul className="list-plain">
            {card.pros.map((p) => (
              <li key={p}>
                <span className="dot" style={{ background: 'var(--ok)' }} />
                {p}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel panel-pad stack" style={{ gap: 14 }} aria-labelledby="watch">
          <h2 id="watch" className="h3">
            Watch out for
          </h2>
          <ul className="list-plain">
            {card.cons.map((p) => (
              <li key={p}>
                <span className="dot" style={{ background: 'var(--bad)' }} />
                {p}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {card.fees.other.length || card.assets.length || card.perks.length ? (
        <section className="stack" style={{ gap: 14 }} aria-labelledby="more">
          <h2 id="more" className="h3">
            More details
          </h2>
          <dl className="facts">
            {card.fees.other.length ? (
              <div className="fact" style={{ gridColumn: '1 / -1' }}>
                <dt>Other fees</dt>
                <dd style={{ fontSize: 15, fontWeight: 500 }}>{card.fees.other.join(' · ')}</dd>
              </div>
            ) : null}
            {card.perks.length ? (
              <div className="fact" style={{ gridColumn: '1 / -1' }}>
                <dt>Perks</dt>
                <dd style={{ fontSize: 15, fontWeight: 500 }}>{card.perks.join(' · ')}</dd>
              </div>
            ) : null}
            {card.assets.length ? (
              <div className="fact" style={{ gridColumn: '1 / -1' }}>
                <dt>Spend from</dt>
                <dd style={{ fontSize: 15, fontWeight: 500 }}>{card.assets.join(', ')}</dd>
              </div>
            ) : null}
            {card.issuer ? (
              <div className="fact" style={{ gridColumn: '1 / -1' }}>
                <dt>Issuer</dt>
                <dd style={{ fontSize: 15, fontWeight: 500 }}>{card.issuer}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {/* Sources */}
      <section className="notice stack" style={{ gap: 10 }} aria-labelledby="sources">
        <h2 id="sources" style={{ fontSize: 15, color: 'var(--text)' }}>
          Sources · last checked {fmtDate(card.lastChecked)}
        </h2>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {card.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
              {s.verified ? <span className="faint"> · {fmtDate(s.verified)}</span> : null}
            </li>
          ))}
        </ul>
        <p>
          Terms change often. Confirm fees and availability on the{' '}
          <a href={card.links.official} target="_blank" rel="noopener noreferrer">
            official {card.brand} site
          </a>{' '}
          before you apply. Spotted something out of date? <Link href={`/submit?card=${card.slug}`}>Tell us</Link>.
        </p>
      </section>

      {/* Alternatives */}
      {alternatives.length ? (
        <section className="stack" style={{ gap: 14 }} aria-labelledby="alts">
          <div className="pager">
            <h2 id="alts" className="h3">
              Also worth a look
            </h2>
            <Link href="/cards" className="muted" style={{ fontSize: 15 }}>
              See all cards
            </Link>
          </div>
          <div className="grid-3">
            {alternatives.map((a) => (
              <Link
                key={a.slug}
                href={`/cards/${a.slug}`}
                className="panel panel-pad"
                style={{ textDecoration: 'none', display: 'flex', gap: 14, alignItems: 'center' }}
              >
                <CardArt card={a} width={84} />
                <span className="stack" style={{ gap: 4, minWidth: 0 }}>
                  <b>{a.name}</b>
                  <span className="faint" style={{ fontSize: 14 }}>
                    {cashbackLabel(a.cashback.basePct, a.cashback.maxPct)} back
                  </span>
                  <ScorePill value={a.score.total} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
