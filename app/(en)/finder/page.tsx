import Link from 'next/link';
import type { Metadata } from 'next';
import { getCards } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { parseAnswers } from '@/lib/finder';
import { FinderClient } from '@/components/FinderClient';
import { Eyebrow } from '@/components/bits';
import { finderEn } from '@/lib/i18n/ui/finder/en';
import { intlFinder, languageLinks } from '@/lib/i18n/locales';
import { metaDescription, shareMeta } from '@/lib/site';

const pageTitle = finderEn.metaTitle;
const pageDescription =
  finderEn.metaDesc;

export const metadata: Metadata = {
  title: pageTitle,
  description: metaDescription(pageDescription),
  alternates: { canonical: '/finder', languages: languageLinks('/finder', intlFinder) },
  ...shareMeta(pageTitle, pageDescription, '/finder')
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function FinderPage({ searchParams }: Props) {
  const initial = parseAnswers(await searchParams);
  const rows = getCards().map(toRow);
  return (
    <div className="wrap section stack" style={{ gap: 28, maxWidth: 980 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>{finderEn.eyebrow}</Eyebrow>
        <h1 className="h2">{finderEn.title}</h1>
        <p className="lead">{finderEn.lead}</p>
        <Link href="/corridors" className="wallet-teaser" style={{ alignSelf: 'stretch' }}>
          <span className="field-label">{finderEn.rampTag}</span>
          <span className="wallet-teaser-text">{finderEn.rampText}</span>
          <span className="wallet-teaser-cta">
            {finderEn.rampCta} <span aria-hidden="true">→</span>
          </span>
        </Link>
      </div>
      <FinderClient rows={rows} initial={initial} />
    </div>
  );
}
