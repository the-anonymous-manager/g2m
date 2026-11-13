import type { Metadata } from 'next';
import Link from 'next/link';
import { getCards, lastUpdated } from '@/lib/cards';
import { BASKET, BASKET_PURCHASES, BASKET_USD, SCORE_WEIGHTS } from '@/lib/score';
import { money } from '@/lib/format';
import { fmtDate } from '@/lib/format';
import { Eyebrow } from '@/components/bits';
import { intlMethodology, languageLinks } from '@/lib/i18n/locales';
import { metaDescription, shareMeta } from '@/lib/site';

const pageTitle = 'How we score crypto cards';
const pageDescription =
  'The G2M score explained: rewards 25, fees 30, coverage 20, banking features 15, control 10. Same rules for every card, no paid rankings.';

export const metadata: Metadata = {
  title: pageTitle,
  description: metaDescription(pageDescription),
  alternates: { canonical: '/methodology', languages: languageLinks('/methodology', intlMethodology) },
  ...shareMeta(pageTitle, pageDescription, '/methodology')
};

const PARTS = [
  {
    name: 'Rewards',
    max: SCORE_WEIGHTS.rewards,
    how: 'The ongoing cashback on the entry tier, worked out on the $1,000 test basket below, so spending bands and monthly caps count. Short intro offers (such as 2% for the first 30 days) are left out. Points: 25 × (cashback rate ÷ 3.5%), so 3.5% or more earns all 25. If the issuer only publishes an “up to” rate and no entry-tier rate, Rewards scores 0. Fees never reduce this part; they are scored under Fees.'
  },
  {
    name: 'Fees',
    max: SCORE_WEIGHTS.fees,
    how: 'Annual and card-access costs (10 points): the entry tier’s yearly or subscription fee plus any non-refundable fee to get the card. Optional physical card shipping and a first top-up that stays in your balance do not count. Free scores 10, up to $100 scores 6, up to $300 scores 3, more scores 0. FX fee (12 points): 0% scores 12, up to 1% scores 9, up to 2% scores 5, more scores 2. Other transaction costs on the test basket (8 points): $0 a month scores 8, up to $10 scores 6, up to $20 scores 3, up to $30 scores 1, more scores 0.'
  },
  {
    name: 'Coverage',
    max: SCORE_WEIGHTS.coverage,
    how: 'Confirmed countries (12 points): 100 or more scores 12, 50 to 99 scores 10, 20 to 49 scores 8, 5 to 19 scores 5, 1 to 4 scores 2, none scores 0. Apple Pay and Google Pay (2 points each). Physical card (4 points): a confirmed physical card scores 3, plus 1 when getting it (issuance and shipping) costs under $50; a virtual-only card scores 0.'
  },
  {
    name: 'Banking features',
    max: SCORE_WEIGHTS.ecosystem,
    how: 'Five features worth 3 points each. A bank account number to receive money (3 in your own name, 2 for a shared account with a reference code). Sending money out to a bank account (3 for two or more currencies, 1.5 for one). Buying and selling crypto with fiat in the app (3 for both, 1.5 for one way). Spending against your crypto without selling it (3). A yield on your unspent balance (3).'
  },
  {
    name: 'Control',
    max: SCORE_WEIGHTS.control,
    how: 'Who holds your funds while you spend. Non-custodial cards score 10, cards that let you choose custodial or non-custodial also score 10, custodial-only cards score 5, and cards that do not say score 0.'
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
          Other transaction costs are everything the basket costs you in fees in a month: a percentage fee on every
          purchase (including conversion fees), flat fees per purchase (charged on all {BASKET_PURCHASES}), top-up or
          funding fees, and small-purchase fees on the basket purchases below the issuer&apos;s limit. As a guide, $10 a
          month is 1% of the basket and $20 is 2%. A card with a 2% fee on every purchase and no FX fee costs $20 a month
          wherever you are.
        </p>
        <p>
          When an issuer publishes its fees and lists no per-purchase or small-purchase fee, we count it as $0. A fee is
          only “not published” when there is no fee schedule at all, or the issuer says a fee applies without giving the
          amount.
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
          The test basket is spent in your country&apos;s currency. If the card does not bill in it (for example a US dollar
          card used in India or the UAE), the FX fee applies to every purchase, so it is added to the basket&apos;s
          transaction costs together with any fee on every purchase and any small-purchase fee charged on foreign
          purchases. Worldwide, the basket is spent in the card&apos;s own currency.
        </p>
        <p>
          Card pages show the worldwide score, plus the score and rank in your country. Pick “All countries” in the
          rankings to see the worldwide list.
        </p>

        <h2 id="calculator">The rewards calculator</h2>
        <p>
          The calculator works out a year on every card for your monthly spend: rewards minus the plan fee, FX fees,
          per-purchase fees, small-purchase fees and top-up fees. It has three views: the best card for you (every card
          available where you live, at its best tier for your spend or its entry tier only), the tiers of one card side by
          side with the monthly spend where each dearer tier starts to pay off, and one card line by line.
        </p>
        <p>
          Your spending is split three ways: your own currency at home, US dollars online, and other currencies when you
          travel (80%, 10% and 10% to start). A card only charges no FX fee on a currency it bills in (most crypto cards bill
          in US dollars, some also in euros), so someone in India paying in rupees on a dollar card pays the FX fee on every
          purchase, and foreign-only fees such as KAST&apos;s small-purchase fee apply too. When an issuer does not say which
          currency it bills in, we count the FX fee on all spending.
        </p>
        <p>
          Purchase sizes follow the same mix as the test basket ($10 to $200, 20% of spending in each size), or one size of
          your choice. Small-purchase fees are charged on the purchases below the issuer&apos;s limit. Top-up fees are
          worked out on everything you load, including the money that goes on fees: load = (spend + fees) ÷ (1 − top-up
          fee).
        </p>
        <p>
          Year 2 onwards counts yearly fees and ongoing rates only. Year 1 adds the one-off card fee (or the physical card
          and shipping, if you pick a physical card) and any welcome rate, such as 2% for the first 30 days. Rewards can be
          counted at face value, conservatively (cash, stablecoins, BTC and ETH at 100%, other tokens at 75%, points at 50%),
          or as cash and stablecoins only. Spending caps and bands are applied where published. Plans only offered in other
          countries are left out. The card finder uses the same FX rules.
        </p>

        <h2 id="money">How G2M makes money</h2>
        <p>
          Some “Get the card” buttons may use referral links, and card issuers can pay for the Featured spot at the top
          of the home page. That spot is labelled Featured with a &ldquo;Sponsored&rdquo; note, shows the card&apos;s real G2M
          score and rank, and runs
          for a fixed period. When no one has booked it, it shows the top-ranked card.
        </p>
        <p>
          The three &ldquo;Our picks&rdquo; on the home page work the same way: each one is either chosen by G2M (marked Our
          pick), a paid placement for a fixed period (marked Featured, with a &ldquo;Sponsored&rdquo; note), a card we added
          in the last 30 days (marked New on G2M), or, when none of those applies, filled in automatically with the top-ranked
          card, the best card with no annual fee and the best non-custodial card.
        </p>
        <p>
          Neither a referral nor a sponsorship ever changes a card&apos;s score, rank or position in the rankings, and cards
          without either are ranked exactly the same way.
        </p>

        <h2 id="privacy">What G2M counts</h2>
        <p>
          G2M counts page views, &ldquo;Get the card&rdquo; clicks and how the tools are used (for example which cards are
          compared), with the country and the kind of device. It uses no tracking cookies, stores no IP addresses and no
          personal details, and shares nothing with ad networks. A visitor is an anonymous code that is renewed every
          month, so visits can&apos;t be linked beyond that. The numbers only show which cards and pages people find useful.
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
