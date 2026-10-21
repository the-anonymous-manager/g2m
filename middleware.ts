import { NextResponse, type NextRequest } from 'next/server';
import { REGION_COOKIE } from '@/lib/regions';

// Reads the visitor's country from the host's geo header and stores it in a cookie,
// so the site can default to cards available where they live.
// Vercel sends x-vercel-ip-country, Cloudflare sends cf-ipcountry, Netlify sends x-country.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (req.cookies.has(REGION_COOKIE)) return res;
  const country =
    req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || req.headers.get('x-country') || '';
  if (/^[A-Za-z]{2}$/.test(country) && country.toUpperCase() !== 'XX') {
    res.cookies.set(REGION_COOKIE, country.toUpperCase(), {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
      secure: req.nextUrl.protocol === 'https:'
    });
  }
  return res;
}

export const config = {
  // Pages only: skip static files, images, the API-style /go redirects and metadata files.
  matcher: ['/((?!_next/|go/|favicon|icon|apple-icon|opengraph-image|robots.txt|sitemap.xml|.*\\..*).*)']
};
