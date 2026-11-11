import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCard, getCards } from '@/lib/cards';
import { hasReferralPage, referralPath } from '@/lib/referral';
import { shortName } from '@/lib/versus';
import { LOCALES, fill, hreflangOf, intlCard, intlHome, intlReferral, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { clean, formatters } from '@/lib/i18n/format';
import { note, noteOrNull } from '@/lib/i18n/notes';
import { absoluteUrl, shareMeta, site } from '@/lib/site';
import { CardArt } from '@/components/CardArt';
import { Eyebrow } from '@/components/bits';
import { OutboundLink } from '@/components/OutboundLink';
import { IntlScore } from '@/components/IntlCardList';
import { IntlText } from '@/components/IntlText';

// "X referral code" in another language: the code, the sign-up bonus in the issuer's terms (translated in
// data/i18n), and the steps. Only for cards with G2M's referral link and a code or bonus. Built ahead of time.
type Props = { params: Promise<{ lang: string; slug: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  const cards = getCards().filter(hasReferralPage);
  return LOCALES.flatMap((l) => cards.map((c) => ({ lang: l.code, slug: c.slug })));
}

function load(lang: string, slug: string) {
  const locale = localeByCode(lang);
  const card = getCard(slug);
  return locale && card && hasReferralPage(card) ? { locale, card, d: DICTS[locale.code] } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  const x = load(lang, slug);
  if (!x) return {};
  const { locale, card, d } = x;
  const f = formatters(locale, d);
  const vars = { name: shortName(card.name), code: card.referralCode ?? '', year: new Date().getUTCFullYear() };
  const title = fill(card.referralCode ? d.refTitleCode : d.refTitleLink, vars);
  // The bonus goes in the search result only when it is translated: no English inside a translated description.
  const bonus = card.signupBonus ? noteOrNull(locale, card.signupBonus) : null;
  const description = clean(`${fill(card.referralCode ? d.refDescCode : d.refDescLink, { ...vars, name: card.name })}${bonus ? ` ${d.bonus}${f.colon}${bonus}.` : ''}`).slice(0, 300);
  const path = intlReferral(locale, card.slug);
  return {
    title: { absolute: `${title} · ${site.name}` },
    description,
    alternates: { canonical: path, languages: languageLinks(referralPath(card.slug), (l) => intlReferral(l, card.slug)) },
    ...shareMeta(title, description, path, `/cards/${card.slug}/opengraph-image`)
  };
}

export default async function IntlReferralPage({ params }: Props) {
  const { lang, slug } = await params;
  const x = load(lang, slug);
  if (!x) notFound();
  const { locale, card, d } = x;
  const f = formatters(locale, d);
  const code = card.referralCode;
  const bonus = card.signupBonus ? note(locale, card.signupBonus) : null;
  const vars = { name: f.name(card.name), code: code ?? '', button: d.getCard };
  const steps = [fill(d.refStep1, vars), d.refStep2, code ? fill(d.refStep3Code, vars) : d.refStep3Link, bonus ? d.refStep4Bonus : d.refStep4];
  const others = getCards()
    .filter((c) => c.slug !== card.slug && hasReferralPage(c))
    .slice(0, 8);
  const path = intlReferral(locale, card.slug);
  const h1 = fill(code ? d.refH1Code : d.refH1Link, { name: f.name(shortName(card.name)) });
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: hreflangOf(locale),
      mainEntity: [{ '@type': 'Question', name: clean(d.refQFees), acceptedAnswer: { '@type': 'Answer', text: clean(d.refAFees) } }]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: clean(h1),
      inLanguage: hreflangOf(locale),
      step: steps.map((t, i) => ({ '@type': 'HowToStep', position: i + 1, text: clean(t) }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'G2M', item: absoluteUrl(intlHome(locale)) },
        { '@type': 'ListItem', position: 2, name: card.name, item: absoluteUrl(intlCard(locale, card.slug)) },
        { '@type': 'ListItem', position: 3, name: clean(h1), item: absoluteUrl(path) }
      ]
    }
  ];

  return (
    <article className="wrap section stack" style={{ gap: 36, maxWidth: 860 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="stack" style={{ gap: 12 }}>
        <nav aria-label="Breadcrumb" className="faint" style={{ fontSize: 14 }}>
          <Link href={intlHome(locale)} style={{ textDecoration: 'none' }}>
            {d.allCards}
          </Link>{' '}
          /{' '}
          <Link href={intlCard(locale, card.slug)} style={{ textDecoration: 'none' }}>
            <bdi>{card.name}</bdi>
          </Link>
        </nav>
        <Eyebrow>{d.refEyebrow}</Eyebrow>
        <h1 className="h2">{h1}</h1>
        <p className="lead">
          {fill(code ? d.refLeadCode : d.refLeadLink, { name: f.name(card.name), code: f.name(code ?? '') })}
        </p>
      </div>

      <div className="panel panel-pad ref-hero">
        <div className="ref-hero-art">
          <CardArt card={card} width={220} />
        </div>
        <div className="stack" style={{ gap: 14, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <b>
              {d.score} · {fill(d.rankOf, { rank: card.rank, n: getCards().length })}
            </b>
            <IntlScore value={card.score.total} label={d.score} />
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <b>{d.bonus}</b>
            <p className="muted" style={{ margin: 0 }}>
              {bonus ? <IntlText note={bonus} label={d.inEnglish} /> : d.refNoBonus}
            </p>
          </div>
          {code ? (
            <p style={{ margin: 0 }}>
              {d.referralCode}
              {f.colon}
              <code className="mono">
                <bdi>{code}</bdi>
              </code>
            </p>
          ) : null}
          <div className="pick-actions">
            <OutboundLink slug={card.slug} name={card.name} placement={`intl-${locale.code}-referral`} className="btn btn-metal">
              {d.getCard}
            </OutboundLink>
            <Link href={intlCard(locale, card.slug)} className="btn">
              {d.details}
            </Link>
          </div>
        </div>
      </div>

      <section aria-labelledby="how" className="stack" style={{ gap: 12 }}>
        <h2 id="how" className="h3">
          {d.refHow}
        </h2>
        <ol className="ref-steps">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="faq" className="stack" style={{ gap: 14 }}>
        <h2 id="faq" className="h3">
          {d.faqTitle}
        </h2>
        <div className="stack" style={{ gap: 6 }}>
          <h3 style={{ fontSize: 17, margin: 0 }}>{d.refQFees}</h3>
          <p className="muted" style={{ margin: 0 }}>
            {d.refAFees}
          </p>
        </div>
      </section>

      {others.length ? (
        <section aria-labelledby="more" className="stack" style={{ gap: 12 }}>
          <h2 id="more" className="h3">
            {d.refMore}
          </h2>
          <ul className="guide-links">
            {others.map((c) => (
              <li key={c.slug}>
                <Link href={intlReferral(locale, c.slug)}>
                  {fill(c.referralCode ? d.refH1Code : d.refH1Link, { name: f.name(shortName(c.name)) })}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="faint" style={{ fontSize: 13, margin: 0 }}>
        {fill(d.builtNote, { date: f.date(card.lastChecked) })}
      </p>
    </article>
  );
}
