import 'server-only';
import type { Locale } from './locales';
import de from '@/data/i18n/de.json';
import fr from '@/data/i18n/fr.json';
import es from '@/data/i18n/es.json';
import pl from '@/data/i18n/pl.json';
import tr from '@/data/i18n/tr.json';
import ru from '@/data/i18n/ru.json';
import ar from '@/data/i18n/ar.json';
import zhHK from '@/data/i18n/zh-hk.json';

// Translations of the English text typed in the sheet (card summaries, pros, cons, sign-up bonuses) and of the
// guide explanations in lib/guides.ts. Each file maps the exact English text to its translation, so when the sheet
// text changes, the old translation stops matching and the page shows the new English text, marked as English,
// until someone adds the translation (`npm run i18n:missing` lists what is missing).

const NOTES: Record<string, Record<string, string>> = { de, fr, es, pl, tr, ru, ar, 'zh-hk': zhHK };

export type Note = { text: string; translated: boolean };

/** Languages whose percent sign follows the number after a space ("2 %"), as Intl writes it. */
const SPACED_PERCENT = new Set(['de', 'fr', 'es', 'ru']);

/**
 * Amounts in a translation, written the way the language writes them. The translations keep the English amounts
 * ("$2,000", "$0.30", "€400") so their numbers can be checked against the English; here they become "2.000 $",
 * "0,30 $" (German), "US$2,000" (Chinese) and so on, the same as the amounts Intl writes everywhere else on the page.
 */
export function localAmounts(l: Locale, text: string): string {
  // "$15K" and "$1M" are thousands and millions.
  const out = text.replace(/([$€])(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?([KM](?![a-zA-Z]))?/g, (_, sign: string, int: string, dec: string | undefined, unit: string | undefined) => {
    const n = Number(int.replace(/,/g, '') + (dec ?? '')) * (unit === 'K' ? 1e3 : unit === 'M' ? 1e6 : 1);
    if (unit) dec = undefined;
    const s = new Intl.NumberFormat(l.tag, {
      style: 'currency',
      currency: sign === '€' ? 'EUR' : 'USD',
      minimumFractionDigits: dec ? 2 : 0,
      maximumFractionDigits: 2
    }).format(n);
    // In right-to-left text the amount keeps its own order.
    return l.dir === 'rtl' ? `\u2066${s}\u2069` : s;
  });
  // "2 %" with a space that never breaks the line, where the language spaces it.
  const spaced = SPACED_PERCENT.has(l.code) ? out.replace(/(\d)[ \u00a0\u202f]?%/g, '$1\u00a0%') : out;
  // French puts a space before : ; ! ? and inside \u00ab \u00bb; it must not break the line either.
  return l.code === 'fr' ? spaced.replace(/ ([:;!?\u00bb])/g, '\u00a0$1').replace(/\u00ab /g, '\u00ab\u00a0') : spaced;
}

/** The text in the page's language, or the English original when there is no translation yet. */
export function note(l: Locale, english: string): Note {
  const t = NOTES[l.code]?.[english];
  return t ? { text: localAmounts(l, t), translated: true } : { text: english, translated: false };
}

/** Only the translated text, or null: for places where English would not fit (titles, search results). */
export function noteOrNull(l: Locale, english: string): string | null {
  const t = NOTES[l.code]?.[english];
  return t ? localAmounts(l, t) : null;
}
