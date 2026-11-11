import { NP, pct as enPct, usd as enUsd } from '@/lib/format';
import { COUNTRIES, countryName } from '@/lib/regions';
import type { Ui } from './ui/en';

// Numbers, money and country names for the tools, in the browser. English keeps the site's own formatting
// (lib/format, "$1,000", "Free"), so the English pages do not change; the other languages use Intl.

export type ClientFmt = {
  pct: (n: number | null | undefined, empty?: string) => string;
  usd: (n: number | null | undefined, empty?: string) => string;
  country: (cc: string) => string;
  /** Countries for a country picker, sorted in the language's own alphabetical order. */
  countries: () => { code: string; name: string }[];
};

export const englishFmt: ClientFmt = {
  pct: (n, empty = NP) => enPct(n, empty),
  usd: (n, empty = NP) => enUsd(n, empty),
  country: countryName,
  countries: () => COUNTRIES
};

/**
 * `names`: country names worked out on the server and passed down, so the server's HTML and the browser agree
 * (Node and the browser can name a country differently, e.g. "Sonderverwaltungsregion Hongkong" and "Hongkong",
 * which breaks hydration).
 */
export function intlFmt(tag: string, ui: Ui, names?: Record<string, string>): ClientFmt {
  const pctF = new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 2 });
  const usdF = new Intl.NumberFormat(tag, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 });
  let display: Intl.DisplayNames | null = null;
  try {
    display = new Intl.DisplayNames([tag], { type: 'region', style: 'short' });
  } catch {
    display = null;
  }
  const country = (cc: string) => names?.[cc] ?? display?.of(cc) ?? countryName(cc);
  let sorted: { code: string; name: string }[] | null = null;
  return {
    pct: (n, empty = ui.common.notPublished) => (n == null ? empty : pctF.format(n / 100)),
    usd: (n, empty = ui.common.notPublished) => (n == null ? empty : n === 0 ? ui.common.free : usdF.format(n)),
    country,
    countries: () =>
      (sorted ??= COUNTRIES.map((c) => ({ code: c.code, name: country(c.code) })).sort((a, b) => a.name.localeCompare(b.name, tag)))
  };
}

/** "{shown} of {total} cards" with {slots} filled, as text. */
export const fillText = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

/** The same, with React nodes allowed in the slots (e.g. a bold number). */
export function fillNodes(template: string, vars: Record<string, React.ReactNode>): React.ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const m = part.match(/^\{(\w+)\}$/);
    return m && m[1] in vars ? <span key={i}>{vars[m[1]]}</span> : part;
  });
}
