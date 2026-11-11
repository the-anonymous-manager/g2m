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

/** The text in the page's language, or the English original when there is no translation yet. */
export function note(l: Locale, english: string): Note {
  const t = NOTES[l.code]?.[english];
  return t ? { text: t, translated: true } : { text: english, translated: false };
}

/** Only the translated text, or null: for places where English would not fit (titles, search results). */
export const noteOrNull = (l: Locale, english: string) => NOTES[l.code]?.[english] ?? null;
