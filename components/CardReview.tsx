import Link from 'next/link';
import { getCards, getRank, standings } from '@/lib/cards';
import type { Card, Market, Tier } from '@/lib/types';
import { toRow } from '@/lib/types';
import { usdPrices } from '@/lib/prices';
import { MARKET_LABELS, availabilityIn, countryName, COUNTRIES } from '@/lib/regions';
import { COUNTRY_CODES, COUNTRY_NAMES } from '@/lib/countries.mjs';

/** English country name to code, for the coverage examples ("Germany" → DE), so they show in each language's own words. */
const CODE_OF: Record<string, string> = Object.fromEntries(Object.entries(COUNTRY_NAMES as Record<string, string>).map(([code, name]) => [name, code]));
import { CUSTODY_LABEL, NP, TYPE_LABEL, cashbackLabel, ecosystemFeatures, fmtDate, pct, perPurchaseFee, tierCashback, usd } from '@/lib/format';
import { SCORE_WEIGHTS } from '@/lib/score';
import { absoluteUrl, site } from '@/lib/site';
import { versusPath } from '@/lib/versus';
import { alternativesPath, alternativesTo } from '@/lib/alternatives';
import { hasReferralPage, referralPath } from '@/lib/referral';
import { type Locale, fill, hreflangOf, intlAlternatives, intlCard, intlHome, intlMethodology, intlRankings, intlReferral, intlVersus } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { formatters } from '@/lib/i18n/format';
import { note } from '@/lib/i18n/notes';
import { UI, uiEn } from '@/lib/i18n/ui';
import { intlFmt } from '@/lib/i18n/clientFormat';
import { CardArt } from '@/components/CardArt';
import { MarketBadge, ScorePill } from '@/components/bits';
import { OutboundLink } from '@/components/OutboundLink';
import { ShareBar } from '@/components/ShareBar';
import { ReferralBox } from '@/components/ReferralBox';
import { CountryStanding } from '@/components/CountryStanding';
import { CountryList } from '@/components/CountryList';
import { CountryToggle } from '@/components/CountryToggle';
import { TierBreakEven } from '@/components/TierBreakEven';
import { BackButton } from '@/components/BackButton';
import { IntlText } from '@/components/IntlText';

// The card review page, in English (/cards/[slug]) or another language (/de/cards/[slug]). One page for every
// language: English words are exactly the ones the page always had; other languages take theirs from the tool pack
// (lib/i18n/ui, "card"), their numbers from Intl, and text typed in the sheet from data/i18n (English, marked, until
// translated). Links stay in the page's language where that page exists, else go to the English tool.

const MARKETS: Market[] = ['IN', 'AE', 'US', 'GB', 'EU'];

