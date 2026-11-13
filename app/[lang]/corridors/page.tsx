import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCards } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { COUNTRIES, isCountry } from '@/lib/regions';
import { CorridorFinder } from '@/components/CorridorFinder';
import { Eyebrow } from '@/components/bits';
import { intlCorridors, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { formatters } from '@/lib/i18n/format';
import { noteOrNull } from '@/lib/i18n/notes';
import { UI } from '@/lib/i18n/ui';
import { shareMeta, site } from '@/lib/site';

// The corridor (off-ramp) finder in another language (/de/corridors): the same results as /corridors, every word from
// that language's pack (lib/i18n/ui/corridor) and the issuers' rail fee notes translated here (data/i18n).
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) return {};
  const w = UI[locale.code].corridor;
  return {
    title: { absolute: `${w.metaTitle} · ${site.name}` },
    description: w.metaDesc,
    alternates: { canonical: intlCorridors(locale), languages: languageLinks('/corridors', intlCorridors) },
    ...shareMeta(w.metaTitle, w.metaDesc, intlCorridors(locale))
  };
}

export default async function IntlCorridorsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) notFound();
  const ui = UI[locale.code];
  const w = ui.corridor;
  const f = formatters(locale, DICTS[locale.code]);
  const p = await searchParams;
  const coin = one(p.coin)?.toUpperCase() === 'USDT' ? 'USDT' : 'USDC';
  const to = (one(p.to) ?? 'EUR').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'EUR';
  const raw = (one(p.country) ?? '').toUpperCase();
  const country = isCountry(raw) ? raw : '';
  const cards = getCards();
  // The rail fee notes the finder shows, translated where data/i18n has them.
  const texts = new Set(cards.flatMap((c) => (c.bankRails ?? []).flatMap((r) => (r.fee ? [r.fee] : []))));
  const sheet = Object.fromEntries([...texts].flatMap((s) => {
    const t = noteOrNull(locale, s);
    return t ? [[s, t]] : [];
  }));
  return (
    <div className="wrap section stack" style={{ gap: 28 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>{w.eyebrow}</Eyebrow>
        <h1 className="h2">{w.title}</h1>
        <p className="lead">{w.lead}</p>
      </div>
      <CorridorFinder
        rows={cards.map(toRow)}
        initialCoin={coin}
        initialTo={to}
        initialCountry={country}
        hadCountry={Boolean(country)}
        ui={ui}
        tag={locale.tag}
        prefix={`/${locale.code}`}
        countryNames={Object.fromEntries(COUNTRIES.map((c) => [c.code, f.country(c.code)]))}
        sheet={sheet}
      />
    </div>
  );
}
