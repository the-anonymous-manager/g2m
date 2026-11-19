import { readFileSync } from 'node:fs';

// Card addresses people (and AI assistants) guess wrongly: "/cards/pulsar-money-card" for /cards/pulsar-money,
// "/cards/avalanche" for /cards/avalanche-card, in any language. /stats listed them as broken pages (19 Nov 2026).
const LANGS = 'de|fr|es|pl|tr|ru|ar|zh-hk';
const slugs = JSON.parse(readFileSync(new URL('./data/cards.json', import.meta.url), 'utf8')).map((c) => c.slug);
const cardGuesses = slugs.flatMap((slug) => {
  const guess = slug.endsWith('-card') ? slug.slice(0, -'-card'.length) : `${slug}-card`;
  if (slugs.includes(guess)) return [];
  return [
    { source: `/cards/${guess}/:rest*`, destination: `/cards/${slug}/:rest*`, permanent: true },
    { source: `/:lang(${LANGS})/cards/${guess}/:rest*`, destination: `/:lang/cards/${slug}/:rest*`, permanent: true }
  ];
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Always put the title, description and canonical link in <head>. By default Next.js streams them into <body> for
  // every visitor except a short list of crawlers that excludes Googlebot, and Google ignores a canonical link in the
  // body: Search Console showed "User-declared canonical: None" on the home page, /cards and /submit (Nov 2026).
  htmlLimitedBots: /.*/,
  // Two root layouts (English, and the other languages with their own <html lang>) need a stand-alone 404 page
  // for addresses that match nothing: app/global-not-found.tsx.
  experimental: { globalNotFound: true },
  // The guide formerly called "self-custodial" is now "non-custodial": keep the old address working.
  async redirects() {
    return [
      // One address for the whole site: www.g2m.life was serving a full copy, and Google picked it as the main
      // address for the home page. Every www page now forwards permanently to the same page on g2m.life.
      { source: '/:path*', has: [{ type: 'host', value: 'www.g2m.life' }], destination: 'https://g2m.life/:path*', permanent: true },
      { source: '/guides/self-custodial-crypto-cards', destination: '/guides/non-custodial-crypto-cards', permanent: true },
      // English has no /en prefix: /en/cards/kast is /cards/kast.
      { source: '/en', destination: '/', permanent: true },
      { source: '/en/:path*', destination: '/:path*', permanent: true },
      // "card" for "cards".
      { source: '/card/:path*', destination: '/cards/:path*', permanent: true },
      { source: `/:lang(${LANGS})/card/:path*`, destination: '/:lang/cards/:path*', permanent: true },
      ...cardGuesses
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' }
        ]
      }
    ];
  }
};

export default nextConfig;
