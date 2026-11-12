'use client';

import Link from 'next/link';
import type { Standing } from '@/lib/cards';
import { countryName } from '@/lib/regions';
import { useRegion } from '@/components/RegionContext';
import type { Ui } from '@/lib/i18n/ui/en';

const fillT = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k) => String(v[k] ?? m));

// The card's score and rank in the visitor's own country, under the worldwide score.
export function CountryStanding({
  standings,
  words,
  prefix = '',
  countryNames
}: {
  standings: Record<string, Standing>;
  /** Another language: its card words, address prefix and country names from the server. English when left out. */
  words?: Ui['card'];
  prefix?: string;
  countryNames?: Record<string, string>;
}) {
  const { country, ready } = useRegion();
  if (!ready || !country) return null;
  const place = countryNames?.[country] ?? countryName(country);
  const rankings = `${prefix}/cards?country=${country}`;
  const s = standings[country];
  if (!s) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: 15 }}>
        {words ? fillT(words.notAvailableIn, { place }) : `Not available in ${place}.`}{' '}
        <Link href={rankings}>{words ? fillT(words.cardsFor, { place }) : `Cards for ${place}`}</Link>
      </p>
    );
  }
  const [score, rank, of, here] = s;
  return (
    <p className="muted" style={{ margin: 0, fontSize: 15 }}>
      {words ? fillT(words.inPlace, { place }) : `In ${place}:`} <b style={{ color: 'var(--text)' }}>{score}/100</b>,{' '}
      {words ? fillT(words.rankOf, { rank, n: of }) : `#${rank} of ${of}`}
      {here === 'y' ? '' : (words?.notConfirmedThere ?? ' (not confirmed there yet)')}.{' '}
      <Link href={rankings}>{words ? fillT(words.rankingsFor, { place }) : `Rankings for ${place}`}</Link>
    </p>
  );
}
