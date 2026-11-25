import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCard, getCards } from '@/lib/cards';
import { cashbackLabel, fmtDate, pct, usd } from '@/lib/format';
import { hasReferralPage, referralPath } from '@/lib/referral';
import { shortName } from '@/lib/versus';
import { absoluteUrl, metaDescription, shareMeta, site } from '@/lib/site';
import { CardArt } from '@/components/CardArt';
import { Eyebrow, ScorePill } from '@/components/bits';
import { OutboundLink } from '@/components/OutboundLink';
import { ReferralBox } from '@/components/ReferralBox';
import { intlReferral, languageLinks } from '@/lib/i18n/locales';

// "X referral code": the code, what a new user gets for it in the issuer's own terms, and how to use it.
// Built only from the sheet (referral link, code, sign-up bonus), so it changes when the sheet does.
// Built ahead of time at every deploy (the card data is bundled, and each sheet sync deploys), so the page is served
// ready-made instead of being put together on each visit. See open-next.config.ts.
export function generateStaticParams() {
  return getCards()
    .filter(hasReferralPage)
    .map((c) => ({ slug: c.slug }));
}


type Props = { params: Promise<{ slug: string }> };

const load = (slug: string) => {
  const card = getCard(slug);
  return card && hasReferralPage(card) ? card : null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const card = load(slug);
  if (!card) return {};
  const year = new Date().getUTCFullYear();
  const name = shortName(card.name);
  const code = card.referralCode;
  const title = code ? `${name} Referral Code ${year}: ${code}` : `${name} Referral Link ${year}: Sign-Up Bonus`;
  const description = `${code ? `${card.name} referral code: ${code}. ` : `${card.name} referral link. `}${
    card.signupBonus ? `Sign-up bonus: ${card.signupBonus}. ` : ''
  }How to use it, step by step.`.slice(0, 300);
  return {
    title: title.length + ' · G2M'.length <= 60 ? title : { absolute: title },
    description: metaDescription(description),
    alternates: { canonical: referralPath(card.slug), languages: languageLinks(referralPath(card.slug), (l) => intlReferral(l, card.slug)) },
    ...shareMeta(`${name} referral code · G2M`, description, referralPath(card.slug), `/cards/${card.slug}/opengraph-image`)
  };
}

