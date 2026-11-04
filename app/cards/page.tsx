import type { Metadata } from 'next';
import { getCards, lastUpdated } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { parseFilters } from '@/lib/table';
import { RankingsTable } from '@/components/RankingsTable';
import { Eyebrow } from '@/components/bits';
import { fmtDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Crypto card rankings',
  description:
    'Every crypto card ranked by the G2M score: cashback, annual fee, FX fee, custody and where each card works. Filter by US, UK, EU, India and UAE.',
  alternates: { canonical: '/cards' }
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CardsPage({ searchParams }: Props) {
  const params = await searchParams;
  const initial = parseFilters(params);
  // `?country=all` (the "See all cards" links): every card worldwide, without switching to the visitor's country.
  const raw = params.country ?? params.market;
  const allCountries = String(Array.isArray(raw) ? raw[0] : (raw ?? '')).toLowerCase() === 'all';
  const cards = getCards();
  const rows = cards.map(toRow);
  return (
    <div className="wrap wrap-wide section stack" style={{ gap: 28 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>leaderboard</Eyebrow>
        <h1 className="h2">Crypto card rankings</h1>
        <p className="lead">
          {cards.length} cards scored the same way on rewards, fees, coverage and control. Pick where you live to see what
          you can actually get. Last checked {fmtDate(lastUpdated())}.
        </p>
      </div>
      <RankingsTable
        rows={rows}
        initial={initial}
        hadMarketParam={Boolean(initial.country || initial.region) || allCountries}
        allCountries={allCountries}
      />
    </div>
  );
}
