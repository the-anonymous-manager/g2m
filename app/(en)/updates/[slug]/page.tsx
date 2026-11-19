import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCard } from '@/lib/cards';
import { getUpdate, getUpdates, intlUpdate, isTranslated, updateJsonLd, updatePath } from '@/lib/updates';
import { LOCALES, languageLinks } from '@/lib/i18n/locales';
import { absoluteUrl, metaDescription, metaTitle, shareMeta } from '@/lib/site';
import { UpdateArticle } from '@/components/UpdatesView';

// One post from the sheet's Updates tab. Built ahead of time at every deploy.
type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return getUpdates().map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const u = getUpdate(slug);
  if (!u) return {};
  const path = updatePath(u.slug);
  return {
    title: metaTitle(u.title),
    description: metaDescription(u.summary),
    alternates: {
      canonical: path,
      languages: languageLinks(path, (l) => intlUpdate(l, u.slug), LOCALES.filter((l) => isTranslated(u, l)))
    },
    ...shareMeta(u.title, u.summary, path, u.card && getCard(u.card) ? `/cards/${u.card}/opengraph-image` : undefined)
  };
}

export default async function UpdatePage({ params }: Props) {
  const { slug } = await params;
  const u = getUpdate(slug);
  if (!u) notFound();
  const jsonLd = updateJsonLd(u, u.title, u.summary, absoluteUrl(updatePath(u.slug)), absoluteUrl('/updates'), 'Updates', 'en');
  return <UpdateArticle u={u} jsonLd={jsonLd} />;
}