/** Everything that differs between languages, worked out once per request. */
function context(locale?: Locale) {
  const english = !locale;
  const ui = locale ? UI[locale.code] : uiEn;
  const t = ui.card;
  const d = locale ? DICTS[locale.code] : null;
  const f = locale && d ? formatters(locale, d) : null;
  const ifmt = locale ? intlFmt(locale.tag, ui) : null;
  const P = (n: number | null | undefined, empty = NP) => (english ? pct(n, empty) : ifmt!.pct(n, empty === NP ? ui.common.notPublished : empty));
  /** In right-to-left text an amount keeps its own order ("US$ 1,000", never "1,000 US$" next to "$US 1,000"). */
  const iso = (s: string) => (locale?.dir === 'rtl' && /\d/.test(s) ? `\u2066${s}\u2069` : s);
  const U = (n: number | null | undefined, empty = NP) => (english ? usd(n, empty) : iso(ifmt!.usd(n, empty === NP ? ui.common.notPublished : empty)));
  /** A plain amount, never "Free" (for "$10 coffee", limits and caps). */
  const M = (n: number) => (english ? `$${n.toLocaleString('en-US')}` : iso(new Intl.NumberFormat(locale!.tag, { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n)));
  /** The comma between items: "，" in Chinese, "،" in Arabic. */
  const sep = locale?.code === 'zh-hk' ? '，' : locale?.code === 'ar' ? '، ' : ', ';
  const country = (cc: string) => (english ? countryName(cc) : f!.country(cc));
  const market = (m: Market) => (english ? MARKET_LABELS[m] : m === 'EU' ? ui.regions.EU : f!.country(m === 'GB' ? 'GB' : m));
  const date = (iso: string) => (english ? fmtDate(iso) : f!.date(iso));
  const list = (xs: string[], sep = ', ') => (english ? xs.join(sep) : f!.list(xs));
  /** Text typed in the sheet: translated where data/i18n has it. */
  const tx = (s: string) => (english ? s : note(locale!, s).text);
  const Tx = ({ s }: { s: string }) => (english ? <>{s}</> : <IntlText note={note(locale!, s)} label={d!.inEnglish} />);
  const range = (base: number | null, max: number | null) =>
    english
      ? cashbackLabel(base, max)
      : base == null && max == null
        ? ui.common.notPublished
        : base != null && max != null && max > base
          ? fill(ui.home.range, { a: P(base), b: P(max) })
          : base != null
            ? P(base)
            : fill(ui.common.upTo, { x: P(max) });
  const prefix = locale ? `/${locale.code}` : '';
  const href = {
    rankings: locale ? intlRankings(locale) : '/cards',
    rankingsFor: (cc: string) => `${locale ? intlRankings(locale) : '/cards'}?country=${cc}`,
    card: (slug: string) => (locale ? intlCard(locale, slug) : `/cards/${slug}`),
    versus: (a: string, b: string) => (locale ? intlVersus(locale, versusPath(a, b).split('/').pop()!) : versusPath(a, b)),
    alternatives: (slug: string) => (locale ? intlAlternatives(locale, slug) : alternativesPath(slug)),
    referral: (slug: string) => (locale ? intlReferral(locale, slug) : referralPath(slug)),
    methodology: locale ? intlMethodology(locale) : '/methodology'
  };
  return { english, locale, ui, t, d, f, P, U, M, sep, country, market, date, list, tx, Tx, range, prefix, href };
}
type Ctx = ReturnType<typeof context>;

/** A sentence with one full stop at the end, never two. */
const endStop = (s: string) => (/[.!?。]$/.test(s) ? s : `${s}.`);

/** Cashback bands of a tier ("2% up to $2,000/mo, 1% above $2,000"). */
function bandsLabel(tier: Pick<Tier, 'bands' | 'cashbackPct'>, c: Ctx) {
  if (c.english) return tierCashback(tier);
  if (tier.bands && tier.bands.length) {
    return tier.bands
      .map((b, i) => {
        const from = i === 0 ? 0 : (tier.bands![i - 1].uptoUsd ?? 0);
        return b.uptoUsd == null ? fill(c.t.bandAbove, { p: c.P(b.pct), a: c.M(from) }) : fill(c.t.bandUpTo, { p: c.P(b.pct), a: c.M(b.uptoUsd) });
      })
      .join(c.sep);
  }
  return c.P(tier.cashbackPct);
}

function perPurchase(card: Card, c: Ctx) {
  if (c.english) return perPurchaseFee(card.fees);
  const f = card.fees;
  const small = f.smallPurchase;
  const parts = [
    f.txPct ? c.P(f.txPct) : null,
    f.txFlatUsd ? c.M(f.txFlatUsd) : null,
    small
      ? `${fill(small.inclusive ? c.t.smallAtOrUnder : c.t.smallUnder, { fee: c.U(small.feeUsd), limit: c.U(small.underUsd) })}${small.foreignOnly ? c.t.nonUsd : ''}${
          small.freePerMonth ? fill(c.t.freeFirst, { n: small.freePerMonth }) : ''
        }`
      : null
  ];
  return parts.filter(Boolean).join(' + ') || c.t.noneListed;
}

function banking(card: Card, c: Ctx) {
  if (c.english) return ecosystemFeatures(card.ecosystem);
  const t = c.t;
  const e = card.ecosystem;
  const nc = c.ui.common.notConfirmed;
  const yesNo = (v: boolean | null | undefined) => (v == null ? nc : v ? c.ui.common.yes : c.ui.common.no);
  const n = e?.payoutCorridors;
  return [
    {
      label: t.bankAccount,
      value: e?.iban === 'named' ? t.inYourName : e?.iban === 'shared' ? t.sharedRef : e?.iban === 'none' ? c.ui.common.no : nc,
      on: e?.iban === 'named' || e?.iban === 'shared'
    },
    { label: t.sendBank, value: n == null ? nc : n === 0 ? c.ui.common.no : fill(t.currenciesN, { n }), on: (n ?? 0) > 0 },
    {
      label: t.buySell,
      value: e?.ramps === 'both' ? t.buyAndSell : e?.ramps === 'on' ? t.buyOnly : e?.ramps === 'off' ? t.sellOnly : e?.ramps === 'none' ? c.ui.common.no : nc,
      on: e?.ramps === 'both' || e?.ramps === 'on' || e?.ramps === 'off'
    },
    { label: t.creditLine, value: yesNo(e?.credit), on: Boolean(e?.credit) },
    { label: t.yieldLine, value: yesNo(e?.yield), on: Boolean(e?.yield) }
  ];
}

/**
 * Plain questions people search for, answered only from published card data (a question is skipped when the issuer
 * does not say). Shown on the page and sent to search engines as FAQPage data; the two must match.
 */
export function cardFaqs(card: Card, locale?: Locale): { q: string; a: string }[] {
  const c = context(locale);
  const t = c.t;
  const out: { q: string; a: string }[] = [];
  const name = card.name;
  const fee = card.fees.annualUsd;
  if (fee != null) out.push({ q: fill(t.qFee, { name }), a: fee === 0 ? t.aFeeNo : fill(t.aFeeYes, { fee: c.U(fee) }) });
  const { basePct, maxPct, payout } = card.cashback;
  if (basePct != null || maxPct != null) {
    const none = !basePct && !maxPct;
    out.push({
      q: fill(t.qCb, { name }),
      a: none ? t.aCbNone : payout ? fill(t.aCbPaid, { cb: c.range(basePct, maxPct), payout: c.tx(payout) }) : fill(t.aCb, { cb: c.range(basePct, maxPct) })
    });
  }
  const fx = card.fees.fxPct;
  if (fx != null) {
    const free = Object.entries(card.fees.fxByCurrency ?? {})
      .filter(([, v]) => v === 0)
      .map(([k]) => k);
    out.push({
      q: fill(t.qFx, { name }),
      a: fx === 0 ? fill(t.aFxNone, { zero: c.P(0) }) : free.length ? fill(t.aFxFree, { fx: c.P(fx), list: c.list(free, ' and ') }) : fill(t.aFx, { fx: c.P(fx) })
    });
  }
  if (card.custody !== 'unknown') {
    out.push({
      q: fill(t.qCustody, { name }),
      a: card.custody === 'custodial' ? t.aCustodial : card.custody === 'both' ? t.aBoth : t.aNonCustodial
    });
  }
  const yes = MARKETS.filter((m) => card.coverage.markets[m] === 'yes').map(c.market);
  const no = MARKETS.filter((m) => card.coverage.markets[m] === 'no').map(c.market);
  if (card.coverage.scope || yes.length || no.length) {
    out.push({
      q: fill(t.qWhere, { name }),
      a: [
        card.coverage.scope ? endStop(c.tx(card.coverage.scope)) : '',
        yes.length ? fill(t.confirmedIn, { list: c.list(yes) }) : '',
        no.length ? fill(t.notIn, { list: c.list(no) }) : ''
      ]
        .filter(Boolean)
        .join(' ')
    });
  }
  if (card.noIdCheck) {
    out.push({
      q: fill(t.qNoId, { name }),
      a: card.noIdCheck.toLowerCase() === 'yes' ? t.aNoIdYes : fill(t.aNoIdPart, { x: c.tx(card.noIdCheck) })
    });
  }
  if (card.links.affiliate && card.signupBonus) {
    out.push({ q: fill(t.qBonus, { name }), a: fill(t.aBonus, { bonus: c.tx(card.signupBonus) }) });
  }
  return out;
}

/** Structured data for search engines: the card, G2M's review of it, the questions and the breadcrumb. */
export function cardJsonLd(card: Card, locale?: Locale) {
  const c = context(locale);
  const url = absoluteUrl(c.href.card(card.slug));
  const summary = c.tx(card.summary);
  const faqs = cardFaqs(card, locale);
  const clean = (s: string) => s.replace(/[⁦-⁩‎‏؜]/g, '');
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'PaymentCard',
      name: card.name,
      description: summary,
      url,
      ...(locale ? { inLanguage: hreflangOf(locale) } : {}),
      brand: { '@type': 'Brand', name: card.brand },
      provider: { '@type': 'Organization', name: card.brand, url: card.links.official },
      contactlessPayment: true,
      ...(card.cashback.basePct != null || card.cashback.maxPct != null
        ? { cashBack: (card.cashback.basePct ?? card.cashback.maxPct ?? 0) / 100 }
        : {}),
      feesAndCommissionsSpecification: c.english
        ? `Annual fee: ${usd(card.fees.annualUsd)}. FX fee: ${pct(card.fees.fxPct)}.`
        : clean(`${c.t.annualFee}: ${c.U(card.fees.annualUsd)}. ${c.t.fxFee}: ${c.P(card.fees.fxPct)}.`),
      areaServed: c.tx(card.coverage.scope)
    },
    {
      // An editorial review: G2M's score as the rating, out of 100.
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: card.name,
      description: summary,
      url,
      category: 'Crypto card',
      brand: { '@type': 'Brand', name: card.brand },
      ...(card.image ? { image: absoluteUrl(card.image.file.replace(/\.webp$/, '.png')) } : {}),
      review: {
        '@type': 'Review',
        author: { '@type': 'Organization', name: site.name, url: site.url },
        datePublished: card.lastChecked,
        reviewBody: summary,
        ...(locale ? { inLanguage: hreflangOf(locale) } : {}),
        reviewRating: { '@type': 'Rating', ratingValue: card.score.total, bestRating: 100, worstRating: 0 }
      }
    },
    ...(faqs.length
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            ...(locale ? { inLanguage: hreflangOf(locale) } : {}),
            mainEntity: faqs.map((x) => ({ '@type': 'Question', name: clean(x.q), acceptedAnswer: { '@type': 'Answer', text: clean(x.a) } }))
          }
        ]
      : []),
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'G2M', item: locale ? absoluteUrl(intlHome(locale)) : site.url },
        { '@type': 'ListItem', position: 2, name: c.t.rankings, item: absoluteUrl(c.href.rankings) },
        { '@type': 'ListItem', position: 3, name: card.name, item: url }
      ]
    }
  ];
}

