import type { Metadata } from 'next';
import { getCards } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { isCountry } from '@/lib/regions';
import { CorridorFinder } from '@/components/CorridorFinder';
import { Eyebrow } from '@/components/bits';
import { intlCorridors, languageLinks } from '@/lib/i18n/locales';

export const metadata: Metadata = {
  title: 'Crypto off-ramp and IBAN finder: USDC to SEPA, ACH, UPI',
  description:
    'Which crypto cards move USDC or USDT to a bank: EUR SEPA, USD ACH, GBP Faster Payments, AED, INR or SWIFT. Accounts in your name, cash-out rails and fees.',
  alternates: { canonical: '/corridors', languages: languageLinks('/corridors', intlCorridors) }
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CorridorsPage({ searchParams }: Props) {
  const p = await searchParams;
  const coin = one(p.coin)?.toUpperCase() === 'USDT' ? 'USDT' : 'USDC';
  const to = (one(p.to) ?? 'EUR').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'EUR';
  const raw = (one(p.country) ?? '').toUpperCase();
  const country = isCountry(raw) ? raw : '';
  const rows = getCards().map(toRow);
  return (
    <div className="wrap section stack" style={{ gap: 28 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>off-ramp</Eyebrow>
        <h1 className="h2">Corridor and IBAN finder</h1>
        <p className="lead">
          Move stablecoins to a bank. Pick a coin and where the money should land: see which cards give you an account in your
          name, which can cash out on that rail, and what it costs.
        </p>
      </div>
      <CorridorFinder rows={rows} initialCoin={coin} initialTo={to} initialCountry={country} hadCountry={Boolean(country)} />
    </div>
  );
}
