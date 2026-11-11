import 'server-only';
import { getCards } from '@/lib/cards';
import type { D1 } from '@/lib/stats/server';
import { LOCALES } from '@/lib/i18n/locales';

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
  [/^referral-(.+)$/, 'Referral code page: $1'],
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
  Search: 'Searched the rankings',
  Share: 'Shares',
  Submit: '"Submit a card" sent',
  Theme: 'Dark / light mode',
  Wallet: 'Wallet builder'
};

// The kind of page a path is, for "views by kind of page" (SQL CASE, first match wins).
const KIND = `CASE
  WHEN ${LOCALES.map((l) => `path = '/${l.code}' OR path LIKE '/${l.code}/%'`).join(' OR ')} THEN 'Other languages'
  WHEN path = '/' THEN 'Home'
  WHEN path = '/cards' THEN 'Rankings'
  WHEN path LIKE '/cards/%/alternatives' THEN 'Alternatives pages'
  WHEN path LIKE '/cards/%/referral-code' THEN 'Referral code pages'
  WHEN path LIKE '/cards/%' THEN 'Card reviews'
  WHEN path LIKE '/compare/%' THEN 'X vs Y pages'
  WHEN path LIKE '/guides/best-crypto-cards/%' THEN 'Country guides'
  WHEN path LIKE '/guides%' THEN 'Topic guides'
  WHEN path IN ('/finder', '/calculator', '/wallet', '/receipt', '/corridors', '/compare') THEN 'Tools'
  ELSE 'Other pages' END`;

/** First day of the period of the same length just before this one. */
export const previousStart = (days: number) => new Date(Date.now() - (2 * days - 1) * 86_400_000).toISOString().slice(0, 10);

// Unique visitors over a range use the monthly code (rows from before it existed fall back to the daily one).
// A person counts once per calendar month: someone who comes back next month counts again.
const U = 'COALESCE(mid, vid)';

const all = async (db: D1, sql: string, ...args: unknown[]) => (await db.prepare(sql).bind(...args).all<Row>()).results;

