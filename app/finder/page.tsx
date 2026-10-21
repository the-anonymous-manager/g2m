import type { Metadata } from 'next';
import { getCards } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { parseAnswers } from '@/lib/finder';
import { FinderClient } from '@/components/FinderClient';
import { Eyebrow } from '@/components/bits';

export const metadata: Metadata = {
  title: 'Crypto card finder',
  description: 'Answer three questions and get the three crypto cards that fit where you live and how you spend.',
  alternates: { canonical: '/finder' }
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function FinderPage({ searchParams }: Props) {
  const initial = parseAnswers(await searchParams);
  const rows = getCards().map(toRow);
  return (
    <div className="wrap section stack" style={{ gap: 28, maxWidth: 980 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>3 questions</Eyebrow>
        <h1 className="h2">Find your best card</h1>
        <p className="lead">Three quick answers. We leave out cards you can&apos;t get where you live and explain every pick.</p>
      </div>
      <FinderClient rows={rows} initial={initial} />
    </div>
  );
}
