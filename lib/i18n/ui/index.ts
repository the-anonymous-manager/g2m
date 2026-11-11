import { uiEn, type Ui } from './en';
import { uiDe } from './de';
import { uiFr } from './fr';
import { uiEs } from './es';
import { uiPl } from './pl';
import { uiTr } from './tr';
import { uiRu } from './ru';
import { uiAr } from './ar';
import { uiZhHK } from './zh-hk';

// All the tool language packs, for server pages: a page passes only its own language's pack to the browser.
export const UI: Record<string, Ui> = { en: uiEn, de: uiDe, fr: uiFr, es: uiEs, pl: uiPl, tr: uiTr, ru: uiRu, ar: uiAr, 'zh-hk': uiZhHK };
export { uiEn, type Ui };
