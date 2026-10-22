'use client';

import Link from 'next/link';
import type { Standing } from '@/lib/cards';
import { countryName } from '@/lib/regions';
import { useRegion } from '@/components/RegionContext';

// The card's score and rank in the visitor's own country, under the worldwide score.
export function CountryStanding({ standings }: { standings: Record<string, Standing> }) {
  const { country, ready } = useRegion();
  if (!ready || !country) return null;
  const place = countryName(country);
  const s = standings[country];
  if (!s) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: 15 }}>
        Not available in {place}. <Link href={`/cards?country=${country}`}>Cards for {place}</Link>
      </p>
    );
  }
  const [score, rank, of, here] = s;
  return (
    <p className="muted" style={{ margin: 0, fontSize: 15 }}>
      In {place}: <b style={{ color: 'var(--text)' }}>{score}/100</b>, #{rank} of {of}
      {here === 'y' ? '' : ' (not confirmed there yet)'}.{' '}
      <Link href={`/cards?country=${country}`}>Rankings for {place}</Link>
    </p>
  );
}
