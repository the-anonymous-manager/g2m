/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The guide formerly called "self-custodial" is now "non-custodial": keep the old address working.
  async redirects() {
    return [{ source: '/guides/self-custodial-crypto-cards', destination: '/guides/non-custodial-crypto-cards', permanent: true }];
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
