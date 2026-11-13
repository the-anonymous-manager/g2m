import type { feesEn } from './en';
import { feesDe } from './de';
import { feesFr } from './fr';
import { feesEs } from './es';
import { feesPl } from './pl';
import { feesTr } from './tr';
import { feesRu } from './ru';
import { feesAr } from './ar';
import { feesZhHk } from './zh-hk';

/** The fees guide's text in each language (server only). */
export const FEES: Record<string, typeof feesEn> = { de: feesDe, fr: feesFr, es: feesEs, pl: feesPl, tr: feesTr, ru: feesRu, ar: feesAr, 'zh-hk': feesZhHk };
