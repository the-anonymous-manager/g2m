import type { Metadata } from 'next';
import { getCards } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { parseCalcInput } from '@/lib/calc';
import { isCountry } from '@/lib/regions';
import { FEATURE_KEYS, type FeatureKey } from '@/lib/features';
import { WalletBuilder } from '@/components/WalletBuilder';
import { Eyebrow } from '@/components/bits';

export const metadata: Metadata = {
  title: 'Crypto card wallet builder: the best 2-card combo',
  description:
    'Find the two crypto cards that keep you the most money together, with the features you need: lounge access, yield, borrowing, a bank account or a non-custodial wallet.',
  alternates: { canonical: '/wallet' }
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function WalletPage({ searchParams }: Props) {
  const p = await searchParams;
  const keys = ['spend', 'usd', 'travel', 'foreign', 'mix', 'ticket', 'all'];
  const initial = parseCalcInput(Object.fromEntries(keys.map((k) => [k, one(p[k])])));
  const need = (one(p.need) ?? '').split(',').filter((k): k is FeatureKey => (FEATURE_KEYS as readonly string[]).includes(k));
  const raw = (one(p.country) ?? '').toUpperCase();
  const country = isCountry(raw) ? raw : '';
  const rows = getCards().map(toRow);
  return (
    <div className="wrap section stack" style={{ gap: 28 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>your wallet</Eyebrow>
        <h1 className="h2">Wallet builder</h1>
        <p className="lead">
          The two cards that keep you the most money together, with the features you can&apos;t do without. One card for most
          spending, a second for what it handles better: small purchases, US dollars, travel, lounges, yield or a bank account.
        </p>
      </div>
      <WalletBuilder rows={rows} initial={initial} initialNeed={need} initialCountry={country} hadCountry={Boolean(country)} />
    </div>
  );
}
