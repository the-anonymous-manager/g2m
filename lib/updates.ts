import 'server-only';
import raw from '@/data/updates.json';
import { UpdatesSchema } from '@/lib/card-schema.mjs';
import { intlUpdates, type Locale } from '@/lib/i18n/locales';
export { intlUpdates };
import { noteOrNull } from '@/lib/i18n/notes';
import { absoluteUrl, site } from '@/lib/site';

// The Updates page (/updates): card news, offers and sign-up bonuses that Akash writes in the sheet's Updates tab,
// copied to data/updates.json by the sheet sync, newest first. A post about one card links to it and its "Get the
// card" button goes through /go/<card> (the referral link). A paid post is always marked "Sponsored". Posts never
// change a card's score or rank. Pages are built at each deploy (every sheet sync deploys), so "Ended" is worked out
// on the day of the build.

export type Update = {
  slug: string;
  date: string;
  title: string;
  card: string | null;
  type: 'news' | 'offer' | 'bonus';
  summary: string;
  body: string | null;
  ends: string | null;
  source: string | null;
  sponsored: boolean;
};

const parsed = UpdatesSchema.safeParse(raw);
if (!parsed.success) console.error('data/updates.json is not valid; the Updates page shows nothing.', parsed.error.issues);
const UPDATES: Update[] = parsed.success ? (parsed.data as Update[]) : [];

export const getUpdates = (): Update[] => UPDATES;
export const getUpdate = (slug: string) => UPDATES.find((u) => u.slug === slug);
export const updatesForCard = (card: string) => UPDATES.filter((u) => u.card === card);

export const UPDATES_PATH = '/updates';
export const updatePath = (slug: string) => `${UPDATES_PATH}/${slug}`;
export const intlUpdate = (l: Locale, slug: string) => `/${l.code}${updatePath(slug)}`;

/** Whether an offer's end date has passed (on the day the site was built). */
export const hasEnded = (u: Update, today = new Date().toISOString().slice(0, 10)) => u.ends != null && u.ends < today;

export type Block = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] };

/**
 * The full text as paragraphs and lists: a blank line starts a new paragraph, lines starting with "- " (or "• ")
 * make a list, and other line breaks inside a paragraph are kept as spaces.
 */
export function bodyBlocks(body: string | null): Block[] {
  if (!body) return [];
  const out: Block[] = [];
  for (const chunk of body.split(/\n\s*\n/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    let para: string[] = [];
    let list: string[] = [];
    const flushPara = () => {
      if (para.length) out.push({ kind: 'p', text: para.join(' ') });
      para = [];
    };
    const flushList = () => {
      if (list.length) out.push({ kind: 'ul', items: list });
      list = [];
    };
    for (const line of lines) {
      const item = line.match(/^[-•*]\s+(.*)$/);
      if (item) {
        flushPara();
        list.push(item[1]);
      } else {
        flushList();
        para.push(line);
      }
    }
    flushPara();
    flushList();
  }
  return out;
}

/** Every piece of text in a post that a translation can replace (scripts/i18n-missing.mjs lists the same). */
export const updateTexts = (u: Update): string[] => [
  u.title,
  u.summary,
  ...bodyBlocks(u.body).flatMap((b) => (b.kind === 'p' ? [b.text] : b.items))
];

/**
 * A post has its own page in another language once its title and summary are translated (data/i18n); until then the
 * language's Updates page lists it in English and links to the English post, so no page is a copy of the English one.
 */
export const isTranslated = (u: Update, l: Locale) => noteOrNull(l, u.title) != null && noteOrNull(l, u.summary) != null;

/** NewsArticle and breadcrumb data for search engines, shared with the translated post pages. */
export function updateJsonLd(u: Update, title: string, summary: string, url: string, listUrl: string, listName: string, lang: string) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: title,
      description: summary,
      datePublished: u.date,
      inLanguage: lang,
      url,
      mainEntityOfPage: url,
      author: { '@type': 'Organization', name: site.name, url: site.url },
      publisher: { '@type': 'Organization', name: site.name, url: site.url, logo: { '@type': 'ImageObject', url: absoluteUrl('/brand/g2m-mark-512.png') } },
      ...(u.card ? { image: absoluteUrl(`/cards/${u.card}/opengraph-image`) } : {})
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'G2M', item: site.url },
        { '@type': 'ListItem', position: 2, name: listName, item: listUrl },
        { '@type': 'ListItem', position: 3, name: title, item: url }
      ]
    }
  ];
}

