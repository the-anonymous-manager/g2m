import 'server-only';
import type { Dict } from './en';
import { de } from './de';
import { fr } from './fr';
import { es } from './es';
import { pl } from './pl';
import { tr } from './tr';
import { ru } from './ru';
import { ar } from './ar';
import { zhHK } from './zh-hk';

/** The page text of each language, by address prefix (lib/i18n/locales.ts). */
export const DICTS: Record<string, Dict> = { de, fr, es, pl, tr, ru, ar, 'zh-hk': zhHK };
export type { Dict };
