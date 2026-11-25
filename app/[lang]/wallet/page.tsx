import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCards } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { parseCalcInput } from '@/lib/calc';
import { COUNTRIES, isCountry } from '@/lib/regions';
import { FEATURE_KEYS, type FeatureKey } from '@/lib/features';
import { WalletBuilder } from '@/components/WalletBuilder';
import { Eyebrow } from '@/components/bits';
import { intlWallet, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { formatters } from '@/lib/i18n/format';
import { UI } from '@/lib/i18n/ui';
import { metaDescription, metaTitle, shareMeta } from '@/lib/site';

// The wallet builder in another language (/de/wallet): the same pairs as /wallet, every word from that language's pack
// (lib/i18n/ui/wallet), numbers from Intl.
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) return {};
  const w = UI[locale.code].wallet;
  return {
    title: metaTitle(w.metaTitle),
    description: metaDescription(w.metaDesc),
    alternates: { canonical: intlWallet(locale), languages: languageLinks('/wallet', intlWallet) },
    ...shareMeta(w.metaTitle, w.metaDesc, intlWallet(locale))
  };
}

export default async function IntlWalletPage({ params, searchParams }: Props) {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) notFound();
  const ui = UI[locale.code];
  const w = ui.wallet;
  const f = formatters(locale, DICTS[locale.code]);
  const p = await searchParams;
  const keys = ['spend', 'usd', 'travel', 'foreign', 'mix', 'ticket', 'all', 'hold', 'fee'];
  const initial = parseCalcInput(Object.fromEntries(keys.map((k) => [k, one(p[k])])));
  const need = (one(p.need) ?? '').split(',').filter((k): k is FeatureKey => (FEATURE_KEYS as readonly string[]).includes(k));
  const raw = (one(p.country) ?? '').toUpperCase();
  const country = isCountry(raw) ? raw : '';
  return (
    <div className="wrap section stack" style={{ gap: 28 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>{w.eyebrow}</Eyebrow>
        <h1 className="h2">{w.title}</h1>
        <p className="lead">{w.lead}</p>
      </div>
      <WalletBuilder
        rows={getCards().map(toRow)}
        initial={initial}
        initialNeed={need}
        initialCountry={country}
        hadCountry={Boolean(country)}
        ui={ui}
        tag={locale.tag}
        prefix={`/${locale.code}`}
        countryNames={Object.fromEntries(COUNTRIES.map((c) => [c.code, f.country(c.code)]))}
      />
    </div>
  );
}
