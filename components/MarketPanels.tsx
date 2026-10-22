'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { CardRow, Market } from '@/lib/types';
import { MARKET_LABELS, availabilityIn, countryName, countryToMarket } from '@/lib/regions';
import { rankIn } from '@/lib/score';
import { CardArt } from '@/components/CardArt';
import { ScorePill } from '@/components/bits';
import { useRegion } from '@/components/RegionContext';

export type MarketPanel = { market: Market; count: number; cards: CardRow[] };

type Panel = { key: string; title: string; href: string; count: number; cards: CardRow[]; mine: boolean };

// Cards confirmed in each checked market. A visitor from anywhere else gets a panel for their
// own country first; a visitor inside a checked market sees that market first.
export function MarketPanels({ panels, rows }: { panels: MarketPanel[]; rows: CardRow[] }) {
  const { country, ready } = useRegion();
  const here = ready ? country : null;
  const myMarket = countryToMarket(here);

  const ordered = useMemo<Panel[]>(() => {
    const fixed: Panel[] = panels.map((p) => ({
      key: p.market,
      title: MARKET_LABELS[p.market],
      // The EU is not one country, so its link opens the full list; the visitor's own country is picked there.
      href: p.market === 'EU' ? '/cards' : `/cards?country=${p.market}`,
      count: p.count,
      cards: p.cards,
      mine: p.market === myMarket
    }));
    if (here && !myMarket) {
      const yes = rankIn(rows, here).filter((c) => availabilityIn(c, here) === 'yes');
      fixed.unshift({ key: here, title: countryName(here), href: `/cards?country=${here}`, count: yes.length, cards: yes.slice(0, 3), mine: true });
    }
    return [...fixed].sort((a, b) => Number(b.mine) - Number(a.mine));
  }, [panels, rows, here, myMarket]);
  const anyMine = ordered.some((p) => p.mine);

  return (
    <div className="market-grid">
      {ordered.map(({ key, title, href, count, cards, mine }) => (
        <div key={key} className="panel panel-pad stack" style={{ gap: 14, borderColor: mine ? 'var(--accent)' : undefined }}>
          <div className="stack" style={{ gap: 8, alignItems: 'flex-start' }}>
            {/* Same-height label row on every panel keeps the titles lined up. */}
            {anyMine ? (
              <span className="eyebrow" style={{ fontSize: 11, minHeight: 15 }}>
                {mine ? 'Your location' : ' '}
              </span>
            ) : null}
            <h3 className="h3">{title}</h3>
            <span className={`badge ${count ? 'badge-yes' : 'badge-unknown'}`}>{count} confirmed</span>
          </div>
          {cards.length ? (
            <ul className="list-plain">
              {cards.map((c) => (
                <li key={c.slug} style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <Link
                    href={`/cards/${c.slug}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', fontWeight: 600 }}
                  >
                    <CardArt card={c} size="sm" />
                    {c.name}
                  </Link>
                  <ScorePill value={c.score.total} showBar={false} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No card has confirmed {title} yet.</p>
          )}
          <Link href={href} className="muted" style={{ fontSize: 15 }}>
            All cards for {title}
          </Link>
        </div>
      ))}
    </div>
  );
}
