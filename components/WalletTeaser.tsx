'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { CardRow } from '@/lib/types';
import { calcParams, type CalcInput } from '@/lib/calc';
import { bestCombo } from '@/lib/combo';
import { money } from '@/lib/format';
import { fillNodes } from '@/lib/i18n/clientFormat';

type TeaserWords = { walletTag: string; walletPair: string; walletPlus: string; walletOne: string; walletCta: string; money: (n: number) => string };

// A one-line answer above the calculator leaderboard, leading to the full wallet builder with the same settings.
// `words` gives another language (the wallet builder itself is English for now); English when left out.
export function WalletTeaser({ cards, input, country, words }: { cards: CardRow[]; input: CalcInput; country: string; words?: TeaserWords }) {
  const combo = useMemo(() => bestCombo(cards, input, country || null), [cards, input, country]);
  const href = `/wallet?${calcParams({ ...input, mode: 'best' }, country).toString()}`;
  if (words) {
    return (
      <Link href={href} className="wallet-teaser" hrefLang="en">
        <span className="field-label">{words.walletTag}</span>
        <span className="wallet-teaser-text">
          {combo ? (
            <>
              {fillNodes(words.walletPair, {
                a: <b>{combo.primary.card.name}</b>,
                b: <b>{combo.second.card.name}</b>,
                plus: <b className="wallet-teaser-plus">{words.walletPlus.replace('{x}', words.money(combo.extra))}</b>,
                single: combo.single.card.name
              })}
            </>
          ) : (
            <>{words.walletOne}</>
          )}
        </span>
        <span className="wallet-teaser-cta">
          {words.walletCta} <span aria-hidden="true">→</span>
        </span>
      </Link>
    );
  }
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
