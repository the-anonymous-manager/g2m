import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCard } from '@/lib/cards';
import { getUpdate, getUpdates, intlUpdate, intlUpdates, isTranslated, updateJsonLd, updatePath } from '@/lib/updates';
import { LOCALES, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { noteOrNull } from '@/lib/i18n/notes';
import { absoluteUrl, metaDescription, metaTitle, shareMeta } from '@/lib/site';
import { UpdateArticle } from '@/components/UpdatesView';

// One post in another language. Only posts whose title and summary are translated get a page here (lib/updates.ts
// isTranslated); the others are listed on this language's Updates page and open the English post.
type Props = { params: Promise<{ lang: string; slug: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.flatMap((l) => getUpdates().filter((u) => isTranslated(u, l)).map((u) => ({ lang: l.code, slug: u.slug })));
}

function load(lang: string, slug: string) {
  const locale = localeByCode(lang);
  const u = getUpdate(slug);
  return locale && u && isTranslated(u, locale) ? { locale, u, title: noteOrNull(locale, u.title)!, summary: noteOrNull(locale, u.summary)! } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  const x = load(lang, slug);
  if (!x) return {};
  const { locale, u, title, summary } = x;
  const path = intlUpdate(locale, u.slug);
  return {
    title: metaTitle(title),
    description: metaDescription(summary),
    alternates: {
      canonical: path,
      languages: languageLinks(updatePath(u.slug), (l) => intlUpdate(l, u.slug), LOCALES.filter((l) => isTranslated(u, l)))
    },
    ...shareMeta(title, summary, path, u.card && getCard(u.card) ? `/cards/${u.card}/opengraph-image` : undefined)
  };
}

export default async function IntlUpdatePage({ params }: Props) {
  const { lang, slug } = await params;
  const x = load(lang, slug);
  if (!x) notFound();
  const { locale, u, title, summary } = x;
  const jsonLd = updateJsonLd(u, title, summary, absoluteUrl(intlUpdate(locale, u.slug)), absoluteUrl(intlUpdates(locale)), DICTS[locale.code].updAll, locale.tag);
  return <UpdateArticle u={u} locale={locale} jsonLd={jsonLd} />;
}
