import Link from 'next/link';
import { LogoMark } from '@/components/Logo';
import { site } from '@/lib/site';
import { fmtDate } from '@/lib/format';

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
            <Link href="/cards">All cards</Link>
            <Link href="/finder">Card finder</Link>
            <Link href="/calculator">Rewards calculator</Link>
            <Link href="/compare">Compare</Link>
            <Link href="/methodology">Methodology</Link>
            <Link href="/submit">Submit a card</Link>
            {site.twitter ? (
              <a href={`https://x.com/${site.twitter.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer">
                X
              </a>
            ) : null}
          </nav>
        </div>
        <p className="faint" style={{ fontSize: 13, maxWidth: '90ch' }}>
          Not financial advice. Card terms change often, so check the issuer&apos;s site before you apply. Some links may
          earn G2M a referral fee; that never changes a card&apos;s rank. Data last checked {fmtDate(updated)}.
        </p>
      </div>
    </footer>
  );
}
