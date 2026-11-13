import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCards } from '@/lib/cards';
import { BookPage } from '@/components/BookPage';
import { intlBook, intlMethodology, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { UI } from '@/lib/i18n/ui';
import { metaDescription, metaTitle, shareMeta, site } from '@/lib/site';

// The booking page in another language (/de/book): the same page as /book with that language's words
// (lib/i18n/ui/book). Card names stay as they are.
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) return {};
  const w = UI[locale.code].book;
  return {
    title: metaTitle(w.title),
    description: metaDescription(w.metaDesc),
    alternates: { canonical: intlBook(locale), languages: languageLinks('/book', intlBook) },
    ...shareMeta(w.title, w.metaDesc, intlBook(locale))
  };
}

export default async function IntlBook({ params, searchParams }: Props) {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) notFound();
  const p = await searchParams;
  const cards = getCards().map((c) => ({ slug: c.slug, name: c.name }));
  return (
    <BookPage
      cards={cards}
      email={site.contactEmail}
      words={UI[locale.code].book}
      tag={locale.tag}
      lang={locale.code}
      moneyHref={`${intlMethodology(locale)}#money`}
      spot={one(p.spot)}
      card={one(p.card)}
    />
  );
}
