import type { Metadata, Viewport } from 'next';
import { LOCALES, localeByCode } from '@/lib/i18n/locales';
import { CHROME } from '@/lib/i18n/chrome';
import { lastUpdated } from '@/lib/cards';
import { SiteDocument, baseMetadata, baseViewport } from '@/components/SiteDocument';
import { IntlFooter, IntlHeader } from '@/components/IntlFrame';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

// Root layout of the other languages (/de, /ar ...): the <html> tag carries the page's language and, for Arabic,
// right-to-left, in the HTML the server sends.
// Any other first segment (/xyz) also lands here: the page then shows the 404 (every page checks its language)
// inside the English header and footer. dynamicParams stays on, so the "X vs Y" and country pages not built ahead
// of time are still put together on the first visit.

export const metadata: Metadata = baseMetadata;
export const viewport: Viewport = baseViewport;

export function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l.code }));
}

export default async function LanguageLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = localeByCode(lang);
  if (!locale) {
    return (
      <SiteDocument lang="en" skip="Skip to content">
        <Header />
        <main id="main">{children}</main>
        <Footer updated={lastUpdated()} />
      </SiteDocument>
    );
  }
  return (
    <SiteDocument lang={locale.tag} dir={locale.dir} skip={CHROME[locale.code].skip}>
      {/* .intl keeps the language-specific styles (no spaced capitals in Arabic and Chinese) */}
      <div lang={locale.tag} dir={locale.dir} className="intl">
        <IntlHeader locale={locale} />
        <main id="main">{children}</main>
        <IntlFooter locale={locale} />
      </div>
    </SiteDocument>
  );
}
