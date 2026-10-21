import { NextResponse, type NextRequest } from 'next/server';
import { getCard } from '@/lib/cards';
import { site } from '@/lib/site';

// /go/kast → the card's referral link (if set in cards.json) or official site, with UTM tags.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = getCard(slug);
  if (!card) return NextResponse.redirect(new URL('/cards', req.url), 302);

  let target: URL;
  try {
    target = new URL(card.links.affiliate ?? card.links.official);
  } catch {
    return NextResponse.redirect(new URL(`/cards/${slug}`, req.url), 302);
  }
  if (!target.searchParams.has('utm_source')) {
    target.searchParams.set('utm_source', site.utm.source);
    target.searchParams.set('utm_medium', site.utm.medium);
    target.searchParams.set('utm_campaign', site.utm.campaign);
    target.searchParams.set('utm_content', slug);
  }
  const res = NextResponse.redirect(target.toString(), 302);
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
