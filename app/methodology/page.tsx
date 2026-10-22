import type { Metadata } from 'next';
import Link from 'next/link';
import { getCards, lastUpdated } from '@/lib/cards';
import { BASKET, BASKET_PURCHASES, BASKET_USD, SCORE_WEIGHTS } from '@/lib/score';
import { money } from '@/lib/format';
import { fmtDate } from '@/lib/format';
import { Eyebrow } from '@/components/bits';

export const metadata: Metadata = {
  title: 'How we score crypto cards',
  description:
    'The G2M score explained: rewards 40, fees 30, coverage 20, control 10. Same rules for every card, no paid rankings.',
  alternates: { canonical: '/methodology' }
};

const PARTS = [
  {
    name: 'Rewards',
    max: SCORE_WEIGHTS.rewards,
    how: 'The ongoing cashback on the entry tier, worked out on the $1,000 test basket below, so spending bands and monthly caps count. Short intro offers (such as 2% for the first 30 days) are left out. Any fee charged on every purchase comes off this rate first. Points: 40 × (net rate ÷ 5%), up to 40 and never below 0. If the issuer only publishes an “up to” rate and no entry-tier rate, Rewards scores 0.'
  },
  {
    name: 'Fees',
    max: SCORE_WEIGHTS.fees,
    how: 'Annual and card-access costs (10 points): the yearly or subscription fee of the entry tier plus any fee to get the card itself, but not optional physical card shipping. Free scores 10, up to $100 scores 6, up to $300 scores 3, more scores 0. FX fee (12 points): 0% scores 12, up to 1% scores 9, up to 2% scores 5, more scores 2. Other transaction costs on the test basket (8 points): $0 a month scores 8, up to $10 scores 4, more scores 1.'
  },
  {
    name: 'Coverage',
    max: SCORE_WEIGHTS.coverage,
    how: 'Confirmed countries (12 points): 100 or more scores 12, 50 to 99 scores 10, 20 to 49 scores 8, 5 to 19 scores 5, 1 to 4 scores 2, none scores 0. Apple Pay and Google Pay (2 points each). Physical card (4 points): a confirmed physical card scores 3, plus 1 when getting it (issuance and shipping) costs under $50; a virtual-only card scores 0.'
  },
  {
    name: 'Control',
    max: SCORE_WEIGHTS.control,
    how: 'Who holds your funds while you spend. Self-custodial cards score 10, custodial cards 5, and cards that do not say score 0.'
  }
];

