import 'server-only';
import { TOPICS, type Topic } from '@/lib/guides';
import type { Locale } from './locales';
import { noteOrNull } from './notes';

// Topic guides in other languages. A guide is offered in a language once its title and description are translated
// in data/i18n (a new guide stays English-only until then); missing paragraphs fall back to English, marked.

export const intlTopics = (l: Locale): Topic[] => TOPICS.filter((t) => noteOrNull(l, t.title) && noteOrNull(l, t.description));

export const intlTopic = (l: Locale, slug: string) => intlTopics(l).find((t) => t.slug === slug);
