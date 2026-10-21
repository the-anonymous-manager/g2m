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
