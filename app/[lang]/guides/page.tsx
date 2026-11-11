import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCards } from '@/lib/cards';
import { countryGuides, countrySlug, topicCards } from '@/lib/guides';
import { hasReferralPage } from '@/lib/referral';
import { shortName } from '@/lib/versus';
import { LOCALES, fill, intlAlternatives, intlCountry, intlGuide, intlGuides, intlReferral, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { formatters } from '@/lib/i18n/format';
import { intlTopics } from '@/lib/i18n/guides';
import { noteOrNull } from '@/lib/i18n/notes';
import { shareMeta, site } from '@/lib/site';
import { Eyebrow } from '@/components/bits';

// The guides hub in another language: topic guides, country guides, alternatives and referral codes, all linking to
// pages in the same language. Built ahead of time at each deploy.
type Props = { params: Promise<{ lang: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l.code }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) return {};
  const d = DICTS[locale.code];
  return {
    title: { absolute: `${d.guidesTitle} · ${site.name}` },
    description: d.guidesDesc,
    alternates: { canonical: intlGuides(locale), languages: languageLinks('/guides', intlGuides) },
    ...shareMeta(d.guidesTitle, d.guidesDesc, intlGuides(locale))
  };
}

export default async function IntlGuidesPage({ params }: Props) {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) notFound();
  const d = DICTS[locale.code];
  const f = formatters(locale, d);
  const cards = getCards();
  // This language's own markets first, then the others with a guide, by number of cards.
  const countries = countryGuides()
    .map((g) => g.cc)
    .sort((a, b) => Number(locale.markets.includes(b)) - Number(locale.markets.includes(a)));
  const referrals = cards.filter(hasReferralPage);

  return (
    <div className="wrap section stack" style={{ gap: 36 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>{d.guides}</Eyebrow>
        <h1 className="h2">{d.guidesTitle}</h1>
        <p className="lead">{d.guidesLead}</p>
      </div>

      <section aria-labelledby="topics" className="stack" style={{ gap: 14 }}>
        <h2 id="topics" className="h3">
          {d.guidesByNeed}
        </h2>
        <div className="grid-3">
          {intlTopics(locale).map((t) => (
            <Link key={t.slug} href={intlGuide(locale, t.slug)} className="panel panel-pad stack" style={{ gap: 6, textDecoration: 'none' }}>
              <b>{noteOrNull(locale, t.title)}</b>
              <span className="faint" style={{ fontSize: 14 }}>
                {fill(d.guideCount, { n: topicCards(t).length })}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="countries" className="stack" style={{ gap: 12 }}>
        <h2 id="countries" className="h3">
          {d.countriesTitle}
        </h2>
        <ul className="guide-links">
          {countries.map((cc) => (
            <li key={cc}>
              <Link href={intlCountry(locale, countrySlug(cc))}>{f.country(cc)}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="alternatives" className="stack" style={{ gap: 12 }}>
        <h2 id="alternatives" className="h3">
          {d.altEyebrow.charAt(0).toLocaleUpperCase(locale.tag) + d.altEyebrow.slice(1)}
        </h2>
        <ul className="guide-links">
          {cards.map((c) => (
            <li key={c.slug}>
              <Link href={intlAlternatives(locale, c.slug)}>{fill(d.altH1, { name: f.name(shortName(c.name)) })}</Link>
            </li>
          ))}
        </ul>
      </section>

      {referrals.length ? (
        <section aria-labelledby="codes" className="stack" style={{ gap: 12 }}>
          <h2 id="codes" className="h3">
            {d.refCodes}
          </h2>
          <ul className="guide-links">
            {referrals.map((c) => (
              <li key={c.slug}>
                <Link href={intlReferral(locale, c.slug)}>{fill(c.referralCode ? d.refH1Code : d.refH1Link, { name: f.name(shortName(c.name)) })}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
