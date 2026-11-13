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

/** The language of a page for link previews (og:locale), from the first part of its address (/de/…). */
const OG_LOCALE: Record<string, string> = {
  de: 'de_DE',
  fr: 'fr_FR',
  es: 'es_ES',
  pl: 'pl_PL',
  tr: 'tr_TR',
  ru: 'ru_RU',
  ar: 'ar_AE',
  'zh-hk': 'zh_HK'
};

/**
 * A search-result description that fits what Google shows (about 160 characters; about 80 for Chinese, whose
 * characters are twice as wide): whole sentences while they fit, else cut at a word with "…".
 */
export function metaDescription(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  const cjk = (t.match(/[　-鿿＀-￯]/g) ?? []).length > t.length / 3;
  const max = cjk ? 80 : 160;
  if (t.length <= max) return t;
  // Whole sentences that fit: a sentence ends at . ! ? followed by a space (so "0.5%" and "ether.fi" stay whole), or 。！？.
  let end = 0;
  for (const m of t.matchAll(/[.!?](?=\s)|[。！？]/g)) {
    if (m.index! + 1 > max) break;
    end = m.index! + 1;
  }
  if (end >= max * 0.45) return t.slice(0, end);
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,;:·(–-]+$/, '')}…`;
}

/** A page title with " · G2M" unless that makes it longer than Google shows (about 65 characters). */
export const metaTitle = (t: string) => ({ absolute: t.length + 6 > 65 ? t : `${t} · ${site.name}` });

/**
 * Link-preview data (Open Graph + X) for a page. A page that sets its own `openGraph` or `twitter` replaces the
 * site-wide ones entirely, picture and card size included, so every page must go through here.
 * `image`: a picture for this page; the default is the site's own share picture. Pass null when the page folder has
 * its own opengraph-image file (the card pages), which Next adds by itself.
 */
export function shareMeta(title: string, description: string, path: string, image: string | null = '/opengraph-image'): Pick<Metadata, 'openGraph' | 'twitter'> {
  const images = image ? [{ url: image, width: 1200, height: 630, alt: title }] : undefined;
  description = metaDescription(description);
  return {
    openGraph: {
      type: 'website',
      siteName: `${site.name} · ${site.expansion}`,
      title,
      description,
      url: absoluteUrl(path),
      locale: OG_LOCALE[path.split('/')[1]] ?? 'en_US',
      ...(images ? { images } : {})
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(images ? { images: images.map((i) => i.url) } : {}),
      ...(site.twitter ? { site: site.twitter, creator: site.twitter } : {})
    }
  };
}