export async function report(db: D1, days: number) {
  const from = startDay(days);
  const names = new Map(getCards().map((c) => [c.slug, c.name]));
  const affiliate = new Set(getCards().filter((c) => c.links.affiliate).map((c) => c.slug));

  const prevFrom = previousStart(days);
  const [totals, daily, byCard, cardViews, byPlace, clickCountries, pages, sources, refs, countries, devices, tools, details, broken, before, landings, kinds, searches, langs, auto] =
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
        `SELECT name, COUNT(*) AS n, COUNT(DISTINCT ${U}) AS people FROM ev WHERE name NOT IN ('pageview', 'Outbound', '404') AND name NOT LIKE 'auto:%' AND day >= ?
           GROUP BY name ORDER BY n DESC`,
        from
      ),
      all(
        db,
        `SELECT ev.name AS name, j.key AS k, CAST(j.value AS TEXT) AS v, COUNT(DISTINCT COALESCE(ev.mid, ev.vid)) AS n FROM ev, json_each(ev.props) AS j
           WHERE ev.name NOT IN ('pageview', 'Outbound', '404', 'Search') AND ev.name NOT LIKE 'auto:%' AND ev.props IS NOT NULL AND ev.day >= ?
           GROUP BY 1, 2, 3 ORDER BY n DESC LIMIT 3000`,
        from
      ),
      all(
        db,
        `SELECT path, COUNT(*) AS n, MAX(ref) AS ref FROM ev WHERE name = '404' AND day >= ? GROUP BY path ORDER BY n DESC LIMIT 40`,
        from
      ),
      // The same totals for the period just before, to show up or down.
      db
        .prepare(
          `SELECT SUM(name = 'pageview') AS views, COUNT(DISTINCT CASE WHEN name = 'pageview' THEN ${U} END) AS visitors,
             SUM(name = 'pageview' AND source IS NOT NULL) AS visits, SUM(name = 'Outbound') AS clicks,
             COUNT(DISTINCT CASE WHEN name = 'Outbound' THEN ${U} END) AS clickers,
             (SELECT MIN(day) FROM ev) AS first FROM ev WHERE day >= ? AND day < ?`
        )
        .bind(prevFrom, from)
        .first<Row>(),
      // The page a visit starts on, and where those visits came from most.
      all(
        db,
        `SELECT path, COUNT(*) AS visits, COUNT(DISTINCT ${U}) AS visitors,
             (SELECT s.source FROM ev s WHERE s.name = 'pageview' AND s.source IS NOT NULL AND s.day >= ?1 AND s.path = ev.path
               GROUP BY s.source ORDER BY COUNT(*) DESC LIMIT 1) AS top
           FROM ev WHERE name = 'pageview' AND source IS NOT NULL AND day >= ?1 GROUP BY path ORDER BY visits DESC LIMIT 25`,
        from
      ),
      all(
        db,
        `SELECT ${KIND} AS kind, COUNT(*) AS views, COUNT(DISTINCT ${U}) AS visitors, SUM(source IS NOT NULL) AS landings,
             SUM(source IN ('Google', 'Bing', 'DuckDuckGo', 'Brave Search', 'Other search')) AS search
           FROM ev WHERE name = 'pageview' AND day >= ? GROUP BY kind ORDER BY views DESC`,
        from
      ),
      // Searches typed in the rankings, with the fewest cards found for each (0 = nothing matched).
      all(
        db,
        `SELECT json_extract(props, '$.q') AS q, COUNT(DISTINCT ${U}) AS people, MIN(json_extract(props, '$.found')) AS found
           FROM ev WHERE name = 'Search' AND day >= ? GROUP BY q ORDER BY (found > 0), people DESC, q LIMIT 40`,
        from
      ),
      // Views of the translated pages, by language (the first part of the address).
      all(
        db,
        `SELECT CASE WHEN instr(substr(path, 2), '/') > 0 THEN substr(path, 2, instr(substr(path, 2), '/') - 1) ELSE substr(path, 2) END AS lang,
             COUNT(*) AS views, COUNT(DISTINCT ${U}) AS visitors, SUM(source IS NOT NULL) AS landings
           FROM ev WHERE name = 'pageview' AND day >= ? AND (${LOCALES.map((l) => `path = '/${l.code}' OR path LIKE '/${l.code}/%'`).join(' OR ')})
           GROUP BY lang ORDER BY views DESC`,
        from
      ),
      // Hits kept out of every number above: crawlers and scripts (see isAutomated in lib/stats/server.ts).
      all(db, `SELECT name, COUNT(*) AS n FROM ev WHERE name LIKE 'auto:%' AND day >= ? GROUP BY name ORDER BY n DESC`, from)
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
    // The period just before, or null when the site has no data that far back (nothing fair to compare with).
    before:
      before?.first && String(before.first) <= prevFrom
        ? {
            views: Number(before.views ?? 0),
            visitors: Number(before.visitors ?? 0),
            visits: Number(before.visits ?? 0),
            clicks: Number(before.clicks ?? 0),
            clickers: Number(before.clickers ?? 0)
          }
        : null,
    landings: landings.map((r) => ({ path: String(r.path), visits: Number(r.visits), visitors: Number(r.visitors), top: r.top ? String(r.top) : '' })),
    kinds: kinds.map((r) => ({ kind: String(r.kind), views: Number(r.views), visitors: Number(r.visitors), landings: Number(r.landings ?? 0), search: Number(r.search ?? 0) })),
    searches: searches.map((r) => ({ q: String(r.q ?? ''), people: Number(r.people), found: Number(r.found ?? 0) })).filter((r) => r.q),
    langs: langs.map((r) => ({
      lang: LOCALES.find((l) => l.code === String(r.lang))?.name ?? String(r.lang),
      views: Number(r.views),
      visitors: Number(r.visitors),
      landings: Number(r.landings ?? 0)
    })),
    auto: auto.map((r) => ({ name: String(r.name).slice(5), n: Number(r.n) })),
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
