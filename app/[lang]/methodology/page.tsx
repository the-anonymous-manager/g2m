import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCards, lastUpdated } from '@/lib/cards';
import { BASKET, BASKET_PURCHASES, BASKET_USD, SCORE_WEIGHTS } from '@/lib/score';
import { LOCALES, fill, intlMethodology, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { formatters } from '@/lib/i18n/format';
import { metaDescription, metaTitle, shareMeta } from '@/lib/site';
import { Eyebrow } from '@/components/bits';

// How the score works, in another language: the same rules as the English methodology, a little shorter (the
// calculator details stay on the English page, which is linked). Amounts come from Intl, weights from lib/score.ts.
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
    title: metaTitle(d.methTitle),
    description: metaDescription(d.methDesc),
    alternates: { canonical: intlMethodology(locale), languages: languageLinks('/methodology', intlMethodology) },
    ...shareMeta(d.methTitle, d.methDesc, intlMethodology(locale))
  };
}

export default async function IntlMethodologyPage({ params }: Props) {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) notFound();
  const d = DICTS[locale.code];
  const f = formatters(locale, d);
  const v = {
    r35: f.pct(3.5),
    u0: f.usd(0),
    u10: f.usd(10),
    u20: f.usd(20),
    u30: f.usd(30),
    u50: f.usd(50),
    u100: f.usd(100),
    u300: f.usd(300),
    p0: f.pct(0),
    p1: f.pct(1),
    p2: f.pct(2),
    h: f.num(1.5),
    np: d.notPublished,
    get: d.getCard,
    total: f.usd(BASKET_USD),
    bucket: f.usd(BASKET_USD / 5),
    n: BASKET_PURCHASES,
    markets: f.list(['US', 'GB', 'EU', 'IN', 'AE'].map(f.country))
  };
  const parts: [string, number, string][] = [
    [d.rewards, SCORE_WEIGHTS.rewards, d.methRewardsHow],
    [d.fees, SCORE_WEIGHTS.fees, d.methFeesHow],
    [d.coverage, SCORE_WEIGHTS.coverage, d.methCoverageHow],
    [d.banking, SCORE_WEIGHTS.ecosystem, d.methBankingHow],
    [d.control, SCORE_WEIGHTS.control, d.methControlHow]
  ];
  const sections: [string, string][] = [
    [d.methMissingTitle, d.methMissing],
    [d.methDataTitle, d.methData],
    [d.methCountryTitle, d.methCountry],
    [d.methMoneyTitle, d.methMoney],
    [d.methPrivacyTitle, d.methPrivacy]
  ];

  return (
    <div className="wrap section stack" style={{ gap: 36 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>{d.methEyebrow}</Eyebrow>
        <h1 className="h2">{d.methH1}</h1>
        <p className="lead">{fill(d.methLead, { n: getCards().length })}</p>
      </div>

      <div className="table-wrap">
        <table className="table intl-table stack-on-phone" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th scope="col">{d.methPart}</th>
              <th scope="col">{d.methPoints}</th>
              <th scope="col">{d.methHow}</th>
            </tr>
          </thead>
          <tbody>
            {parts.map(([name, max, how]) => (
              <tr key={name}>
                <td style={{ fontWeight: 700 }}>{name}</td>
                <td className="mono">{max}</td>
                <td style={{ fontSize: 15, lineHeight: 1.55, textAlign: 'start' }}>{fill(how, v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="prose">
        <h2 id="basket">{d.methBasketTitle}</h2>
        <p>{fill(d.methBasket, v)}</p>
      </div>
      <div className="table-wrap" style={{ maxWidth: 520 }}>
        <table className="table intl-table" style={{ minWidth: 0 }}>
          <thead>
            <tr>
              <th scope="col">{d.methSize}</th>
              <th scope="col">{d.methCount}</th>
              <th scope="col">{d.methTotal}</th>
            </tr>
          </thead>
          <tbody>
            {BASKET.map((b) => (
              <tr key={b.usd}>
                <td>{f.usd(b.usd)}</td>
                <td>{f.num(b.count)}</td>
                <td>{f.usd(b.usd * b.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="prose">
        <p>{fill(d.methCosts, v)}</p>
        {sections.map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{fill(text, v)}</p>
          </section>
        ))}
        <p>
          {d.methMore}{' '}
          <Link href="/methodology" lang="en" hrefLang="en">
            {d.methFull}
          </Link>
        </p>
        <p className="faint" style={{ fontSize: 14 }}>
          {fill(d.builtNote, { date: f.date(lastUpdated()) })}
        </p>
      </div>
    </div>
  );
}
