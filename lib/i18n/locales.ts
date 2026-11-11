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

/**
 * hreflang links for a page that exists in every language: English at `en`, the others at `path(locale)`.
 * Goes in a page's `alternates.languages`.
 */
export function languageLinks(en: string, path: (l: Locale) => string): Record<string, string> {
  return { en, ...Object.fromEntries(LOCALES.map((l) => [hreflangOf(l), path(l)])), 'x-default': en };
}

/** "{name} has {n} cards" with { name, n } filled in. */
export const fill = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
