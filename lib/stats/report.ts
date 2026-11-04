import 'server-only';
import { getCards } from '@/lib/cards';
import type { D1 } from '@/lib/stats/server';

// The numbers on /stats, all read from the `ev` table (lib/stats/server.ts) for one date range.

export const RANGES = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '12 months' }
] as const;

export const rangeDays = (r: string | undefined) => RANGES.find((x) => String(x.days) === r)?.days ?? 30;

/** First day (UTC, YYYY-MM-DD) of a range that ends today. */
export const startDay = (days: number) => new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);

export type Row = Record<string, string | number | null>;

// Where on the site a "Get the card" button sits (OutboundLink placement).
const PLACES: [RegExp, string][] = [
  [/^hero-sponsored$/, 'Home: Featured (sponsored)'],
  [/^hero-top$/, 'Home: top spot (top ranked)'],
  [/^hero-pick$/, 'Home: top spot (our pick)'],
  [/^pick-(\d)$/, 'Home: Our picks slot $1'],
  [/^card-hero$/, 'Card page'],
  [/^compare$/, 'Compare'],
  [/^versus$/, 'A vs B page'],
  [/^finder-(\d)$/, 'Card finder result $1'],
  [/^guide-(.+)$/, 'Guide: $1'],
  [/^alternatives-(.+)$/, 'Alternatives to $1'],
  [/^unknown$/, 'Link opened directly']
];
export function placeLabel(p: string | null) {
  if (!p) return 'Unknown';
  for (const [re, label] of PLACES) if (re.test(p)) return p.replace(re, label);
  return p;
}

export const EVENT_LABELS: Record<string, string> = {
  Calculator: 'Rewards calculator',
  Compare: 'Compare (cards compared)',
  'Compare add': 'Rankings: added to compare',
  'Compare open': 'Rankings: opened compare',
  Corridor: 'Money corridors',
  Finder: 'Card finder (finished)',
  Rankings: 'Rankings: filters and sorting',
  Region: 'Changed country',
  Share: 'Shares',
  Submit: '"Submit a card" sent',
  Theme: 'Dark / light mode',
  Wallet: 'Wallet builder'
};

// Unique visitors over a range use the monthly code (rows from before it existed fall back to the daily one).
// A person counts once per calendar month: someone who comes back next month counts again.
const U = 'COALESCE(mid, vid)';

const all = async (db: D1, sql: string, ...args: unknown[]) => (await db.prepare(sql).bind(...args).all<Row>()).results;

