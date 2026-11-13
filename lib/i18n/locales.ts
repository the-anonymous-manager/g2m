// The other languages of the site. English lives at the root (/, /cards/kast); each language here gets its own
// address (/de, /de/cards/kast, /de/best-crypto-cards/germany) with pages built from the same card data.
// Safe to import in the browser: no card data here.

export type Locale = {
  /** The address prefix, e.g. "de" in /de/cards/kast. */
  code: string;
  /** BCP 47 tag for hreflang, <div lang> and Intl number/date formatting. */
  tag: string;
  /** The language's own name, for the language list. */
  name: string;
  dir: 'ltr' | 'rtl';
  /** Countries shown first for this language (availability on card pages, country links on the home page). */
  markets: string[];
};

export const LOCALES: Locale[] = [
  { code: 'de', tag: 'de', name: 'Deutsch', dir: 'ltr', markets: ['DE', 'AT', 'CH'] },
  { code: 'fr', tag: 'fr', name: 'Français', dir: 'ltr', markets: ['FR', 'BE', 'CH', 'CA'] },
  { code: 'es', tag: 'es', name: 'Español', dir: 'ltr', markets: ['ES', 'MX', 'AR', 'CO', 'CL', 'PE'] },
  { code: 'pl', tag: 'pl', name: 'Polski', dir: 'ltr', markets: ['PL'] },
  { code: 'tr', tag: 'tr', name: 'Türkçe', dir: 'ltr', markets: ['TR'] },
  { code: 'ru', tag: 'ru', name: 'Русский', dir: 'ltr', markets: ['KZ', 'GE', 'AM', 'AE', 'TR', 'RU'] },
  // ar-AE keeps Western digits (1, 2, 3), as used in the UAE.
  { code: 'ar', tag: 'ar-AE', name: 'العربية', dir: 'rtl', markets: ['AE', 'SA', 'QA', 'KW', 'BH', 'EG'] },
  { code: 'zh-hk', tag: 'zh-HK', name: '繁體中文', dir: 'ltr', markets: ['HK', 'TW', 'SG', 'MO'] }
];

export const localeByCode = (code: string | undefined) => LOCALES.find((l) => l.code === code);

/** The language of an address ("/de/cards/kast" → Deutsch), or undefined for the English pages. */
export function localeOfPath(pathname: string | null | undefined): Locale | undefined {
  const first = (pathname ?? '').split('/')[1]?.toLowerCase();
  return first ? localeByCode(first) : undefined;
}

/** hreflang value: the tag, except Arabic, which is offered to every Arabic speaker, not only the UAE. */
export const hreflangOf = (l: Locale) => (l.code === 'ar' ? 'ar' : l.tag);

// Addresses of the translated pages.
export const intlHome = (l: Locale) => `/${l.code}`;
export const intlCard = (l: Locale, slug: string) => `/${l.code}/cards/${slug}`;
export const intlCountry = (l: Locale, countrySlug: string) => `/${l.code}/best-crypto-cards/${countrySlug}`;
export const intlRankings = (l: Locale) => `/${l.code}/cards`;
export const intlVersus = (l: Locale, pair: string) => `/${l.code}/compare/${pair}`;
export const intlAlternatives = (l: Locale, slug: string) => `/${l.code}/cards/${slug}/alternatives`;
export const intlReferral = (l: Locale, slug: string) => `/${l.code}/cards/${slug}/referral-code`;
export const intlGuides = (l: Locale) => `/${l.code}/guides`;
export const intlGuide = (l: Locale, slug: string) => `/${l.code}/guides/${slug}`;
export const intlMethodology = (l: Locale) => `/${l.code}/methodology`;
export const intlCompare = (l: Locale) => `/${l.code}/compare`;
export const intlCalculator = (l: Locale) => `/${l.code}/calculator`;
export const intlFinder = (l: Locale) => `/${l.code}/finder`;
export const intlWallet = (l: Locale) => `/${l.code}/wallet`;
export const intlReceipt = (l: Locale) => `/${l.code}/receipt`;
export const intlCorridors = (l: Locale) => `/${l.code}/corridors`;
export const intlSubmit = (l: Locale) => `/${l.code}/submit`;
export const intlBook = (l: Locale) => `/${l.code}/book`;
export const intlFeesGuide = (l: Locale) => `/${l.code}/guides/crypto-card-fees-explained`;


/**
 * The same page in another language, for the language menu: `to` undefined means English. A page that has no
 * translated version (the calculator, the rankings table) opens that language's home page instead.
 */
export function pathIn(pathname: string, to: Locale | undefined): string {
  const from = localeOfPath(pathname);
  // The address without its language prefix, in English terms: "/de/best-crypto-cards/x" → "/guides/best-crypto-cards/x".
  let en = from ? pathname.slice(from.code.length + 1) || '/' : pathname || '/';
  if (from && en.startsWith('/best-crypto-cards/')) en = `/guides${en}`;
  if (!to) return en;
  const country = en.match(/^\/guides\/best-crypto-cards\/([^/]+)$/);
  if (country) return intlCountry(to, country[1]);
  const guide = en.match(/^\/guides\/([^/]+)$/);
  if (guide) return intlGuide(to, guide[1]);
  if (en === '/cards' || en === '/guides' || en === '/methodology' || en === '/compare' || en === '/calculator' || en === '/finder' || en === '/wallet' || en === '/receipt' || en === '/corridors' || en === '/submit' || en === '/book' || /^\/compare\/[^/]+-vs-[^/]+$/.test(en) || /^\/cards\/[^/]+(\/alternatives|\/referral-code)?$/.test(en))
    return `/${to.code}${en}`;
  return intlHome(to);
}

/**
 * hreflang links for a page that exists in every language: English at `en`, the others at `path(locale)`.
 * Goes in a page's `alternates.languages`. `only` limits it to the languages the page exists in.
 */
export function languageLinks(en: string, path: (l: Locale) => string, only: Locale[] = LOCALES): Record<string, string> {
  return { en, ...Object.fromEntries(only.map((l) => [hreflangOf(l), path(l)])), 'x-default': en };
}

/** "{name} has {n} cards" with { name, n } filled in. */
export const fill = (template: string, vars: Record<string, string | number>) =>
  template
    .replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
    // A value that ends with a full stop (Russian dates end in "г.") before the sentence's own one.
    .replace(/(?<!\.)\.\.(?!\.)/g, '.');
