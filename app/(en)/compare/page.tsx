import type { Metadata } from 'next';
import Link from 'next/link';
import { getCards } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { CompareClient } from '@/components/CompareClient';
import { Eyebrow } from '@/components/bits';
import { BackButton } from '@/components/BackButton';
import { PICK } from '@/lib/tierpick';
import { usdPrices } from '@/lib/prices';
import { allPairs, versusPath } from '@/lib/versus';
import { intlCompare, languageLinks } from '@/lib/i18n/locales';

export const metadata: Metadata = {
  title: 'Compare crypto cards',
  description:
    'Compare up to three crypto cards side by side, or one tier of each: cashback, annual fee, FX fee, caps, staking, custody, countries and perks.',
  alternates: { canonical: '/compare', languages: languageLinks('/compare', intlCompare) }
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ComparePage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = Array.isArray(params.c) ? params.c[0] : params.c;
  // `c=kast,tria`, or one tier per card by its real name: `c=kast:premium,tria:pro,etherfi:luxe`.
  const initial = (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => PICK.test(s));
  const cards = getCards();
  const rows = cards.map(toRow);
  // Live USD value of staking tiers (cached an hour; empty when unavailable).
  const prices = await usdPrices(cards.flatMap((c) => c.tiers.flatMap((t) => (t.stake?.coingeckoId ? [t.stake.coingeckoId] : []))));
  return (
    <div className="wrap section stack" style={{ gap: 28 }}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="back-row">
          <BackButton fallback="/cards" />
        </div>
        <Eyebrow>side by side</Eyebrow>
        <h1 className="h2">Compare crypto cards</h1>
        <p className="lead">
          Pick up to three cards, and a tier of each if you like (say the next tier up from the free one). The best value in
          each row is highlighted.
        </p>
      </div>
      <CompareClient rows={rows} initial={initial} prices={prices} />
      <section className="stack" style={{ gap: 14 }} aria-labelledby="popular">
        <h2 id="popular" className="h3">
          Popular comparisons
        </h2>
        <ul className="vs-links vs-links-cols">
          {allPairs(cards.slice(0, 7)).map(([a, b]) => (
            <li key={`${a.slug}-${b.slug}`}>
              <Link href={versusPath(a.slug, b.slug)}>
                {a.name} vs {b.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
