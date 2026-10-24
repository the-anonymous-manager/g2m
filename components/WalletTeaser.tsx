'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { CardRow } from '@/lib/types';
import { calcParams, type CalcInput } from '@/lib/calc';
import { bestCombo } from '@/lib/combo';
import { money } from '@/lib/format';

// A one-line answer above the calculator leaderboard, leading to the full wallet builder with the same settings.
export function WalletTeaser({ cards, input, country }: { cards: CardRow[]; input: CalcInput; country: string }) {
  const combo = useMemo(() => bestCombo(cards, input, country || null), [cards, input, country]);
  const href = `/wallet?${calcParams({ ...input, mode: 'best' }, country).toString()}`;
  return (
    <Link href={href} className="wallet-teaser">
      <span className="field-label">[ 2-card wallet ]</span>
      <span className="wallet-teaser-text">
        {combo ? (
          <>
            Pair <b>{combo.primary.card.name}</b> + <b>{combo.second.card.name}</b> and keep{' '}
            <b className="wallet-teaser-plus">+{money(combo.extra)} a year</b> more than {combo.single.card.name} alone.
          </>
        ) : (
          <>One card is enough for money at this spend. Want lounges, yield, borrowing or a bank account too?</>
        )}
      </span>
      <span className="wallet-teaser-cta">
        Build your wallet <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
