'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { CardRow } from '@/lib/types';
import type { CalcInput } from '@/lib/calc';
import { buildSegments } from '@/lib/calc';
import { bestCombo, describeSlices } from '@/lib/combo';
import { countryName } from '@/lib/regions';
import { money } from '@/lib/format';
import { CardArt } from '@/components/CardArt';

// The best pair of cards for this spending, next to the best single card.
export function WalletCombo({ cards, input, country }: { cards: CardRow[]; input: CalcInput; country: string }) {
  const combo = useMemo(() => bestCombo(cards, input, country || null), [cards, input, country]);
  const where = country ? ` in ${countryName(country)}` : '';
  return (
    <section className="panel panel-pad stack combo" style={{ gap: 16 }} aria-labelledby="combo-title">
      <div className="stack" style={{ gap: 4 }}>
        <span className="field-label">[ 2-card wallet ]</span>
        <h2 id="combo-title" className="h3" style={{ margin: 0 }}>
          Best 2-card wallet{where}
        </h2>
      </div>
      {!combo ? (
        <p className="muted" style={{ margin: 0 }}>
          At {money(input.spend)} a month, no pair of cards keeps you more than the best single card. A second card&apos;s
          fees would cost more than it saves. Try a higher spend, or more spending in other currencies.
        </p>
      ) : (
        <>
          <p className="combo-headline">
            Keep an extra <b>+{money(combo.extra)}</b> a year by pairing {combo.primary.card.name} + {combo.second.card.name}
          </p>
          <div className="combo-grid">
            {[
              { side: combo.primary, role: 'Card 1 · main card', uses: 'Everything else' },
              {
                side: combo.second,
                role: 'Card 2 · for these purchases',
                uses: describeSlices(combo.toSecond, buildSegments(input)).join(' · ')
              }
            ].map(({ side, role, uses }) => (
              <div key={side.card.slug} className="combo-side">
                <span className="field-label">{role}</span>
                <div className="card-cell">
                  <CardArt card={side.card} size="sm" />
                  <div className="stack" style={{ gap: 2 }}>
                    <Link href={`/cards/${side.card.slug}`}>{side.card.name}</Link>
                    <span className="faint" style={{ fontSize: 13 }}>
                      {side.result.tier.name}
                    </span>
                  </div>
                </div>
                <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                  {uses.charAt(0).toUpperCase() + uses.slice(1)}
                </p>
                <dl className="combo-facts">
                  <div>
                    <dt>Spend on it</dt>
                    <dd>{money(side.spendYear / 12)}/mo</dd>
                  </div>
                  <div>
                    <dt>You keep</dt>
                    <dd style={{ color: side.result.net >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{money(side.result.net)}/yr</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
          <dl className="combo-compare">
            <div>
              <dt>Both cards together</dt>
              <dd style={{ color: combo.total >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{money(combo.total)} a year</dd>
            </div>
            <div>
              <dt>{combo.single.card.name} alone</dt>
              <dd>{money(combo.single.result.net)} a year</dd>
            </div>
          </dl>
          <p className="faint" style={{ fontSize: 12, margin: 0 }}>
            Both cards&apos; yearly fees are counted in full, and each card is at its best tier for its share of your spending.
          </p>
        </>
      )}
    </section>
  );
}
