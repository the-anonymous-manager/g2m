import Link from 'next/link';
import { LogoMark } from '@/components/Logo';
import { site } from '@/lib/site';
import { fmtDate } from '@/lib/format';
import { LOCALES, intlHome } from '@/lib/i18n/locales';

export function Footer({ updated }: { updated: string }) {
  return (
    <footer className="site-footer">
      <div className="wrap stack" style={{ gap: 28 }}>
        <div className="footer-grid">
          <div className="stack" style={{ gap: 12, maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <LogoMark size={32} id="ftr" />
              <span style={{ fontWeight: 800, letterSpacing: '-0.5px', fontSize: 18 }}>
                G2M <span className="faint" style={{ fontWeight: 500 }}>· Gwei 2 Merchant</span>
              </span>
            </div>
            <p className="muted" style={{ fontSize: 14 }}>
              {site.tagline} {site.subline} Independent crypto card rankings, built from published card terms.
            </p>
          </div>
          <nav aria-label="Footer" className="footer-links">
            <Link href="/cards?country=all">All cards</Link>
            <Link href="/finder">Card finder</Link>
            <Link href="/calculator">Rewards calculator</Link>
            <Link href="/wallet">Wallet builder</Link>
            <Link href="/receipt">Swipe receipt</Link>
            <Link href="/corridors">Corridor finder</Link>
            <Link href="/compare">Compare</Link>
            <Link href="/guides">Guides</Link>
            <Link href="/methodology">Methodology</Link>
            <Link href="/submit">Submit a card</Link>
            {site.twitter ? (
              <a href={`https://x.com/${site.twitter.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer">
                X
              </a>
            ) : null}
          </nav>
        </div>
        <nav aria-label="Languages" className="footer-links lang-links">
          <span className="faint">Languages:</span>
          <Link href="/" aria-current="true">
            English
          </Link>
          {LOCALES.map((l) => (
            <Link key={l.code} href={intlHome(l)} lang={l.tag} hrefLang={l.tag}>
              {l.name}
            </Link>
          ))}
        </nav>
        <p className="faint" style={{ fontSize: 13, maxWidth: '90ch' }}>
          Not financial advice. Card terms change often, so check the issuer&apos;s site before you apply. Some links may
          earn G2M a referral fee; that never changes a card&apos;s rank. Data last checked {fmtDate(updated)}.
        </p>
      </div>
    </footer>
  );
}
