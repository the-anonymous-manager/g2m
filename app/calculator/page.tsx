import type { Metadata } from 'next';
import { getCards } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { parseCalcInput } from '@/lib/calc';
import { isCountry } from '@/lib/regions';
import { CalculatorClient } from '@/components/CalculatorClient';
import { Eyebrow } from '@/components/bits';

export const metadata: Metadata = {
  title: 'Crypto card rewards calculator',
  description:
    'Enter your monthly spend and see what every crypto card earns you in a year after plan fees, FX fees and per-purchase fees.',
  alternates: { canonical: '/calculator' }
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CalculatorPage({ searchParams }: Props) {
  const p = await searchParams;
  const initial = parseCalcInput({
    ...(one(p.spend) ? { spend: one(p.spend) } : {}),
    ...(one(p.foreign) ? { foreign: one(p.foreign) } : {}),
    ...(one(p.ticket) ? { ticket: one(p.ticket) } : {}),
    ...(one(p.all) ? { all: one(p.all) } : {})
  });
  // `country=JP`; older links used `market=IN` (the EU was a market, not a country, so it has no default).
  const raw = (one(p.country) ?? one(p.market) ?? '').toUpperCase();
  const country = isCountry(raw) ? raw : '';
  const rows = getCards().map(toRow);
  return (
    <div className="wrap section stack" style={{ gap: 28 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>your numbers</Eyebrow>
        <h1 className="h2">Rewards calculator</h1>
        <p className="lead">
          What each card pays you back in a year, minus plan fees, FX fees and per-purchase fees. Pick where you live: a
          card billed in your own currency charges no FX fee at home. We pick the best tier for your spend on every card.
        </p>
      </div>
      <CalculatorClient rows={rows} initial={initial} initialCountry={country} hadCountry={Boolean(country)} />
    </div>
  );
}
