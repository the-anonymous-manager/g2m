import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SiteDocument, baseMetadata, baseViewport } from '@/components/SiteDocument';
import { NotFoundBody } from '@/components/NotFoundBody';
import { lastUpdated } from '@/lib/cards';

// The 404 page for addresses that match no page at all. The site has two root layouts (English and the other
// languages), so Next.js needs this one to stand on its own (experimental.globalNotFound in next.config.mjs).

export const metadata: Metadata = { metadataBase: baseMetadata.metadataBase, title: 'Page not found · G2M', robots: { index: false } };
export const viewport = baseViewport;

export default function GlobalNotFound() {
  return (
    <SiteDocument lang="en" skip="Skip to content">
      <Header />
      <main id="main">
        <NotFoundBody />
      </main>
      <Footer updated={lastUpdated()} />
    </SiteDocument>
  );
}
