import type { Metadata } from 'next';
import Link from 'next/link';
import { BASKET_PURCHASES, BASKET_USD } from '@/lib/score';
import { feesStats } from '@/lib/feesGuide';
import { intlFeesGuide, languageLinks } from '@/lib/i18n/locales';
import { fmtDate, money, pct, usd } from '@/lib/format';
import { FEES_GUIDE, TOPICS } from '@/lib/guides';
import { absoluteUrl, site, shareMeta } from '@/lib/site';
import { Eyebrow } from '@/components/bits';
import { BackButton } from '@/components/BackButton';

// Built ahead of time at every deploy (the card data is bundled, and each sheet sync deploys), so the page is served
// ready-made instead of being put together on each visit. See open-next.config.ts.

const path = `/guides/${FEES_GUIDE.slug}`;

export const metadata: Metadata = {
  title: FEES_GUIDE.title,
  description: FEES_GUIDE.description,
  alternates: { canonical: path, languages: languageLinks(path, intlFeesGuide) },
  ...shareMeta(`${FEES_GUIDE.title} · G2M`, FEES_GUIDE.description, path)
};

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export default function FeesGuidePage() {
  const { n, annual, paidAnnual, fx, fxMedian, topUp, perPurchase, small, smallForeign, smallFree, rows, cheapest, checked } = feesStats();

  const faq = [
    {
      q: 'What fees do crypto cards charge?',
      a: 'Up to six kinds: an annual or monthly fee, an FX fee on foreign currency, a top-up fee to load the card, a fee on every purchase, a small-purchase fee, and ATM fees. Most cards charge only some of them.'
    },
    {
      q: 'What is a normal FX fee on a crypto card?',
      a: `Across the ${fx.length} cards on G2M that publish one, the FX fee runs from ${pct(Math.min(...fx))} to ${pct(Math.max(...fx))}, with a median of ${pct(fxMedian)}. ${fx.filter((x) => x === 0).length} charge none.`
    },
    {
      q: 'Which crypto card is cheapest to use?',
      a: `On a ${money(BASKET_USD)} month spent in a currency the card does not bill in, the lowest fees on G2M are on ${list(
        cheapest.map((r) => `${r.c.name} (${money(r.abroad!)})`)
      )}. The annual fee comes on top; the rewards calculator adds cashback and works out the whole year.`
    }
  ];
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'G2M', item: site.url },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: absoluteUrl('/guides') },
        { '@type': 'ListItem', position: 3, name: FEES_GUIDE.title, item: absoluteUrl(path) }
      ]
    }
  ];

  return (
    <article className="wrap section stack" style={{ gap: 36 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="stack" style={{ gap: 12 }}>
        <div className="back-row">
          <BackButton fallback="/guides" />
          <nav aria-label="Breadcrumb" className="faint" style={{ fontSize: 14 }}>
            <Link href="/guides" style={{ textDecoration: 'none' }}>
              Guides
            </Link>{' '}
            / <span aria-current="page">{FEES_GUIDE.title}</span>
          </nav>
        </div>
        <Eyebrow>guide</Eyebrow>
        <h1 className="h2">{FEES_GUIDE.title}</h1>
        <p className="lead">
          A crypto card can look free and still cost a few percent of everything you spend. Here is each fee, how common it is
          across the {n} cards on G2M, and what the fees add up to on the same month of spending.
        </p>
      </div>

      <div className="prose">
        <h2 id="annual">Annual or monthly fee</h2>
        <p>
          A subscription for the card or its tier. {annual.filter((x) => x === 0).length} of the {annual.length} cards that
          publish one have a free entry tier; the paid ones charge {usd(Math.min(...paidAnnual))} to {usd(Math.max(...paidAnnual))} a
          year. Higher tiers often swap the fee for a token you hold or stake, whose price can move.{' '}
          <Link href="/guides/no-annual-fee-crypto-cards">Cards with no annual fee</Link>.
        </p>

        <h2 id="fx">FX (foreign exchange) fee</h2>
        <p>
          A percentage added when you pay in a currency the card is not billed in. Most crypto cards bill in US dollars, so
          someone paying in rupees, dirhams or pounds pays it at home on every purchase, not only abroad. Across the{' '}
          {fx.length} cards that publish it, it runs from {pct(Math.min(...fx))} to {pct(Math.max(...fx))} (median{' '}
          {pct(fxMedian)}). <Link href="/guides/no-fx-fee-crypto-cards">Cards with no FX fee</Link>.
        </p>

        <h2 id="topup">Top-up fee</h2>
        <p>
          A percentage for loading the card, for example when you move stablecoins or crypto onto it. {topUp.filter((x) => x === 0).length}{' '}
          of the {topUp.length} cards that publish it charge nothing; the highest is {pct(Math.max(...topUp))}. It applies to
          everything you load, so it works like a fee on every purchase.
        </p>

        <h2 id="purchase">Fee on every purchase</h2>
        <p>
          A percentage or a flat amount on each payment, sometimes called a conversion or spread fee. {perPurchase} of the {n}{' '}
          cards charge one. A flat fee hurts most on small, frequent purchases.
        </p>

        <h2 id="small">Small-purchase fee</h2>
        <p>
          A flat fee on purchases under a set amount. {small.length} of the {n} cards charge one
          {smallForeign ? `; ${smallForeign} only on purchases in a currency other than the card's` : ''}
          {smallFree ? `; ${smallFree} ${smallFree === 1 ? 'gives' : 'give'} some free each month` : ''}. It adds up on coffees and other small, frequent
          purchases.
        </p>

        <h2 id="atm">ATM fees</h2>
        <p>
          A flat fee, a percentage, or both, often with a free amount each month on higher tiers. Each card&apos;s review lists
          its ATM terms.
        </p>
      </div>

      <section aria-labelledby="month" className="stack" style={{ gap: 14 }}>
        <div className="prose">
          <h2 id="month">What the fees cost on a {money(BASKET_USD)} month</h2>
          <p>
            Every card spending the same G2M test basket: {money(BASKET_USD)} in {BASKET_PURCHASES} purchases from $10 to $200.
            The first column is spending in the card&apos;s own currency; the second is the same month in another currency, so
            the FX fee and any foreign-only fees apply. Annual fees and cashback are not included.
          </p>
        </div>
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th scope="col">Card</th>
                <th scope="col">In its own currency</th>
                <th scope="col">In another currency</th>
                <th scope="col">Annual fee</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, home, abroad }) => (
                <tr key={c.slug}>
                  <td>
                    <Link href={`/cards/${c.slug}`}>{c.name}</Link>
                  </td>
                  <td className="num">{home == null ? 'Not published' : money(home)}</td>
                  <td className="num">{abroad == null ? 'Not published' : money(abroad)}</td>
                  <td className="num">{usd(c.fees.annualUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="faint" style={{ fontSize: 13, margin: 0 }}>
          Entry tier of each card. “Not published” means the issuer does not state a fee the month needs. Card data last
          checked {fmtDate(checked)}. <Link href="/methodology#basket">How the test basket works</Link>.
        </p>
      </section>

      <section aria-labelledby="faq" className="stack" style={{ gap: 14 }}>
        <h2 id="faq" className="h3">
          Questions
        </h2>
        {faq.map((f) => (
          <div key={f.q} className="stack" style={{ gap: 6 }}>
            <h3 style={{ fontSize: 17, margin: 0 }}>{f.q}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {f.a}
            </p>
          </div>
        ))}
        <p className="muted" style={{ margin: 0 }}>
          <Link href="/calculator">The rewards calculator</Link> puts cashback and every fee together for your own spending.
        </p>
      </section>

      <section aria-labelledby="more" className="stack" style={{ gap: 12 }}>
        <h2 id="more" className="h3">
          More guides
        </h2>
        <ul className="guide-links">
          {TOPICS.map((x) => (
            <li key={x.slug}>
              <Link href={`/guides/${x.slug}`}>{x.title}</Link>
            </li>
          ))}
          <li>
            <Link href="/guides#countries">Best crypto cards by country</Link>
          </li>
        </ul>
      </section>
    </article>
  );
}
