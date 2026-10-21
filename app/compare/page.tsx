import type { Metadata } from 'next';
import { getCards } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { CompareClient } from '@/components/CompareClient';
import { Eyebrow } from '@/components/bits';

export const metadata: Metadata = {
  title: 'Compare crypto cards',
  description: 'Compare up to three crypto cards side by side: cashback, annual fee, FX fee, custody, countries and perks.',
  alternates: { canonical: '/compare' }
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ComparePage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = Array.isArray(params.c) ? params.c[0] : params.c;
  const initial = (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-z0-9-]+$/.test(s));
  const rows = getCards().map(toRow);
  return (
    <div className="wrap section stack" style={{ gap: 28 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>side by side</Eyebrow>
        <h1 className="h2">Compare crypto cards</h1>
        <p className="lead">Pick up to three cards. The best value in each row is highlighted.</p>
      </div>
      <CompareClient rows={rows} initial={initial} />
    </div>
  );
}
