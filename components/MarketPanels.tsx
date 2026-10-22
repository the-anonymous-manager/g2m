'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { CardRow } from '@/lib/types';
import { availabilityIn, countryName, countryToMarket } from '@/lib/regions';
import { rankIn } from '@/lib/score';
import { CardArt } from '@/components/CardArt';
import { ScorePill } from '@/components/bits';
import { useRegion } from '@/components/RegionContext';

export type MarketPanel = {
  key: string;
  title: string;
  href: string;
  count: number;
  cards: { row: CardRow; note?: string }[];
};

type Panel = MarketPanel & { mine: boolean };

// Cards confirmed in the US, the UK, the EU and Asia. A visitor whose country has no panel of its own
// (Japan, India, Brazil...) gets one first; a visitor in the US, the UK or the EEA sees that panel first.
export function MarketPanels({ panels, rows }: { panels: MarketPanel[]; rows: CardRow[] }) {
  const { country, ready } = useRegion();
  const here = ready ? country : null;
  const myMarket = countryToMarket(here);

  const ordered = useMemo<Panel[]>(() => {
    const all: Panel[] = panels.map((p) => ({ ...p, mine: p.key === myMarket }));
    if (here && !all.some((p) => p.mine)) {
      const yes = rankIn(rows, here).filter((c) => availabilityIn(c, here) === 'yes');
      all.unshift({
        key: here,
        title: countryName(here),
        href: `/cards?country=${here}`,
        count: yes.length,
        cards: yes.slice(0, 3).map((row) => ({ row })),
        mine: true
      });
    }
    return all.sort((a, b) => Number(b.mine) - Number(a.mine));
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
              {cards.map(({ row: c, note }) => (
                <li key={c.slug} style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <Link
                    href={`/cards/${c.slug}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', fontWeight: 600 }}
                  >
                    <CardArt card={c} size="sm" />
                    <span className="stack" style={{ gap: 2 }}>
                      {c.name}
                      {note ? (
                        <span className="faint" style={{ fontSize: 12, fontWeight: 500 }}>
                          {note}
                        </span>
                      ) : null}
                    </span>
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
