import Link from 'next/link';
import type { Card } from '@/lib/types';
import type { Locale } from '@/lib/i18n/locales';
import { intlCard } from '@/lib/i18n/locales';
import type { Dict } from '@/lib/i18n/dict';
import type { Fmt } from '@/lib/i18n/format';
import { CardArt } from '@/components/CardArt';
import { OutboundLink } from '@/components/OutboundLink';

/** The score as a number with its bar; the label is in the page's language. */
export function IntlScore({ value, label }: { value: number; label: string }) {
  return (
    <span className="score" aria-label={`${label}: ${value}/100`}>
      <span className="score-num">{value}</span>
      <span className="score-bar" aria-hidden="true">
        <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </span>
    </span>
  );
}

/** A ranked list of cards on a translated page: every word comes from the dictionary, every value from the data. */
export function IntlCardList({
  cards,
  locale,
  d,
  f,
  placement,
  fx,
  fxLabel
}: {
  cards: Card[];
  locale: Locale;
  d: Dict;
  f: Fmt;
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
          <Link href={intlCard(locale, c.slug)} className="guide-art" tabIndex={-1} aria-hidden="true">
            <CardArt card={c} width={110} />
          </Link>
          <div className="guide-body stack" style={{ gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Link href={intlCard(locale, c.slug)} style={{ fontWeight: 700, fontSize: 18, textDecoration: 'none' }}>
                <bdi>{c.name}</bdi>
              </Link>
              <IntlScore value={c.score.total} label={d.score} />
            </div>
            <dl className="pick-facts guide-facts">
              <div>
                <dt>{d.cashback}</dt>
                <dd>{f.cashbackCell(c)}</dd>
              </div>
              <div>
                <dt>{d.annualFee}</dt>
                <dd>{f.usdCell(c.fees.annualUsd)}</dd>
              </div>
              <div>
                <dt>{fxLabel ?? d.fxFee}</dt>
                <dd>{fx ? fx(c) : f.pctCell(c.fees.fxPct)}</dd>
              </div>
              <div>
                <dt>{d.custody}</dt>
                <dd>{f.custody(c)}</dd>
              </div>
            </dl>
            <div className="pick-actions">
              <OutboundLink slug={c.slug} name={c.brand} placement={placement} className="btn btn-metal btn-sm">
                {d.getCard}
              </OutboundLink>
              <Link href={intlCard(locale, c.slug)} className="btn btn-sm">
                {d.details}
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
