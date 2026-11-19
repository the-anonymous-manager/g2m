import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getUpdates } from '@/lib/updates';
import { LOCALES, intlUpdates, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { DICTS } from '@/lib/i18n/dict';
import { metaDescription, metaTitle, shareMeta } from '@/lib/site';
import { UpdatesList } from '@/components/UpdatesView';

// The Updates page in another language: the same posts, translated where data/i18n has them, else in English (marked)
// and linking to the English post. Built ahead of time at each deploy.
type Props = { params: Promise<{ lang: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l.code }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) return {};
  const d = DICTS[locale.code];
  return {
    title: metaTitle(d.updTitle),
    description: metaDescription(d.updDesc),
    alternates: { canonical: intlUpdates(locale), languages: languageLinks('/updates', intlUpdates) },
    robots: getUpdates().length ? undefined : { index: false, follow: true },
    ...shareMeta(d.updTitle, d.updDesc, intlUpdates(locale))
  };
}

export default async function IntlUpdatesPage({ params }: Props) {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) notFound();
  return <UpdatesList locale={locale} />;
}
