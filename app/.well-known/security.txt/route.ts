import { site } from '@/lib/site';

// security.txt (RFC 9116): where to report a security problem with g2m.life. Expires is kept a year ahead.
export const dynamic = 'force-dynamic';

export function GET() {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const body = [
    `Contact: mailto:${site.contactEmail}`,
    `Expires: ${expires}`,
    'Preferred-Languages: en',
    `Canonical: ${site.url}/.well-known/security.txt`,
    ''
  ].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
}
