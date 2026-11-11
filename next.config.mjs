/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Always put the title, description and canonical link in <head>. By default Next.js streams them into <body> for
  // every visitor except a short list of crawlers that excludes Googlebot, and Google ignores a canonical link in the
  // body: Search Console showed "User-declared canonical: None" on the home page, /cards and /submit (Nov 2026).
  htmlLimitedBots: /.*/,
  // The guide formerly called "self-custodial" is now "non-custodial": keep the old address working.
  async redirects() {
    return [
      // One address for the whole site: www.g2m.life was serving a full copy, and Google picked it as the main
      // address for the home page. Every www page now forwards permanently to the same page on g2m.life.
      { source: '/:path*', has: [{ type: 'host', value: 'www.g2m.life' }], destination: 'https://g2m.life/:path*', permanent: true },
      { source: '/guides/self-custodial-crypto-cards', destination: '/guides/non-custodial-crypto-cards', permanent: true }
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
