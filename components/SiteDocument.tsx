import type { Metadata, Viewport } from 'next';
import '@/app/globals.css';
import { Analytics } from '@/components/Analytics';
import { PageTracker } from '@/components/PageTracker';
import { NavMemory } from '@/components/BackButton';
import { RegionProvider } from '@/components/RegionContext';
import { themeInitScript } from '@/components/ThemeToggle';
import { MotionRoot, motionInitScript } from '@/components/motion/MotionRoot';
import { site } from '@/lib/site';

// The <html> document shared by the two root layouts: English pages (app/(en)/layout.tsx) and the other languages
// (app/[lang]/layout.tsx). Each layout passes its language, so the HTML the server sends already says which
// language the page is in (browsers then don't offer to translate a German page "from English", and screen
// readers use the right voice) and Arabic is right to left from the first paint.

export const baseMetadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} · ${site.tagline} The crypto card directory`,
    template: `%s · ${site.name}`
  },
  description: site.description,
  applicationName: site.name,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: `${site.name} · ${site.expansion}`,
    title: `${site.name} · ${site.tagline}`,
    description: site.description,
    url: site.url
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.name} · ${site.tagline}`,
    description: site.description,
    ...(site.twitter ? { site: site.twitter, creator: site.twitter } : {})
  },
  robots: { index: true, follow: true }
};

export const baseViewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f5f0' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0c' }
  ]
};

export function SiteDocument({
  lang,
  dir = 'ltr',
  skip,
  children
}: {
  lang: string;
  dir?: 'ltr' | 'rtl';
  /** "Skip to content" in the page's language. */
  skip: string;
  children: React.ReactNode;
}) {
  return (
    <html lang={lang} dir={dir} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: motionInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,500;0,600;0,700;0,800;1,600;1,700&family=Roboto+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <a href="#main" className="skip-link">
          {skip}
        </a>
        <RegionProvider>{children}</RegionProvider>
        <MotionRoot />
        <NavMemory />
        <Analytics />
        <PageTracker />
      </body>
    </html>
  );
}
