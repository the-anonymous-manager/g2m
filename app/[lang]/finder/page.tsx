import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCards } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { parseAnswers } from '@/lib/finder';
import { COUNTRIES } from '@/lib/regions';
import { FinderClient } from '@/components/FinderClient';
import { Eyebrow } from '@/components/bits';
import { intlFinder, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { formatters } from '@/lib/i18n/format';
import { noteOrNull } from '@/lib/i18n/notes';
import { UI } from '@/lib/i18n/ui';
import { metaDescription, metaTitle, shareMeta } from '@/lib/site';

// The card finder in another language (/de/finder): the same five questions and the same picks as /finder, with every
// word from that language's pack (lib/i18n/ui/finder) and the perks it quotes from the sheet translated here.
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) return {};
  const w = UI[locale.code].finder;
  return {
    title: metaTitle(w.metaTitle),
    description: metaDescription(w.metaDesc),
    alternates: { canonical: intlFinder(locale), languages: languageLinks('/finder', intlFinder) },
    ...shareMeta(w.metaTitle, w.metaDesc, intlFinder(locale))
  };
}

export default async function IntlFinderPage({ params, searchParams }: Props) {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) notFound();
  const ui = UI[locale.code];
  const w = ui.finder;
  const f = formatters(locale, DICTS[locale.code]);
  const initial = parseAnswers(await searchParams);
  const cards = getCards();
  // The perks the finder may quote, translated where data/i18n has them.
  const texts = new Set(cards.flatMap((c) => [...c.perks, ...c.tiers.flatMap((t) => t.perks)]));
  const sheet = Object.fromEntries([...texts].flatMap((s) => {
    const t = noteOrNull(locale, s);
    return t ? [[s, t]] : [];
  }));
  return (
    <div className="wrap section stack" style={{ gap: 28, maxWidth: 980 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>{w.eyebrow}</Eyebrow>
        <h1 className="h2">{w.title}</h1>
        <p className="lead">{w.lead}</p>
        <Link href={`/${locale.code}/corridors`} className="wallet-teaser" style={{ alignSelf: 'stretch' }}>
          <span className="field-label">{w.rampTag}</span>
          <span className="wallet-teaser-text">{w.rampText}</span>
          <span className="wallet-teaser-cta">
            {w.rampCta} <span aria-hidden="true">→</span>
          </span>
        </Link>
      </div>
      <FinderClient
        rows={cards.map(toRow)}
        initial={initial}
        ui={ui}
        tag={locale.tag}
        prefix={`/${locale.code}`}
        countryNames={Object.fromEntries(COUNTRIES.map((c) => [c.code, f.country(c.code)]))}
        sheet={sheet}
      />
    </div>
  );
}
