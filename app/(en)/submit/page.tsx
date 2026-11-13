import type { Metadata } from 'next';
import { getCards } from '@/lib/cards';
import { site } from '@/lib/site';
import { SubmitForm } from '@/components/SubmitForm';
import { Eyebrow } from '@/components/bits';
import { intlSubmit, languageLinks } from '@/lib/i18n/locales';

export const metadata: Metadata = {
  title: 'Submit a card or a correction',
  description: 'Card issuers and users: add a crypto card to G2M or send a correction to a listed card.',
  alternates: { canonical: '/submit', languages: languageLinks('/submit', intlSubmit) }
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SubmitPage({ searchParams }: Props) {
  const p = await searchParams;
  const raw = Array.isArray(p.card) ? p.card[0] : p.card;
  const cards = getCards().map((c) => ({ slug: c.slug, name: c.name }));
  const initialCard = raw && cards.some((c) => c.slug === raw) ? raw : '';
  return (
    <div className="wrap section stack" style={{ gap: 28, maxWidth: 860 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>submit</Eyebrow>
        <h1 className="h2">Add a card or fix one</h1>
        <p className="lead">
          Issuers can submit a new card, and anyone can send a correction. We check every change against the issuer&apos;s
          published terms before it goes live. Listing is free and does not affect the score.
        </p>
      </div>
      <SubmitForm email={site.contactEmail} cards={cards} initialCard={initialCard} />
    </div>
  );
}
