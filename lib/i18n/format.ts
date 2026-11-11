import 'server-only';
import type { Card } from '@/lib/types';
import { countryName } from '@/lib/regions';
import type { Locale } from './locales';
import type { Dict } from './dict';

// Numbers, money, dates and country names the way each language writes them (Intl), plus the few card values that
// need a word instead of a number ("Free", "Not published").

export function formatters(l: Locale, d: Dict) {
  const pctF = new Intl.NumberFormat(l.tag, { style: 'percent', maximumFractionDigits: 2 });
  const usdF = new Intl.NumberFormat(l.tag, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const numF = new Intl.NumberFormat(l.tag, { maximumFractionDigits: 1 });
  const dateF = new Intl.DateTimeFormat(l.tag, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  let regions: Intl.DisplayNames | null = null;
  try {
    regions = new Intl.DisplayNames([l.tag], { type: 'region', style: 'short' });
  } catch {
    regions = null;
  }
  // In right-to-left text a value like "1.5%–3%" or "$20" must keep its own left-to-right order.
  const iso = (s: string) => (l.dir === 'rtl' ? `\u2066${s}\u2069` : s);
  const pct = (n: number) => iso(pctF.format(n / 100));
  const usd = (n: number) => iso(usdF.format(n));
  const range = (base: number | null, max: number | null): string | null => {
    if (base == null && max == null) return null;
    if (base != null && max != null && max > base) return iso(`${pctF.format(base / 100)}–${pctF.format(max / 100)}`);
    if (base != null) return pct(base);
    return iso(`≤ ${pctF.format(max! / 100)}`);
  };
  return {
    pct,
    usd,
    num: (n: number) => numF.format(n),
    date: (isoDate: string) => dateF.format(new Date(`${isoDate}T00:00:00Z`)),
    country: (cc: string) => regions?.of(cc) ?? countryName(cc),
    // Table cells
    pctCell: (n: number | null | undefined) => (n == null ? d.notPublished : pct(n)),
    usdCell: (n: number | null | undefined) => (n == null ? d.notPublished : n === 0 ? d.free : usd(n)),
    cashbackCell: (c: Pick<Card, 'cashback'>) => range(c.cashback.basePct, c.cashback.maxPct) ?? d.notPublished,
    // Inside a sentence
    pctS: (n: number | null | undefined) => (n == null ? d.npFeeS : pct(n)),
    usdS: (n: number | null | undefined) => (n == null ? d.npFeeS : usd(n)),
    cashbackS: (c: Pick<Card, 'cashback'>) => range(c.cashback.basePct, c.cashback.maxPct) ?? d.npS,
    custody: (c: Pick<Card, 'custody'>) =>
      c.custody === 'self-custodial' ? d.nonCustodial : c.custody === 'custodial' ? d.custodial : c.custody === 'both' ? d.custodyBoth : d.notPublished,
    type: (c: Pick<Card, 'type'>) => d[c.type]
  };
}

export type Fmt = ReturnType<typeof formatters>;