export async function report(db: D1, days: number) {
  const from = startDay(days);
  const names = new Map(getCards().map((c) => [c.slug, c.name]));
  const affiliate = new Set(getCards().filter((c) => c.links.affiliate).map((c) => c.slug));

  const [totals, daily, byCard, cardViews, byPlace, clickCountries, pages, sources, refs, countries, devices, tools, details, broken] =
    await Promise.all([
      db
        .prepare(
          `SELECT SUM(name = 'pageview') AS views, COUNT(DISTINCT CASE WHEN name = 'pageview' THEN ${U} END) AS visitors,
             SUM(name = 'pageview' AND source IS NOT NULL) AS visits, SUM(name = 'Outbound') AS clicks,
             COUNT(DISTINCT CASE WHEN name = 'Outbound' THEN ${U} END) AS clickers FROM ev WHERE day >= ?`
        )
        .bind(from)
        .first<Row>(),
      all(
        db,
        `SELECT day, SUM(name = 'pageview') AS views, COUNT(DISTINCT CASE WHEN name = 'pageview' THEN vid END) AS visitors,
           SUM(name = 'pageview' AND source IS NOT NULL) AS visits, SUM(name = 'Outbound') AS clicks
           FROM ev WHERE day >= ? GROUP BY day ORDER BY day`,
        from
      ),
      all(
        db,
        `SELECT card, COUNT(*) AS clicks, SUM(json_extract(props, '$.sponsored') = 1) AS sponsored, COUNT(DISTINCT ${U}) AS people,
             COUNT(DISTINCT CASE WHEN place = 'card-hero' THEN ${U} END) AS from_page, SUM(place = 'card-hero') AS from_page_clicks
           FROM ev WHERE name = 'Outbound' AND day >= ? GROUP BY card ORDER BY clicks DESC`,
        from
      ),
      all(
        db,
        `SELECT substr(path, 8) AS card, COUNT(*) AS views, COUNT(DISTINCT ${U}) AS visitors FROM ev
           WHERE name = 'pageview' AND path LIKE '/cards/%' AND day >= ? GROUP BY path`,
        from
      ),
      all(db, `SELECT place, COUNT(*) AS clicks FROM ev WHERE name = 'Outbound' AND day >= ? GROUP BY place ORDER BY clicks DESC`, from),
      all(
        db,
        `SELECT country, COUNT(*) AS clicks FROM ev WHERE name = 'Outbound' AND day >= ? GROUP BY country ORDER BY clicks DESC LIMIT 30`,
        from
      ),
      all(
        db,
        `SELECT path, COUNT(*) AS views, COUNT(DISTINCT ${U}) AS visitors FROM ev WHERE name = 'pageview' AND day >= ?
           GROUP BY path ORDER BY views DESC LIMIT 40`,
        from
      ),
      all(
        db,
        `SELECT source, COUNT(*) AS visits, COUNT(DISTINCT ${U}) AS visitors FROM ev
           WHERE name = 'pageview' AND source IS NOT NULL AND day >= ? GROUP BY source ORDER BY visits DESC LIMIT 30`,
        from
      ),
      all(
        db,
        `SELECT ref, COUNT(*) AS visits FROM ev WHERE name = 'pageview' AND ref IS NOT NULL AND source IS NOT NULL AND day >= ?
           GROUP BY ref ORDER BY visits DESC LIMIT 30`,
        from
      ),
      all(
        db,
        `SELECT country, COUNT(DISTINCT ${U}) AS visitors, COUNT(*) AS views FROM ev WHERE name = 'pageview' AND day >= ?
           GROUP BY country ORDER BY visitors DESC LIMIT 40`,
        from
      ),
      all(
        db,
        `SELECT device, COUNT(DISTINCT ${U}) AS visitors FROM ev WHERE name = 'pageview' AND day >= ? GROUP BY device ORDER BY visitors DESC`,
        from
      ),
      all(
        db,
        `SELECT name, COUNT(*) AS n, COUNT(DISTINCT ${U}) AS people FROM ev WHERE name NOT IN ('pageview', 'Outbound', '404') AND day >= ?
           GROUP BY name ORDER BY n DESC`,
        from
      ),
      all(
        db,
        `SELECT ev.name AS name, j.key AS k, CAST(j.value AS TEXT) AS v, COUNT(*) AS n FROM ev, json_each(ev.props) AS j
           WHERE ev.name NOT IN ('pageview', 'Outbound', '404') AND ev.props IS NOT NULL AND ev.day >= ?
           GROUP BY 1, 2, 3 ORDER BY n DESC LIMIT 3000`,
        from
      ),
      all(
        db,
        `SELECT path, COUNT(*) AS n, MAX(ref) AS ref FROM ev WHERE name = '404' AND day >= ? GROUP BY path ORDER BY n DESC LIMIT 40`,
        from
      )
    ]);

  // Per card: clicks next to how often its page was read. The click rate is the share of people who read the
  // card page and pressed its own "Get the card" button, so it shows which pages convert.
  const viewsOf = new Map(cardViews.map((r) => [String(r.card), r]));
  const slugs = new Set([...byCard.map((r) => String(r.card)), ...cardViews.map((r) => String(r.card))]);
  const cards = [...slugs]
    .filter((s) => names.has(s))
    .map((slug) => {
      const c = byCard.find((r) => r.card === slug);
      const v = viewsOf.get(slug);
      const clicks = Number(c?.clicks ?? 0);
      const visitors = Number(v?.visitors ?? 0);
      return {
        slug,
        name: names.get(slug)!,
        referral: affiliate.has(slug),
        clicks,
        sponsored: Number(c?.sponsored ?? 0),
        people: Number(c?.people ?? 0),
        views: Number(v?.views ?? 0),
        visitors,
        fromPage: Number(c?.from_page_clicks ?? 0), // clicks on the card's own page
        fromPagePeople: Number(c?.from_page ?? 0), // people behind them, for the click rate
        rate: visitors ? Math.round((Number(c?.from_page ?? 0) / visitors) * 1000) / 10 : null
      };
    })
    .sort((a, b) => b.clicks - a.clicks || b.views - a.views);

  // Tool details: the top answers for each event and field (e.g. Finder → priority → "cashback").
  const detail = new Map<string, { k: string; values: { v: string; n: number }[] }[]>();
  for (const r of details) {
    const name = String(r.name);
    const fields = detail.get(name) ?? [];
    let field = fields.find((f) => f.k === r.k);
    if (!field) fields.push((field = { k: String(r.k), values: [] }));
    if (field.values.length < 8) field.values.push({ v: String(r.v), n: Number(r.n) });
    detail.set(name, fields);
  }

  // Every day of the range, including days with nothing, so the chart's spacing means time.
  const byDay = new Map(daily.map((r) => [String(r.day), r]));
  const days_: Row[] = [];
  for (let d = Date.parse(from); d <= Date.now(); d += 86_400_000) {
    const day = new Date(d).toISOString().slice(0, 10);
    days_.push(byDay.get(day) ?? { day, views: 0, visitors: 0, visits: 0, clicks: 0 });
  }

  return {
    from,
    totals: {
      views: Number(totals?.views ?? 0),
      visitors: Number(totals?.visitors ?? 0),
      visits: Number(totals?.visits ?? 0),
      clicks: Number(totals?.clicks ?? 0),
      clickers: Number(totals?.clickers ?? 0)
    },
    daily: days_,
    cards,
    byPlace: byPlace.map((r) => ({ place: placeLabel(r.place as string | null), clicks: Number(r.clicks) })),
    clickCountries,
    pages,
    sources,
    refs,
    countries,
    devices,
    tools: tools.map((t) => ({ name: String(t.name), label: EVENT_LABELS[String(t.name)] ?? String(t.name), n: Number(t.n), people: Number(t.people), fields: detail.get(String(t.name)) ?? [] })),
    broken
  };
}

export type Report = Awaited<ReturnType<typeof report>>;
