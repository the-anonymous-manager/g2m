import type { Metadata } from 'next';
import { getCards } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { parseCalcInput } from '@/lib/calc';
import { isCountry } from '@/lib/regions';
import { usdPrices } from '@/lib/prices';
import { CalculatorClient } from '@/components/CalculatorClient';
import { Eyebrow } from '@/components/bits';

export const metadata: Metadata = {
  title: 'Crypto card rewards calculator',
  description:
    'See what every crypto card leaves you with in a year after plan, FX, per-purchase, small-purchase and top-up fees. Compare tiers across up to three cards, or audit one card line by line.',
  alternates: { canonical: '/calculator' }
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CalculatorPage({ searchParams }: Props) {
  const p = await searchParams;
  // Every setting lives in the link (mode, spend, currency split, purchase sizes, valuation, card, year, tier...).
  const keys = ['mode', 'spend', 'usd', 'travel', 'foreign', 'mix', 'ticket', 'value', 'form', 'year', 'tiers', 'all', 'card', 'cards', 'tier'];
  const initial = parseCalcInput(Object.fromEntries(keys.map((k) => [k, one(p[k])])));
  // `country=JP`; older links used `market=IN` (the EU was a market, not a country, so it has no default).
  const raw = (one(p.country) ?? one(p.market) ?? '').toUpperCase();
  const country = isCountry(raw) ? raw : '';
  const cards = getCards();
  const rows = cards.map(toRow);
  // Live USD value of staking tiers (one shared CoinGecko request, cached an hour; empty when unavailable).
  const prices = await usdPrices(cards.flatMap((c) => c.tiers.flatMap((t) => (t.stake?.coingeckoId ? [t.stake.coingeckoId] : []))));
  return (
    <div className="wrap section stack" style={{ gap: 28 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>your numbers</Eyebrow>
        <h1 className="h2">Rewards calculator</h1>
        <p className="lead">
          What each card pays you back in a year, minus every fee: plan, FX, per-purchase, small-purchase and top-up. Pick
          where you live: a card that bills in your currency charges no FX fee at home. Then compare tiers across up to
          three cards, or see one card line by line.
        </p>
      </div>
      <CalculatorClient rows={rows} initial={initial} initialCountry={country} hadCountry={Boolean(country)} prices={prices} />
    </div>
  );
}
