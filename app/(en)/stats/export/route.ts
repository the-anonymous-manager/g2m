import { NextResponse, type NextRequest } from 'next/server';
import { STATS_COOKIE, isStatsUser, readyDb } from '@/lib/stats/server';
import { rangeDays, report, startDay } from '@/lib/stats/report';

// CSV downloads for /stats: the per-card summary (for sponsors) or every recorded event. Same login as /stats.

const cell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  // Quote everything; a leading = + - @ would run as a formula in Sheets/Excel.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};
const csv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';

export async function GET(req: NextRequest) {
  if (!(await isStatsUser(req.cookies.get(STATS_COOKIE)?.value))) return new NextResponse('Log in at /stats first.', { status: 401 });
  const db = await readyDb();
  if (!db) return new NextResponse('The stats database is not connected.', { status: 503 });

  const days = rangeDays(req.nextUrl.searchParams.get('r') ?? undefined);
  const kind = req.nextUrl.searchParams.get('kind') === 'events' ? 'events' : 'cards';
  let body: string;
  if (kind === 'cards') {
    const data = await report(db, days);
    body = csv([
      ['Card', 'Card ID', 'Referral link', 'Get the card clicks', 'Sponsored clicks', 'People who clicked', 'Card page views', 'Card page visitors', 'Clicks from its page', 'Click rate %'],
      ...data.cards.map((c) => [c.name, c.slug, c.referral ? 'yes' : 'no', c.clicks, c.sponsored, c.people, c.views, c.visitors, c.fromPage, c.rate ?? ''])
    ]);
  } else {
    const { results } = await db
      .prepare('SELECT ts, name, path, card, place, props, source, ref, country, device, vid FROM ev WHERE day >= ? ORDER BY ts LIMIT 200000')
      .bind(startDay(days))
      .all<Record<string, unknown>>();
    body = csv([
      // Visitor: the anonymous code for one person on one day, so one person's pages and clicks can be followed.
      // Events starting "auto:" are crawlers and scripts, left out of the numbers on /stats.
      ['Time (UTC)', 'Event', 'Page', 'Card', 'Spot', 'Details', 'Source', 'Referring site', 'Country', 'Device', 'Visitor'],
      ...results.map((r) => [
        new Date(Number(r.ts)).toISOString().replace('T', ' ').slice(0, 19),
        r.name,
        r.path,
        r.card,
        r.place,
        r.props,
        r.source,
        r.ref,
        r.country,
        r.device,
        r.vid ? String(r.vid).slice(0, 8) : ''
      ])
    ]);
  }
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="g2m-${kind}-${days}d-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store'
    }
  });
}
