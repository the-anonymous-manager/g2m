'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { intlHome, localeOfPath } from '@/lib/i18n/locales';
import { CHROME } from '@/lib/i18n/chrome';
import { Eyebrow } from '@/components/bits';
import { NotFoundTracker } from '@/components/PageTracker';

/** The 404 message, in the language of the address (/de/... in German), else in English. */
export function NotFoundBody() {
  const locale = localeOfPath(usePathname());
  const t = locale ? CHROME[locale.code] : null;
  useEffect(() => {
    if (locale) document.documentElement.lang = locale.tag;
  }, [locale]);
  return (
    <div className="wrap section stack" style={{ gap: 16, alignItems: 'flex-start', minHeight: '50vh' }} lang={locale?.tag} dir={locale?.dir}>
      <NotFoundTracker />
      <Eyebrow>404</Eyebrow>
      {locale && t ? (
        <>
          <h1 className="h2">{t.notFound}</h1>
          <Link href={intlHome(locale)} className="btn btn-metal">
            {t.ranking}
          </Link>
        </>
      ) : (
        <>
          <h1 className="h2">This page isn&apos;t in the directory</h1>
          <p className="lead">The card or page may have moved. The full rankings are a good place to start.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/cards" className="btn btn-metal">
              See all cards
            </Link>
            <Link href="/" className="btn">
              Home
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
