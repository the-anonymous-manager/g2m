import type { Metadata } from 'next';

// Site-wide settings. Override the URL with NEXT_PUBLIC_SITE_URL on your host.
export const site = {
  name: 'G2M',
  expansion: 'Gwei 2 Merchant',
  tagline: 'Spend your bags better.',
  subline: 'From on-chain to checkout.',
  description:
    'G2M is the crypto card directory. Every crypto card ranked on rewards, fees and where it actually works, from on-chain to checkout.',
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'https://g2m.life').replace(/\/$/, ''),
  twitter: process.env.NEXT_PUBLIC_TWITTER_HANDLE || '@0akash0x',
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'info@g2m.life',
  utm: { source: 'g2m', medium: 'referral', campaign: 'directory' }
} as const;

export const absoluteUrl = (path = '/') => `${site.url}${path.startsWith('/') ? path : `/${path}`}`;

/**
 * Link-preview data (Open Graph + X) for a page. A page that sets its own `openGraph` or `twitter` replaces the
 * site-wide ones entirely, picture and card size included, so every page must go through here.
 * `image`: a picture for this page; the default is the site's own share picture. Pass null when the page folder has
 * its own opengraph-image file (the card pages), which Next adds by itself.
 */
export function shareMeta(title: string, description: string, path: string, image: string | null = '/opengraph-image'): Pick<Metadata, 'openGraph' | 'twitter'> {
  const images = image ? [{ url: image, width: 1200, height: 630, alt: title }] : undefined;
  return {
    openGraph: { type: 'website', siteName: `${site.name} · ${site.expansion}`, title, description, url: absoluteUrl(path), ...(images ? { images } : {}) },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(images ? { images: images.map((i) => i.url) } : {}),
      ...(site.twitter ? { site: site.twitter, creator: site.twitter } : {})
    }
  };
}
