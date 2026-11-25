import type { CardRow, Market, Tier } from '@/lib/types';
import { MARKET_LABELS } from '@/lib/regions';
import { CUSTODY_LABEL, NP, TYPE_LABEL, cashbackLabel, ecosystemFeatures, pct, perPurchaseFee, tierCashback, usd } from '@/lib/format';
import { tierPrice } from '@/lib/tierpick';
import { MarketBadge, ScorePill } from '@/components/bits';
import { fillText, type ClientFmt } from '@/lib/i18n/clientFormat';
import type { Ui } from '@/lib/i18n/ui/en';

// The card rows of the side-by-side table, shared by the /compare tool and the "X vs Y" pages.

const MARKETS: Market[] = ['IN', 'AE', 'US', 'GB', 'EU'];
export type Row = {
  label: string;
  render: (c: CardRow) => React.ReactNode;
  /** Returns a number to compare; the best value(s) get highlighted. */
  value?: (c: CardRow) => number | null;
  better?: 'high' | 'low';
};

/** Another language for the table: its words, Intl numbers, and country names worked out on the server. */
export type CompareLang = { ui: Ui; fmt: ClientFmt; tag: string };

/** Words for a card or tier in either language. `lang` undefined = the English the site always showed. */
export function compareText(lang?: CompareLang) {
  if (!lang) {
    return {
      pct: (n: number | null | undefined) => pct(n),
      usd: (n: number | null | undefined) => usd(n),
      price: tierPrice,
      tierCb: (t: Tier) => tierCashback(t),
      range: (base: number | null, max: number | null) => cashbackLabel(base, max),
      perPurchase: (c: CardRow) => perPurchaseFee(c.fees),
      banking: (c: CardRow) => ecosystemFeatures(c.ecosystem),
      count: (n: number) => n.toLocaleString('en-US')
    };
  }
  const { ui, fmt, tag } = lang;
  const t = ui.card;
  const w = ui.compare;
  const P = (n: number | null | undefined) => fmt.pct(n);
  // In right-to-left text an amount keeps its own order ("US$ 25", never "$US 25" next to "US$ 3").
  const iso = (s: string) => (tag.startsWith('ar') && /\d/.test(s) ? `\u2066${s}\u2069` : s);
  // A plain amount, never "Free": limits, caps and band edges.
  const M = (n: number) => iso(new Intl.NumberFormat(tag, { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n));
  const nc = ui.common.notConfirmed;
  const yesNo = (v: boolean | null | undefined) => (v == null ? nc : v ? ui.common.yes : ui.common.no);
  return {
    pct: P,
    usd: (n: number | null | undefined) => iso(fmt.usd(n)),
    price: (tier: Tier) => (tier.feeUsdYear == null ? w.priceNP : tier.feeUsdYear ? fillText(w.priceYear, { x: M(tier.feeUsdYear) }) : ui.common.free),
    tierCb: (tier: Tier) => {
      if (!tier.bands?.length) return P(tier.cashbackPct);
      return tier.bands
        .map((b, i) => {
          const from = i === 0 ? 0 : (tier.bands![i - 1].uptoUsd ?? 0);
          return b.uptoUsd == null ? fillText(t.bandAbove, { p: P(b.pct), a: M(from) }) : fillText(t.bandUpTo, { p: P(b.pct), a: M(b.uptoUsd) });
        })
        .join(tag.startsWith('zh') ? '，' : tag.startsWith('ar') ? '، ' : ', ');
    },
    range: (base: number | null, max: number | null) =>
      base == null && max == null
        ? ui.common.notPublished
        : base != null && max != null && max > base
          ? fillText(t.range, { a: P(base), b: P(max) })
          : base != null
            ? P(base)
            : fillText(ui.common.upTo, { x: P(max) }),
    perPurchase: (c: CardRow) => {
      const f = c.fees;
      const small = f.smallPurchase;
      const parts = [
        f.txPct ? `${P(f.txPct)}${f.txMinUsd ? ` (${fillText(ui.common.minFee, { x: M(f.txMinUsd) })})` : ''}` : null,
        f.txFlatUsd ? M(f.txFlatUsd) : null,
        small
          ? `${fillText(small.inclusive ? t.smallAtOrUnder : t.smallUnder, { fee: iso(fmt.usd(small.feeUsd)), limit: iso(fmt.usd(small.underUsd)) })}${small.foreignOnly ? t.nonUsd : ''}${
              small.freePerMonth ? fillText(t.freeFirst, { n: small.freePerMonth }) : ''
            }`
          : null
      ];
      return parts.filter(Boolean).join(' + ') || t.noneListed;
    },
    banking: (c: CardRow) => {
      const e = c.ecosystem;
      const n = e?.payoutCorridors;
      return [
        { label: t.bankAccount, value: e?.iban === 'named' ? t.inYourName : e?.iban === 'shared' ? t.sharedRef : e?.iban === 'none' ? ui.common.no : nc, on: e?.iban === 'named' || e?.iban === 'shared' },
        { label: t.sendBank, value: n == null ? nc : n === 0 ? ui.common.no : fillText(t.currenciesN, { n }), on: (n ?? 0) > 0 },
        {
          label: t.buySell,
          value: e?.ramps === 'both' ? t.buyAndSell : e?.ramps === 'on' ? t.buyOnly : e?.ramps === 'off' ? t.sellOnly : e?.ramps === 'none' ? ui.common.no : nc,
          on: e?.ramps === 'both' || e?.ramps === 'on' || e?.ramps === 'off'
        },
        { label: t.creditLine, value: yesNo(e?.credit), on: Boolean(e?.credit) },
        { label: t.yieldLine, value: yesNo(e?.yield), on: Boolean(e?.yield) }
      ];
    },
    count: (n: number) => n.toLocaleString(tag)
  };
}

/** The table's card rows, in English (no `lang`) or another language. */
export function cardRows(lang?: CompareLang): Row[] {
  if (!lang) return ROWS;
  const { ui, fmt } = lang;
  const w = ui.compare;
  const t = ui.card;
  const x = compareText(lang);
  const type = { debit: t.typeDebit, credit: t.typeCredit, prepaid: t.typePrepaid, spend: t.typeSpend, mixed: t.typeMixed };
  const custody = { 'self-custodial': ui.common.nonCustodial, custodial: ui.common.custodial, both: ui.common.custodyBoth, unknown: ui.common.notPublished };
  const form = { virtual: t.formVirtual, physical: t.formPhysical, metal: t.formMetal };
  const yn = (v: boolean | null | undefined) => (v == null ? '?' : v ? ui.common.yes : ui.common.no);
  const market = (m: Market) => (m === 'EU' ? ui.regions.EU : fmt.country(m));
  return [
    { label: w.rScore, render: (c) => <ScorePill value={c.score.total} label={t.scoreTitle} />, value: (c) => c.score.total, better: 'high' },
    { label: w.rBase, render: (c) => x.pct(c.cashback.basePct), value: (c) => c.cashback.basePct, better: 'high' },
    { label: w.rMax, render: (c) => x.pct(c.cashback.maxPct), value: (c) => c.cashback.maxPct, better: 'high' },
    { label: w.rPaidIn, render: (c) => c.cashback.payout ?? ui.common.notPublished },
    { label: w.rAnnual, render: (c) => x.usd(c.fees.annualUsd), value: (c) => c.fees.annualUsd, better: 'low' },
    { label: w.rFx, render: (c) => x.pct(c.fees.fxPct), value: (c) => c.fees.fxPct, better: 'low' },
    { label: w.rTopUp, render: (c) => x.pct(c.fees.topUpPct), value: (c) => c.fees.topUpPct, better: 'low' },
    { label: w.rPerPurchase, render: (c) => x.perPurchase(c) },
    { label: w.rAtm, render: (c) => c.fees.atm ?? ui.common.notPublished },
    { label: w.rNetwork, render: (c) => c.network },
    { label: w.rType, render: (c) => type[c.type] },
    { label: w.rCustody, render: (c) => custody[c.custody] },
    { label: w.rBonus, render: (c) => c.signupBonus ?? w.noneBonus },
    {
      label: w.rNoId,
      render: (c) => (c.noIdCheck ? (c.noIdCheck.toLowerCase() === 'yes' ? ui.common.yes : fillText(w.noIdX, { x: c.noIdCheck })) : w.idNeeded)
    },
    { label: w.rFormats, render: (c) => c.forms.map((f) => form[f] ?? f).join(', ') },
    { label: w.rWallets, render: (c) => `${yn(c.wallets.applePay)} / ${yn(c.wallets.googlePay)}` },
    ...MARKETS.map<Row>((m) => ({
      label: market(m),
      render: (c) => <MarketBadge value={c.coverage.markets[m]} market={m} where={market(m)} short words={ui.common} />
    })),
    { label: w.rCountries, render: (c) => (c.coverage.countries != null ? x.count(c.coverage.countries) : c.coverage.scope) },
    ...[0, 1, 2, 3, 4].map<Row>((i) => ({
      label: x.banking({ ecosystem: undefined } as unknown as CardRow)[i].label,
      render: (c) => x.banking(c)[i].value
    })),
    { label: w.rTiers, render: (c) => c.tiers.map((tier) => tier.name).join(' · ') },
    {
      label: w.rPerks,
      render: (c) => {
        const perks = Array.from(new Set([...c.perks, ...c.tiers.flatMap((tier) => tier.perks)])).slice(0, 5);
        return perks.length ? perks.join(' · ') : '—';
      }
    }
  ];
}

export const ROWS: Row[] = [
  { label: 'G2M score', render: (c) => <ScorePill value={c.score.total} />, value: (c) => c.score.total, better: 'high' },
  { label: 'Base cashback', render: (c) => pct(c.cashback.basePct), value: (c) => c.cashback.basePct, better: 'high' },
  { label: 'Max cashback', render: (c) => pct(c.cashback.maxPct), value: (c) => c.cashback.maxPct, better: 'high' },
  { label: 'Paid in', render: (c) => c.cashback.payout ?? NP },
  { label: 'Annual fee', render: (c) => usd(c.fees.annualUsd), value: (c) => c.fees.annualUsd, better: 'low' },
  { label: 'FX fee', render: (c) => pct(c.fees.fxPct), value: (c) => c.fees.fxPct, better: 'low' },
  { label: 'Top-up fee', render: (c) => pct(c.fees.topUpPct), value: (c) => c.fees.topUpPct, better: 'low' },
  { label: 'Per-purchase fee', render: (c) => perPurchaseFee(c.fees) },
  { label: 'ATM', render: (c) => c.fees.atm ?? NP },
  { label: 'Network', render: (c) => c.network },
  { label: 'Card type', render: (c) => TYPE_LABEL[c.type] },
  { label: 'Custody', render: (c) => CUSTODY_LABEL[c.custody] },
  { label: 'Sign-up bonus (G2M link)', render: (c) => c.signupBonus ?? 'None published' },
  {
    label: 'No ID check',
    render: (c) => (c.noIdCheck ? (c.noIdCheck.toLowerCase() === 'yes' ? 'Yes' : `Yes: ${c.noIdCheck}`) : 'ID needed or not stated')
  },
  { label: 'Formats', render: (c) => <span style={{ textTransform: 'capitalize' }}>{c.forms.join(', ')}</span> },
  {
    label: 'Apple / Google Pay',
    render: (c) =>
      `${c.wallets.applePay == null ? '?' : c.wallets.applePay ? 'Yes' : 'No'} / ${c.wallets.googlePay == null ? '?' : c.wallets.googlePay ? 'Yes' : 'No'}`
  },
  ...MARKETS.map<Row>((m) => ({
    label: MARKET_LABELS[m],
    render: (c) => <MarketBadge value={c.coverage.markets[m]} market={m} short />
  })),
  { label: 'Countries', render: (c) => (c.coverage.countries != null ? String(c.coverage.countries) : c.coverage.scope) },
  ...[0, 1, 2, 3, 4].map<Row>((i) => ({
    label: ecosystemFeatures(undefined)[i].label,
    render: (c) => ecosystemFeatures(c.ecosystem)[i].value
  })),
  { label: 'Tiers', render: (c) => c.tiers.map((t) => t.name).join(' · ') },
  {
    label: 'Perks',
    render: (c) => {
      const perks = Array.from(new Set([...c.perks, ...c.tiers.flatMap((t) => t.perks)])).slice(0, 5);
      return perks.length ? perks.join(' · ') : '—';
    }
  }
];

export function best(cards: CardRow[], row: Row): Set<string> {
  if (!row.value || !row.better || cards.length < 2) return new Set();
  const vals = cards.map((c) => ({ slug: c.slug, v: row.value!(c) })).filter((x) => x.v != null) as { slug: string; v: number }[];
  if (vals.length < 2) return new Set();
  const target = row.better === 'high' ? Math.max(...vals.map((x) => x.v)) : Math.min(...vals.map((x) => x.v));
  if (vals.every((x) => x.v === target)) return new Set();
  return new Set(vals.filter((x) => x.v === target).map((x) => x.slug));
}
