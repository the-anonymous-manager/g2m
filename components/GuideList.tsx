import Link from 'next/link';
import type { Card } from '@/lib/types';
import { CUSTODY_LABEL, cashbackLabel, pct, usd } from '@/lib/format';
import { CardArt } from '@/components/CardArt';
import { ScorePill } from '@/components/bits';
import { OutboundLink } from '@/components/OutboundLink';

/**
 * A ranked list of cards for the guides. `fx` overrides the FX column (e.g. the fee on spending in a country's own
 * currency); `rank` overrides the number shown (e.g. the rank in a country).
 */
export function GuideList({
  cards,
  placement,
  fx,
  fxLabel = 'FX fee'
}: {
  cards: Card[];
  placement: string;
  fx?: (c: Card) => string;
  fxLabel?: string;
}) {
  return (
    <ol className="guide-list">
      {cards.map((c, i) => (
        <li key={c.slug} className="panel guide-item">
          <span className="guide-num mono" aria-hidden="true">
            {i + 1}
          </span>
          <Link href={`/cards/${c.slug}`} className="guide-art" tabIndex={-1} aria-hidden="true">
            <CardArt card={c} width={110} />
          </Link>
          <div className="guide-body stack" style={{ gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Link href={`/cards/${c.slug}`} style={{ fontWeight: 700, fontSize: 18, textDecoration: 'none' }}>
                {c.name}
              </Link>
              <ScorePill value={c.score.total} />
            </div>
            <dl className="pick-facts guide-facts">
              <div>
                <dt>Cashback</dt>
                <dd>{cashbackLabel(c.cashback.basePct, c.cashback.maxPct)}</dd>
              </div>
              <div>
                <dt>Annual fee</dt>
                <dd>{usd(c.fees.annualUsd)}</dd>
              </div>
              <div>
                <dt>{fxLabel}</dt>
                <dd>{fx ? fx(c) : pct(c.fees.fxPct)}</dd>
              </div>
              <div>
                <dt>Custody</dt>
                <dd>{CUSTODY_LABEL[c.custody]}</dd>
              </div>
            </dl>
            <div className="pick-actions">
              <OutboundLink slug={c.slug} name={c.brand} placement={placement} className="btn btn-metal btn-sm">
                Get {c.brand}
              </OutboundLink>
              <Link href={`/cards/${c.slug}`} className="btn btn-sm">
                Read the review
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
