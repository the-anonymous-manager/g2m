import { NextResponse, type NextRequest } from 'next/server';
import { afterResponse, record } from '@/lib/stats/server';

// Receives page views and tool use from visitors' browsers (lib/analytics.ts) and stores them for /stats.
// "Get the card" clicks are not sent here: /go/[slug] records them on the server, out of ad blockers' reach.

const EVENTS = new Set([
  'pageview',
  '404',
  'Calculator',
  'Compare',
  'Compare add',
  'Compare open',
  'Corridor',
  'Finder',
  'Rankings',
  'Region',
  'Share',
  'Submit',
  'Theme',
  'Wallet'
]);

type Body = { n?: unknown; p?: unknown; r?: unknown; u?: unknown; e?: unknown; props?: unknown };

function cleanProps(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(raw).slice(0, 10)) {
    if (typeof v === 'number' || typeof v === 'boolean') out[k.slice(0, 20)] = v;
    else if (typeof v === 'string') out[k.slice(0, 20)] = v.slice(0, 120);
  }
  return out;
}

const text = (v: unknown, n: number) => (typeof v === 'string' && v ? v.slice(0, n) : null);

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const name = typeof body.n === 'string' ? body.n : '';
  const path = text(body.p, 200);
  if (!EVENTS.has(name) || !path?.startsWith('/') || path.startsWith('/stats')) return new NextResponse(null, { status: 204 });
  const props = cleanProps(body.props);
  const card = props && typeof props.card === 'string' ? props.card : null;
  afterResponse(record(req, { name, path, card, props, ref: text(body.r, 300), utm: text(body.u, 40), landing: body.e === 1 }));
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
