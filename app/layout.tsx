import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Analytics } from '@/components/Analytics';
import { PageTracker } from '@/components/PageTracker';
import { NavMemory } from '@/components/BackButton';
import { RegionProvider } from '@/components/RegionContext';
import { themeInitScript } from '@/components/ThemeToggle';
import { MotionRoot, motionInitScript } from '@/components/motion/MotionRoot';
import { site } from '@/lib/site';
import { lastUpdated } from '@/lib/cards';

export const metadata: Metadata = {
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f5f0' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0c' }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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
          Skip to content
        </a>
        <RegionProvider>
          <Header />
          <main id="main">{children}</main>
          <Footer updated={lastUpdated()} />
        </RegionProvider>
        <MotionRoot />
        <NavMemory />
        <Analytics />
        <PageTracker />
      </body>
    </html>
  );
}
