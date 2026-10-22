import type { Metadata } from 'next';
import Link from 'next/link';
import { getCards, lastUpdated } from '@/lib/cards';
import { SCORE_WEIGHTS } from '@/lib/score';
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
    how: 'The cashback most people actually get. We use the base rate when the issuer publishes one. If only an “up to” rate exists, we count 40% of it, because the headline rate usually needs a top tier, staking or a paid plan. Any fee charged on every purchase comes off this rate first, since it eats into every reward. 5% or more earns full marks.'
  },
  {
    name: 'Fees',
    max: SCORE_WEIGHTS.fees,
    how: 'Annual fee (10 points: free scores 10, up to $100 scores 6, up to $300 scores 3, more scores zero). FX fee (12 points: 0% scores 12, up to 1% scores 9, up to 2% scores 5, more scores 2). Other purchase costs (8 points): top-up fees, flat or small-purchase fees, and any per-purchase fee larger than the cashback. None scores 8, up to 1% scores 4, more scores 1. A fee the issuer does not publish scores in the middle.'
  },
  {
    name: 'Coverage',
    max: SCORE_WEIGHTS.coverage,
    how: 'How many countries can get the card (12 points: 100+ countries is best), Apple Pay and Google Pay (2 points each) and a physical card (4 points). For one country, the 12 points become: confirmed there 12, not confirmed 5.'
  },
  {
    name: 'Control',
    max: SCORE_WEIGHTS.control,
    how: 'Who holds your funds while you spend. Self-custodial cards score 10, custodial cards 5, and cards that do not say score 4.'
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
        <table className="table" style={{ minWidth: 640 }}>
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
        <h2>Missing figures</h2>
        <p>
          When an issuer does not publish a number, we say “Not published” and score that part below a known good value. A
          card that states its fees clearly will always beat one that hides them.
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
          country. Cards confirmed in your country score higher than cards that have not confirmed it. When no card has
          confirmed a country yet, you see the worldwide ranking with each card marked not confirmed.
        </p>
        <p>
          Card pages show the worldwide score, plus the score and rank in your country. Pick “All countries” in the
          rankings to see the worldwide list.
        </p>

        <h2>The rewards calculator</h2>
        <p>
          The calculator uses your monthly spend to work out a year of cashback for every tier of every card, then takes off
          plan fees, FX fees on the share you spend in other currencies, and per-purchase fees, including small-purchase fees when your typical purchase is below the limit. Monthly caps and spend bands
          are applied where published. Rewards in tokens or points are counted at face value.
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
