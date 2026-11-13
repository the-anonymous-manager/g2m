import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCards } from '@/lib/cards';
import { SubmitForm } from '@/components/SubmitForm';
import { Eyebrow } from '@/components/bits';
import { intlSubmit, languageLinks, localeByCode } from '@/lib/i18n/locales';
import { UI } from '@/lib/i18n/ui';
import { metaDescription, metaTitle, shareMeta, site } from '@/lib/site';

// The submit form in another language (/de/submit): the same form as /submit with that language's words
// (lib/i18n/ui/submit). The email it prepares stays in English, because it goes to the G2M team.
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) return {};
  const w = UI[locale.code].submit;
  return {
    title: metaTitle(w.metaTitle),
    description: metaDescription(w.metaDesc),
    alternates: { canonical: intlSubmit(locale), languages: languageLinks('/submit', intlSubmit) },
    ...shareMeta(w.metaTitle, w.metaDesc, intlSubmit(locale))
  };
}

export default async function IntlSubmitPage({ params, searchParams }: Props) {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) notFound();
  const w = UI[locale.code].submit;
  const p = await searchParams;
  const raw = Array.isArray(p.card) ? p.card[0] : p.card;
  const cards = getCards().map((c) => ({ slug: c.slug, name: c.name }));
  const initialCard = raw && cards.some((c) => c.slug === raw) ? raw : '';
  return (
    <div className="wrap section stack" style={{ gap: 28, maxWidth: 860 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>{w.eyebrow}</Eyebrow>
        <h1 className="h2">{w.title}</h1>
        <p className="lead">{w.lead}</p>
      </div>
      <SubmitForm email={site.contactEmail} cards={cards} initialCard={initialCard} words={w} />
    </div>
  );
}
