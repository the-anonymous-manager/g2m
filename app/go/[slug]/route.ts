import { NextResponse, type NextRequest } from 'next/server';
import { getCard, guessCard } from '@/lib/cards';
import { site } from '@/lib/site';
import { afterResponse, record } from '@/lib/stats/server';

// Campaign names a link may ask for with ?c=, so clicks from the sponsored spot are told apart.
const CAMPAIGNS = new Set(['sponsored']);

// /go/kast → the card's referral link (if set in cards.json) or official site, with UTM tags.
// Every click is recorded here, on the server, for /stats: ?p= says where on the site it was clicked.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = getCard(slug);
  if (!card) {
    // A cut-off link (e.g. "/go/ethena-pa=" from an email) still reaches the one card it can mean, counted there.
    const guess = guessCard(slug);
    const to = guess ? `/go/${guess.slug}${req.nextUrl.search}` : '/cards';
    return NextResponse.redirect(new URL(to, req.url), 302);
  }

  let target: URL;
  try {
    target = new URL(card.links.affiliate ?? card.links.official);
  } catch {
    return NextResponse.redirect(new URL(`/cards/${slug}`, req.url), 302);
  }
  const campaign = req.nextUrl.searchParams.get('c');
  const sponsored = campaign != null && CAMPAIGNS.has(campaign);
  if (!target.searchParams.has('utm_source')) {
    target.searchParams.set('utm_source', site.utm.source);
    target.searchParams.set('utm_medium', site.utm.medium);
    target.searchParams.set('utm_campaign', sponsored ? campaign : site.utm.campaign);
    target.searchParams.set('utm_content', slug);
  }

  // The page the button was on (same-site Referer), else "direct" for a /go link opened on its own.
  let from = 'direct';
  try {
    const ref = new URL(req.headers.get('referer') ?? '');
    if (ref.host === req.nextUrl.host) from = ref.pathname;
  } catch {
    // no or foreign referrer
  }
  afterResponse(
    record(req, {
      name: 'Outbound',
      path: from,
      card: slug,
      place: (req.nextUrl.searchParams.get('p') ?? 'unknown').slice(0, 60),
      props: { sponsored, referral: Boolean(card.links.affiliate) }
    })
  );

  const res = NextResponse.redirect(target.toString(), 302);
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