export async function CardReview({ card, locale }: { card: Card; locale?: Locale }) {
  const c = context(locale);
  const { t, english, ui, Tx } = c;
  const all = getCards();
  const rank = getRank(card.slug);
  // The card's answer for every country (its own list, else the five checked markets).
  const status = Object.fromEntries(COUNTRY_CODES.map((cc: string) => [cc, availabilityIn(card, cc)]));
  const confirmed = COUNTRY_CODES.filter((cc: string) => status[cc] === 'yes');
  const row = toRow(card);
  // Live token prices for staking tiers (cached for an hour; null-safe).
  const [prices] = await Promise.all([
    // Every card's staking tokens in one request, shared by all card pages.
    usdPrices(all.flatMap((x) => x.tiers.flatMap((tier) => (tier.stake?.coingeckoId ? [tier.stake.coingeckoId] : []))))
  ]);
  // Country names from the server for the client parts, so the server HTML and the browser agree (see intlFmt).
  const countryNames = english ? undefined : Object.fromEntries(COUNTRIES.map((x) => [x.code, c.country(x.code)]));
  const tag = locale?.tag;

  // Alternatives: the best-scored cards that are available in at least one of the same confirmed markets.
  const alternatives = alternativesTo(card, all, 3);

  // Head-to-head pages: the cards ranked nearest to this one, then the top of the rankings.
  const others = all.filter((x) => x.slug !== card.slug);
  const matchups = [...others].sort((x, y) => Math.abs(x.rank - rank) - Math.abs(y.rank - rank) || x.rank - y.rank).slice(0, 6);
  for (const x of others.slice(0, 3)) if (!matchups.includes(x)) matchups.push(x);
  matchups.sort((x, y) => x.rank - y.rank);

  const breakdown = [
    { label: t.rewards, value: card.score.rewards, max: SCORE_WEIGHTS.rewards },
    { label: t.fees, value: card.score.fees, max: SCORE_WEIGHTS.fees },
    { label: t.coverage, value: card.score.coverage, max: SCORE_WEIGHTS.coverage },
    { label: t.ecosystem, value: card.score.ecosystem, max: SCORE_WEIGHTS.ecosystem },
    { label: t.control, value: card.score.control, max: SCORE_WEIGHTS.control }
  ];

  const wallets = [card.wallets.applePay ? 'Apple Pay' : null, card.wallets.googlePay ? 'Google Pay' : null].filter(Boolean);
  const walletText =
    wallets.length > 0 ? wallets.join(' + ') : card.wallets.applePay === false && card.wallets.googlePay === false ? t.notSupported : english ? NP : ui.common.notPublished;
  const typeLabel = english
    ? TYPE_LABEL[card.type]
    : { debit: t.typeDebit, credit: t.typeCredit, prepaid: t.typePrepaid, spend: t.typeSpend, mixed: t.typeMixed }[card.type];
  const custodyLabel = english
    ? CUSTODY_LABEL[card.custody]
    : { 'self-custodial': ui.common.nonCustodial, custodial: ui.common.custodial, both: ui.common.custodyBoth, unknown: ui.common.notPublished }[card.custody];
  const forms = english ? card.forms.join(', ') : card.forms.map((x) => ({ virtual: t.formVirtual, physical: t.formPhysical, metal: t.formMetal })[x] ?? x).join(c.sep);
  const kyc = { residency_id: t.kycResidency, passport_strict: t.kycPassport, both: t.kycBoth } as const;
  const faqs = cardFaqs(card, locale);
  const np = english ? 'Not published' : ui.common.notPublished;
  const cb = c.range(card.cashback.basePct, card.cashback.maxPct);

  return (
    <article className="wrap section stack" style={{ gap: 40 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(cardJsonLd(card, locale)) }} />

      <div className="back-row">
        <BackButton fallback={c.href.rankings} label={t.back} />
        <nav aria-label="Breadcrumb" className="faint" style={{ fontSize: 14 }}>
          <Link href={c.href.rankings} style={{ textDecoration: 'none' }}>
            {t.rankings}
          </Link>{' '}
          / <span aria-current="page">{card.name}</span>
        </nav>
      </div>

      {/* Hero */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'center' }}>
        <div style={{ flex: '1 1 420px', minWidth: 0 }} className="stack">
          <div className="stack" style={{ gap: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="badge badge-accent">{fill(t.rankOf, { rank, n: all.length })}</span>
              <span className="badge badge-unknown">{card.network}</span>
              <span className="badge badge-unknown">{typeLabel}</span>
              <span className={`badge ${card.custody === 'self-custodial' || card.custody === 'both' ? 'badge-accent' : 'badge-unknown'}`}>{custodyLabel}</span>
              {card.noIdCheck ? (
                <span className="badge badge-accent" title={t.noIdTitle}>
                  {card.noIdCheck.toLowerCase() === 'yes' ? t.noId : english ? `No ID check: ${card.noIdCheck}` : fill(t.noIdWhat, { x: c.tx(card.noIdCheck) })}
                </span>
              ) : null}
            </div>
            <h1 className="h2" style={{ fontSize: 'clamp(2rem, 4.4vw, 3.2rem)' }}>
              {card.name}
            </h1>
            <p className="lead">
              <Tx s={card.summary} />
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <OutboundLink slug={card.slug} name={card.brand} placement={english ? 'card-hero' : `intl-${locale!.code}-card-hero`}>
                {fill(t.getBrand, { brand: card.brand })}
              </OutboundLink>
              <Link href={`${c.prefix}/compare?c=${[card.slug, ...alternatives.slice(0, 2).map((a) => a.slug)].join(',')}`} className="btn">
                {t.compare}
              </Link>
            </div>
            {card.links.affiliate ? (
              <ReferralBox
                slug={card.slug}
                brand={card.brand}
                bonus={card.signupBonus ? c.tx(card.signupBonus) : undefined}
                code={card.referralCode}
                words={english ? undefined : t}
              />
            ) : null}
            {hasReferralPage(card) ? (
              <Link href={c.href.referral(card.slug)} className="muted" style={{ fontSize: 14 }}>
                {fill(card.referralCode ? t.refHowCode : t.refHowLink, { brand: card.brand })}
              </Link>
            ) : null}
            <ShareBar
              text={fill(t.shareText, { name: card.name, score: card.score.total, cb: english ? cashbackLabel(card.cashback.basePct, card.cashback.maxPct) : cb })}
              label={t.shareLabel}
              words={english ? undefined : ui.common}
            />
          </div>
        </div>
        <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
          <CardArt card={card} width="min(100%, 380px)" style={{ boxShadow: 'var(--card-shadow)', transform: 'rotate(-4deg)' }} />
        </div>
      </div>

      {/* Key facts */}
      <section aria-labelledby="facts" className="stack" style={{ gap: 14 }}>
        <h2 id="facts" className="h3">
          {t.keyFacts}
        </h2>
        <dl className="facts">
          <div className="fact">
            <dt>{t.cashback}</dt>
            <dd>
              {cb}
              {card.cashback.payout ? <small> {fill(t.paidIn, { x: c.tx(card.cashback.payout) })}</small> : null}
            </dd>
          </div>
          <div className="fact">
            <dt>{t.annualFee}</dt>
            <dd>{c.U(card.fees.annualUsd)}</dd>
          </div>
          <div className="fact">
            <dt>{t.fxFee}</dt>
            <dd>{c.P(card.fees.fxPct)}</dd>
          </div>
          <div className="fact">
            <dt>{t.topUpFee}</dt>
            <dd>{c.P(card.fees.topUpPct)}</dd>
          </div>
          <div className="fact">
            <dt>{t.perPurchase}</dt>
            <dd>{perPurchase(card, c)}</dd>
          </div>
          <div className="fact">
            <dt>{t.atm}</dt>
            <dd style={{ fontSize: 15, fontWeight: 600 }}>{card.fees.atm ? <Tx s={card.fees.atm} /> : np}</dd>
          </div>
          <div className="fact">
            <dt>{t.cardTypes}</dt>
            <dd style={{ textTransform: 'capitalize' }}>{forms}</dd>
          </div>
          <div className="fact">
            <dt>{t.wallets}</dt>
            <dd>{walletText}</dd>
          </div>
        </dl>
        {card.cashback.note || card.fees.fxNote ? (
          <div className="stack" style={{ gap: 6 }}>
            {card.cashback.note ? (
              <p className="muted" style={{ fontSize: 14 }}>
                {english ? `Cashback: ${card.cashback.note}` : fill(t.cbNote, { x: c.tx(card.cashback.note) })}
              </p>
            ) : null}
            {card.fees.fxNote ? (
              <p className="muted" style={{ fontSize: 14 }}>
                {english ? `FX: ${card.fees.fxNote}` : fill(t.fxNote, { x: c.tx(card.fees.fxNote) })}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="grid-2">
        {/* Score */}
        <section className="panel panel-pad stack" style={{ gap: 18 }} aria-labelledby="score">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <h2 id="score" className="h3">
              {t.scoreTitle}{' '}
              <span className="faint" style={{ fontSize: 14, fontWeight: 500 }}>
                {t.worldwide}
              </span>
            </h2>
            {/* paddingRight: the metal fill only paints inside the box, and tight letter-spacing pushes the last digit past it. */}
            <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', paddingRight: '0.12em' }} className="metal-text num">
              {card.score.total}
              <span style={{ fontSize: 16 }}>/100</span>
            </span>
          </div>
          <CountryStanding standings={standings(card.slug)} words={english ? undefined : t} prefix={c.prefix} countryNames={countryNames} />
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
          <Link href={c.href.methodology} className="muted" style={{ fontSize: 14 }}>
            {t.howScore}
          </Link>
        </section>

        {/* Availability */}
        <section className="panel panel-pad stack" style={{ gap: 16 }} aria-labelledby="where">
          <h2 id="where" className="h3">
            {t.where}
          </h2>
          <ul className="list-plain">
            {MARKETS.map((m) => (
              <li key={m} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{c.market(m)}</span>
                <MarketBadge value={card.coverage.markets[m]} market={m} where={english ? undefined : c.market(m)} words={english ? undefined : ui.common} />
              </li>
            ))}
          </ul>
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>
            <Tx s={card.coverage.scope} />
            {/* Skip the count when the description already says it ("48 countries incl. ..."). */}
            {card.coverage.countries && !card.coverage.scope.includes(String(card.coverage.countries))
              ? ` · ${english ? `${card.coverage.countries} countries` : fill(t.countriesN, { n: card.coverage.countries })}`
              : ''}
            {/* No second full stop when the description already ends with one. */}
            {/[.!?。]$/.test(english ? card.coverage.scope : c.tx(card.coverage.scope)) &&
            !(card.coverage.countries && !card.coverage.scope.includes(String(card.coverage.countries)))
              ? ''
              : '.'}{' '}
            {card.coverage.examples.length
              ? english
                ? `Includes ${card.coverage.examples.join(', ')}.`
                : fill(t.includes, { list: c.list(card.coverage.examples.map((x) => (CODE_OF[x] ? c.country(CODE_OF[x]) : c.tx(x)))) })
              : ''}
          </p>
          <CountryToggle
            target="countries"
            label={
              confirmed.length
                ? english
                  ? `See all ${confirmed.length} ${confirmed.length === 1 ? 'country' : 'countries'} it works in`
                  : fill(t.seeCountries, { n: confirmed.length })
                : t.checkCountry
            }
            hideLabel={t.hideList}
          />
        </section>
      </div>

      {/* Every country, by region: closed until "See all countries" is clicked */}
      <section id="countries" hidden aria-labelledby="countries-title" className="panel panel-pad stack" style={{ gap: 16, scrollMarginTop: 90 }}>
        <h2 id="countries-title" className="h3">
          {t.countries}
        </h2>
        <CountryList
          cardName={card.name}
          status={status}
          complete={card.coverage.countryList?.others === 'no'}
          words={english ? undefined : t}
          common={english ? undefined : ui.common}
          tag={tag}
          countryNames={countryNames}
        />
      </section>

      {/* Ecosystem and banking */}
      <section aria-labelledby="banking" className="stack" style={{ gap: 14 }}>
        <h2 id="banking" className="h3">
          {t.banking}
        </h2>
        <dl className="facts">
          {banking(card, c).map((x) => (
            <div className="fact" key={x.label}>
              <dt>{x.label}</dt>
              <dd style={{ color: x.on ? undefined : 'var(--faint)' }}>{x.value}</dd>
            </div>
          ))}
          <div className="fact">
            <dt>{t.kycTitle}</dt>
            <dd style={{ color: card.kycRule ? undefined : 'var(--faint)' }}>{card.kycRule ? kyc[card.kycRule] : np}</dd>
          </div>
          <div className="fact">
            <dt>{t.citizensOut}</dt>
            <dd style={{ color: card.restrictedPassports?.length ? undefined : 'var(--faint)' }}>
              {card.restrictedPassports == null
                ? np
                : card.restrictedPassports.length
                  ? english
                    ? card.restrictedPassports.map(countryName).join(', ')
                    : c.list(card.restrictedPassports.map(c.country))
                  : t.nationalityNone}
            </dd>
          </div>
        </dl>
      </section>

      {/* Tiers */}
      <section aria-labelledby="tiers" className="stack" style={{ gap: 14 }}>
        <h2 id="tiers" className="h3">
          {t.tiers}
        </h2>
        {card.tiers.length > 1 ? <TierBreakEven card={row} prices={prices} words={english ? undefined : t} tag={tag} /> : null}
        <div className="table-wrap stack-wrap">
          <table className="table stack-table" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th scope="col">{t.tier}</th>
                <th scope="col">{t.costYear}</th>
                <th scope="col">{t.cashback}</th>
                <th scope="col">{t.monthlyCap}</th>
                <th scope="col">{t.fxFee}</th>
                <th scope="col">{t.howGet}</th>
                <th scope="col">{t.perks}</th>
              </tr>
            </thead>
            <tbody>
              {card.tiers.map((tier) => (
                <tr key={tier.name}>
                  <td style={{ fontWeight: 650 }}>
                    {english ? tier.name : c.tx(tier.name)}
                    {tier.comingSoon ? (
                      <span className="badge badge-warn" style={{ marginLeft: 8 }}>
                        {t.comingSoon}
                      </span>
                    ) : null}
                  </td>
                  <td className="num" data-label={t.costYear}>
                    {c.U(tier.feeUsdYear)}
                    {tier.feeNote ? (
                      <span className="faint" style={{ display: 'block', fontSize: 12 }}>
                        <Tx s={tier.feeNote} />
                      </span>
                    ) : null}
                  </td>
                  <td className="num" data-label={t.cashback}>
                    {bandsLabel(tier, c)}
                  </td>
                  <td className="num" data-label={t.monthlyCap}>
                    {tier.capMonthlyUsd != null ? c.U(tier.capMonthlyUsd) : '—'}
                  </td>
                  <td className="num" data-label={t.fxFee}>
                    {c.P(tier.fxPct ?? card.fees.fxPct)}
                  </td>
                  <td style={{ fontSize: 14 }} data-label={t.howGet}>
                    {tier.requirement ? <Tx s={tier.requirement} /> : tier.feeUsdYear === 0 ? t.freeJoin : '—'}
                  </td>
                  <td style={{ fontSize: 14 }} data-label={t.perks}>
                    {tier.perks.length ? english ? tier.perks.join(' · ') : tier.perks.map(c.tx).join(' · ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* One purchase, line by line */}
      <section id="receipt" aria-labelledby="receipt-title" className="stack" style={{ gap: 14, scrollMarginTop: 90 }}>
        <div className="stack" style={{ gap: 4 }}>
          <h2 id="receipt-title" className="h3">
            {t.receiptTitle}
          </h2>
          <p className="muted" style={{ margin: 0, fontSize: 15 }}>
            {fill(t.receiptLead, { name: card.name })}
          </p>
        </div>
        <Link href={`/receipt?card=${card.slug}`} className="wallet-teaser" hrefLang={english ? undefined : 'en'}>
          <span className="field-label">[ {t.receiptTag} ]</span>
          <span className="wallet-teaser-text">{fill(t.receiptText, { a: c.M(10), b: c.M(50), c: c.M(200), name: card.name })}</span>
          <span className="wallet-teaser-cta">
            {t.receiptCta} <span aria-hidden="true">{locale?.dir === 'rtl' ? '←' : '→'}</span>
          </span>
        </Link>
      </section>

      <div className="grid-2">
        <section className="panel panel-pad stack" style={{ gap: 14 }} aria-labelledby="good">
          <h2 id="good" className="h3">
            {t.good}
          </h2>
          <ul className="list-plain">
            {card.pros.map((p) => (
              <li key={p}>
                <span className="dot" style={{ background: 'var(--ok)' }} />
                <Tx s={p} />
              </li>
            ))}
          </ul>
        </section>
        <section className="panel panel-pad stack" style={{ gap: 14 }} aria-labelledby="watch">
          <h2 id="watch" className="h3">
            {t.watch}
          </h2>
          <ul className="list-plain">
            {card.cons.map((p) => (
              <li key={p}>
                <span className="dot" style={{ background: 'var(--bad)' }} />
                <Tx s={p} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      {card.fees.other.length || card.assets.length || card.perks.length ? (
        <section className="stack" style={{ gap: 14 }} aria-labelledby="more">
          <h2 id="more" className="h3">
            {t.more}
          </h2>
          <dl className="facts">
            {card.fees.other.length ? (
              <div className="fact" style={{ gridColumn: '1 / -1' }}>
                <dt>{t.otherFees}</dt>
                <dd style={{ fontSize: 15, fontWeight: 500 }}>{english ? card.fees.other.join(' · ') : card.fees.other.map(c.tx).join(' · ')}</dd>
              </div>
            ) : null}
            {card.perks.length ? (
              <div className="fact" style={{ gridColumn: '1 / -1' }}>
                <dt>{t.perks}</dt>
                <dd style={{ fontSize: 15, fontWeight: 500 }}>{english ? card.perks.join(' · ') : card.perks.map(c.tx).join(' · ')}</dd>
              </div>
            ) : null}
            {card.assets.length ? (
              <div className="fact" style={{ gridColumn: '1 / -1' }}>
                <dt>{t.spendFrom}</dt>
                <dd style={{ fontSize: 15, fontWeight: 500 }}>{card.assets.join(c.sep)}</dd>
              </div>
            ) : null}
            {card.issuer ? (
              <div className="fact" style={{ gridColumn: '1 / -1' }}>
                <dt>{t.issuer}</dt>
                <dd style={{ fontSize: 15, fontWeight: 500 }}>{card.issuer}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {/* Questions (the same text is sent as FAQPage data) */}
      {faqs.length ? (
        <section className="stack" style={{ gap: 14 }} aria-labelledby="faq">
          <h2 id="faq" className="h3">
            {fill(t.faqTitle, { name: card.name })}
          </h2>
          <dl className="faq-list">
            {faqs.map((x) => (
              <div key={x.q}>
                <dt>{x.q}</dt>
                <dd>{x.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* Sources */}
      <section className="notice stack" style={{ gap: 10 }} aria-labelledby="sources">
        <h2 id="sources" style={{ fontSize: 15, color: 'var(--text)' }}>
          {fill(t.sources, { date: c.date(card.lastChecked) })}
        </h2>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {card.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" lang={english ? undefined : 'en'}>
                {s.label}
              </a>
              {s.verified ? <span className="faint"> · {c.date(s.verified)}</span> : null}
            </li>
          ))}
        </ul>
        <p>
          {t.termsA}{' '}
          <a href={card.links.official} target="_blank" rel="noopener noreferrer">
            {fill(t.officialSite, { brand: card.brand })}
          </a>
          {/^[,.;:]/.test(t.termsB) ? '' : ' '}
          {t.termsB}{' '}
          <Link href={`/submit?card=${card.slug}`} hrefLang={english ? undefined : 'en'}>
            {t.tellUs}
          </Link>
          .
        </p>
      </section>

      {/* Head-to-head pages */}
      <section className="stack" style={{ gap: 14 }} aria-labelledby="versus">
        <h2 id="versus" className="h3">
          {fill(t.compareWith, { name: card.name })}
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {matchups.map((m) => (
            <Link key={m.slug} href={c.href.versus(card.slug, m.slug)} className="chip">
              {fill(t.vs, { a: card.brand, b: m.brand })}
            </Link>
          ))}
        </div>
      </section>

      {/* Alternatives */}
      {alternatives.length ? (
        <section className="stack" style={{ gap: 14 }} aria-labelledby="alts">
          <div className="pager">
            <h2 id="alts" className="h3">
              {t.alsoWorth}
            </h2>
            <Link href={c.href.alternatives(card.slug)} className="muted" style={{ fontSize: 15 }}>
              {fill(t.allAlts, { brand: card.brand })}
            </Link>
          </div>
          <div className="grid-3">
            {alternatives.map((a) => (
              <Link
                key={a.slug}
                href={c.href.card(a.slug)}
                className="panel panel-pad"
                style={{ textDecoration: 'none', display: 'flex', gap: 14, alignItems: 'center' }}
              >
                <CardArt card={a} width={84} />
                <span className="stack" style={{ gap: 4, minWidth: 0 }}>
                  <b>{a.name}</b>
                  <span className="faint" style={{ fontSize: 14 }}>
                    {fill(t.cbBack, { cb: c.range(a.cashback.basePct, a.cashback.maxPct) })}
                  </span>
                  <ScorePill value={a.score.total} label={english ? undefined : t.scoreTitle} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
