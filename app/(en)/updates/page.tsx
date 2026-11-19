import type { Metadata } from 'next';
import { getUpdates } from '@/lib/updates';
import { intlUpdates, languageLinks } from '@/lib/i18n/locales';
import { en } from '@/lib/i18n/dict/en';
import { metaDescription, shareMeta } from '@/lib/site';
import { UpdatesList } from '@/components/UpdatesView';

// Card news, offers and sign-up bonuses from the sheet's Updates tab (lib/updates.ts), newest first.
// Built ahead of time at every deploy; each sheet sync deploys.

export const metadata: Metadata = {
  title: en.updTitle,
  description: metaDescription(en.updDesc),
  alternates: {
    canonical: '/updates',
    languages: languageLinks('/updates', intlUpdates),
    types: { 'application/rss+xml': [{ url: '/updates/feed.xml', title: 'G2M updates' }] }
  },
  // An empty list is not worth a search result.
  robots: getUpdates().length ? undefined : { index: false, follow: true },
  ...shareMeta(en.updTitle, en.updDesc, '/updates')
};

export default function UpdatesPage() {
  return <UpdatesList />;
}
