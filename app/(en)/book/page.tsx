import type { Metadata } from 'next';
import { getCards } from '@/lib/cards';
import { metaDescription, metaTitle, shareMeta, site } from '@/lib/site';
import { BookPage } from '@/components/BookPage';
import { bookEn } from '@/lib/i18n/ui/book/en';
import { intlBook, languageLinks } from '@/lib/i18n/locales';

// Card issuers book the top spot or one of Our picks here; the home page links to it ("Book a spot", and
// "Book this spot" on the top card, with ?spot=top). Requests are saved for /stats (lib/bookings.ts).

export const metadata: Metadata = {
  title: metaTitle(bookEn.title),
  description: metaDescription(bookEn.metaDesc),
  alternates: { canonical: '/book', languages: languageLinks('/book', intlBook) },
  ...shareMeta(bookEn.title, bookEn.metaDesc, '/book')
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Book({ searchParams }: Props) {
  const p = await searchParams;
  const cards = getCards().map((c) => ({ slug: c.slug, name: c.name }));
  return <BookPage cards={cards} email={site.contactEmail} spot={one(p.spot)} card={one(p.card)} />;
}
