import type { Metadata, Viewport } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SiteDocument, baseMetadata, baseViewport } from '@/components/SiteDocument';
import { lastUpdated } from '@/lib/cards';

// Root layout of the English site. The other languages have their own (app/[lang]/layout.tsx), so each page's
// <html lang> is right in the HTML the server sends. Moving between the two does a full page load.

export const metadata: Metadata = baseMetadata;
export const viewport: Viewport = baseViewport;

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteDocument lang="en" skip="Skip to content">
      <Header />
      <main id="main">{children}</main>
      <Footer updated={lastUpdated()} />
    </SiteDocument>
  );
}