export default async function ReferralCodePage({ params }: Props) {
  const { slug } = await params;
  const card = load(slug);
  if (!card) notFound();
  const name = shortName(card.name);
  const code = card.referralCode;
  const bonus = card.signupBonus;
  const url = absoluteUrl(referralPath(card.slug));
  const others = getCards()
    .filter((c) => c.slug !== card.slug && hasReferralPage(c))
    .slice(0, 8);

  const steps = [
    `Press "Get the ${card.name}" on this page. It opens ${card.brand} through G2M's referral link${code ? ', which carries the code where the issuer supports that' : ''}.`,
    card.noIdCheck
      ? `Create your ${card.brand} account. ${card.noIdCheck === 'yes' ? 'The issuer says no ID check is needed.' : `The issuer says no ID check is needed for: ${card.noIdCheck}.`}`
      : `Create your ${card.brand} account and complete the identity check if the issuer asks for one.`,
    code
      ? `If the sign-up form or the app asks for a referral or invite code, enter ${code}. Do it at sign-up: most issuers do not accept a code later.`
      : 'No code to type: the link itself tells the issuer you came through G2M.',
    bonus ? `Meet the issuer's conditions to get the bonus: ${bonus}.` : 'Order or activate the card in the app.'
  ];

  const faq = [
    code
      ? { q: `What is the ${card.name} referral code?`, a: `G2M's ${card.brand} referral code is ${code}. Enter it when you sign up, or join through G2M's link.` }
      : { q: `Is there a ${card.name} referral code?`, a: `${card.brand} uses a referral link, not a code you type. Join through the link on this page.` },
    {
      q: `What do I get with the ${card.name} referral ${code ? 'code' : 'link'}?`,
      a: bonus
        ? `${bonus}. These are ${card.brand}'s own terms and they can change.`
        : `${card.brand} publishes no sign-up bonus for new users at the moment. The card's fees and cashback are the same with or without the code.`
    },
    {
      q: `Does using the referral ${code ? 'code' : 'link'} change the card's fees?`,
      a: `No. The ${card.name} costs the same either way: ${
        card.fees.annualUsd == null ? 'annual fee not published' : card.fees.annualUsd === 0 ? 'no annual fee' : `${usd(card.fees.annualUsd)} a year`
      }, ${card.fees.fxPct == null ? 'FX fee not published' : card.fees.fxPct === 0 ? 'no FX fee' : `${pct(card.fees.fxPct)} FX fee`}. G2M may earn a referral fee, which never changes a card's score or rank.`
    }
  ];

  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: `How to use the ${card.name} referral ${code ? 'code' : 'link'}`,
      step: steps.map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'G2M', item: site.url },
        { '@type': 'ListItem', position: 2, name: 'Cards', item: absoluteUrl('/cards') },
        { '@type': 'ListItem', position: 3, name: card.name, item: absoluteUrl(`/cards/${card.slug}`) },
        { '@type': 'ListItem', position: 4, name: 'Referral code', item: url }
      ]
    }
  ];

  return (
    <article className="wrap section stack" style={{ gap: 36, maxWidth: 860 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="stack" style={{ gap: 12 }}>
        <div className="back-row">
          <nav aria-label="Breadcrumb" className="faint" style={{ fontSize: 14 }}>
            <Link href="/cards" style={{ textDecoration: 'none' }}>
              Cards
            </Link>{' '}
            /{' '}
            <Link href={`/cards/${card.slug}`} style={{ textDecoration: 'none' }}>
              {card.name}
            </Link>{' '}
            / <span aria-current="page">Referral code</span>
          </nav>
        </div>
        <Eyebrow>referral code</Eyebrow>
        <h1 className="h2">
          {name} referral {code ? 'code' : 'link'}
        </h1>
        <p className="lead">
          {code ? (
            <>
              The {card.name} referral code is <b className="mono">{code}</b>.{' '}
            </>
          ) : (
            <>The {card.name} has a referral link, with no code to type. </>
          )}
          {bonus ? <>New users get: {bonus}.</> : <>{card.brand} publishes no sign-up bonus for new users at the moment.</>}
        </p>
      </div>

      <div className="panel panel-pad ref-hero">
        <Link href={`/cards/${card.slug}`} className="ref-hero-art" aria-label={card.name}>
          <CardArt card={card} width={220} />
        </Link>
        <div className="stack" style={{ gap: 14, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <b style={{ fontSize: 18 }}>{card.name}</b>
            <ScorePill value={card.score.total} />
          </div>
          <ReferralBox slug={card.slug} brand={card.brand} bonus={bonus} code={code} />
          <div className="pick-actions">
            <OutboundLink slug={card.slug} name={card.name} placement={`referral-${card.slug}`} className="btn btn-metal" />
            <Link href={`/cards/${card.slug}`} className="btn">
              Read the review
            </Link>
          </div>
        </div>
      </div>

      <section aria-labelledby="how" className="stack" style={{ gap: 12 }}>
        <h2 id="how" className="h3">
          How to use the {name} referral {code ? 'code' : 'link'}
        </h2>
        <ol className="ref-steps">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="facts" className="stack" style={{ gap: 12 }}>
        <h2 id="facts" className="h3">
          The {card.name} in short
        </h2>
        <dl className="pick-facts guide-facts">
          <div>
            <dt>Cashback</dt>
            <dd>{cashbackLabel(card.cashback.basePct, card.cashback.maxPct)}</dd>
          </div>
          <div>
            <dt>Annual fee</dt>
            <dd>{usd(card.fees.annualUsd)}</dd>
          </div>
          <div>
            <dt>FX fee</dt>
            <dd>{pct(card.fees.fxPct)}</dd>
          </div>
          <div>
            <dt>G2M rank</dt>
            <dd>
              #{card.rank} of {getCards().length}
            </dd>
          </div>
        </dl>
        <p className="muted" style={{ margin: 0 }}>
          {card.summary}
        </p>
        <p className="faint" style={{ fontSize: 13, margin: 0 }}>
          Checked {fmtDate(card.lastChecked)}; the <Link href={`/cards/${card.slug}`}>review</Link> lists every fee and its
          sources. A bonus is paid once, fees are paid every month: pick the card for its terms first.
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
      </section>

      {others.length ? (
        <section aria-labelledby="more" className="stack" style={{ gap: 12 }}>
          <h2 id="more" className="h3">
            More referral codes
          </h2>
          <ul className="guide-links">
            {others.map((c) => (
              <li key={c.slug}>
                <Link href={referralPath(c.slug)}>{shortName(c.name)} referral code</Link>
              </li>
            ))}
            <li>
              <Link href="/guides/crypto-card-sign-up-bonuses">All sign-up bonuses</Link>
            </li>
          </ul>
        </section>
      ) : null}
    </article>
  );
}