export default function MethodologyPage() {
  const n = getCards().length;
  return (
    <div className="wrap section stack" style={{ gap: 36 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>methodology</Eyebrow>
        <h1 className="h2">How the G2M score works</h1>
        <p className="lead">
          Every card gets a score from 0 to 100, worked out from its published terms with the same rules for all {n} cards.
          Nobody can pay to move up.
        </p>
      </div>

      <div className="table-wrap">
        <table className="table stack-on-phone" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th scope="col">Part</th>
              <th scope="col">Points</th>
              <th scope="col">How we measure it</th>
            </tr>
          </thead>
          <tbody>
            {PARTS.map((p) => (
              <tr key={p.name}>
                <td style={{ fontWeight: 700 }}>{p.name}</td>
                <td className="num mono">{p.max}</td>
                <td style={{ fontSize: 15, lineHeight: 1.55 }}>{p.how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="prose">
        <h2 id="basket">The $1,000 test basket</h2>
        <p>
          Rewards and other transaction costs are worked out on the same month of spending for every card: {money(BASKET_USD)}{' '}
          split into five equal {money(200)} buckets, {BASKET_PURCHASES} purchases in all.
        </p>
      </div>

      <div className="table-wrap" style={{ maxWidth: 520 }}>
        <table className="table" style={{ minWidth: 0 }}>
          <thead>
            <tr>
              <th scope="col">Purchase size</th>
              <th scope="col">Purchases</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {BASKET.map((b) => (
              <tr key={b.usd}>
                <td className="num">{money(b.usd)}</td>
                <td className="num">{b.count}</td>
                <td className="num">{money(b.usd * b.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="prose">
        <p>
          A fee charged as a percentage of every purchase comes off the cashback first. Only the part larger than the
          cashback counts as a transaction cost, together with flat fees per purchase (charged on all {BASKET_PURCHASES}),
          top-up or funding fees, and small-purchase fees on the basket purchases below the issuer&apos;s limit. FX fees are
          scored on their own.
        </p>

        <h2>Missing figures</h2>
        <p>
          Anything the issuer does not publish scores 0 for that part: a fee, a cashback rate, Apple Pay or Google Pay
          support, or who holds your funds. We show it as “Not published”. A card that states its terms clearly will
          always beat one that leaves them out.
        </p>
        <p>
          Confirmed countries come from the issuer&apos;s own country list. When a card has no full list yet, we count the
          countries confirmed among the markets we check for every card (the US, the UK, India, the UAE and the EU, which
          counts as all 30 EEA countries).
        </p>

        <h2>Where the data comes from</h2>
        <p>
          Each card page lists its sources with the date we checked them: the issuer&apos;s own site and help pages first,
          then public datasets such as DefiLlama&apos;s crypto card listings. We re-check every card at least every 90 days and
          update sooner when an issuer changes its terms.
        </p>

        <h2>Where each card works</h2>
        <p>
          For every country we mark each card as available, not available, or not confirmed. We use the issuer&apos;s own
          country list when it publishes one, and we have checked the US, the UK, the EU, India and the UAE for every
          card. “Not confirmed” means the issuer has not said either way, so check their country list before you apply.
        </p>

        <h2 id="by-country">Scores by country</h2>
        <p>
          The same card is not the same deal everywhere. Some tiers, fees and cashback rates are only for one country, so
          the rankings pick up where you live and score every card for that country with the same formula. Rewards and
          fees come from the tiers offered there, cards that are not available there drop out, and # is the rank in that
          country. For one country, the 12 country points become: confirmed there 12, not confirmed 5. When no card has
          confirmed a country yet, you see the worldwide ranking with each card marked not confirmed.
        </p>
        <p>
          Card pages show the worldwide score, plus the score and rank in your country. Pick “All countries” in the
          rankings to see the worldwide list.
        </p>

        <h2>The rewards calculator</h2>
        <p>
          The calculator uses your monthly spend to work out a year of cashback for every tier of every card, then takes off
          plan fees, FX fees and per-purchase fees, including small-purchase fees when your typical purchase is below the
          limit. Monthly caps and spend bands are applied where published. Rewards in tokens or points are counted at face
          value.
        </p>
        <p>
          Pick where you live and we use your country&apos;s currency. Spending at home is free of FX fees only on a card
          that bills in that currency (most crypto cards bill in US dollars, some also in euros), so someone in the US
          paying in dollars pays no FX fee, while someone in India paying in rupees on a dollar card pays it on every
          purchase. When an issuer does not say which currency it bills in, we count the FX fee on all spending. Plans
          only offered in other countries are left out. The card finder uses the same rules.
        </p>

        <h2 id="money">How G2M makes money</h2>
        <p>
          Some “Get the card” buttons may use referral links, and card issuers can pay for the Featured spot at the top
          of the home page. That spot is always labelled Sponsored, shows the card&apos;s real G2M score and rank, and runs
          for a fixed period. When no one has booked it, it shows the top-ranked card.
        </p>
        <p>
          Neither a referral nor a sponsorship ever changes a card&apos;s score, rank or position in the rankings, and cards
          without either are ranked exactly the same way.
        </p>

        <h2>Found a mistake?</h2>
        <p>
          Card terms change all the time. If something is out of date, <Link href="/submit">send us a correction</Link> and
          we will check it against the issuer&apos;s site.
        </p>
        <p className="faint" style={{ fontSize: 14 }}>
          Data last checked {fmtDate(lastUpdated())}. Not financial advice.
        </p>
      </div>
    </div>
  );
}
