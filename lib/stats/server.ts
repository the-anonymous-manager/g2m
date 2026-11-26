import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// G2M's own analytics: every page view and click is one row in a Cloudflare D1 database (binding DB in
// wrangler.jsonc), read back on the private /stats page. No cookies for visitors and no IP addresses stored:
// a visitor is a one-way code of their connection that changes every day. Devices marked "don't count"
// (the IGNORE_COOKIE, set from /stats) are never recorded. Without the DB binding (e.g. `next dev`) nothing
// is recorded and nothing breaks.

// Just the slice of the D1 API used here (no @cloudflare/workers-types dependency).
type D1Result<T> = { results: T[] };
type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
};
export type D1 = { prepare(sql: string): D1Statement; batch(statements: D1Statement[]): Promise<unknown> };

export const IGNORE_COOKIE = 'g2m_ignore';
export const STATS_COOKIE = 'g2m_stats';
/** Detailed rows are kept this long, then rolled into daily totals. */
const KEEP_DAYS = 400;

export type Hit = {
  name: string;
  path?: string | null;
  card?: string | null;
  place?: string | null;
  props?: Record<string, string | number | boolean> | null;
  ref?: string | null; // full referrer URL; only its host is stored
  utm?: string | null; // utm_source of the landing URL, if any
  landing?: boolean; // the first page of a visit: only then is "where it came from" recorded
};

function context() {
  try {
    return getCloudflareContext();
  } catch {
    return null;
  }
}

export function getDb(): D1 | null {
  const env = context()?.env as unknown as { DB?: D1 } | undefined;
  return env?.DB ?? null;
}

/** Runs work after the response is sent (Cloudflare keeps the request alive for it). */
export function afterResponse(work: Promise<unknown>) {
  const ctx = context()?.ctx as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
  if (ctx?.waitUntil) ctx.waitUntil(work);
  else void work;
}

let schema: Promise<unknown> | null = null;
function ensureSchema(db: D1) {
  schema ??= db
    .batch([
      db.prepare(
        `CREATE TABLE IF NOT EXISTS ev (ts INTEGER NOT NULL, day TEXT NOT NULL, name TEXT NOT NULL, path TEXT, card TEXT,
          place TEXT, props TEXT, source TEXT, ref TEXT, country TEXT, device TEXT, vid TEXT, mid TEXT)`
      ),
      db.prepare('CREATE INDEX IF NOT EXISTS ev_day ON ev (day, name)'),
      db.prepare('CREATE TABLE IF NOT EXISTS daily (day TEXT, metric TEXT, key TEXT, n INTEGER, PRIMARY KEY (day, metric, key))')
    ])
    // Tables made before the monthly visitor code (mid) existed get the column; "duplicate column" means it is there.
    .then(() => db.prepare('ALTER TABLE ev ADD COLUMN mid TEXT').run().catch(() => {}))
    .then(() => cleanOldClicks(db).catch(() => {}))
    .then(() => cleanScriptClicks(db).catch(() => {}))
    .catch((e) => {
      schema = null;
      throw e;
    });
  return schema;
}

/**
 * Until 10 Nov 2026 every request to /go/<card> counted as a "Get the card" click, and crawlers that open every link
 * on a page made up most of them (no page behind the click, bursts of 15 links in 20 seconds). Those old rows are
 * moved to "auto:Outbound" once, so they stop counting. Rows written since carry "v":2 and are judged when recorded.
 */
async function cleanOldClicks(db: D1) {
  const done = await db.prepare("SELECT n FROM daily WHERE day = 'meta' AND metric = 'migration' AND key = 'auto-clicks'").first();
  if (done) return;
  await db.batch([
    db.prepare(`UPDATE ev SET name = 'auto:Outbound' WHERE name = 'Outbound' AND path = 'direct' AND (props IS NULL OR props NOT LIKE '%"v":2%')`),
    db.prepare("INSERT OR REPLACE INTO daily (day, metric, key, n) VALUES ('meta', 'migration', 'auto-clicks', 1)")
  ]);
}

const PAGE_WINDOW = 48 * 3_600_000;

/**
 * From 21 Nov 2026 a script fetched "Get the card" links from thousands of home internet addresses with browser-like
 * headers (3,171 clicks in 6 days, one each, none after a page view; Akash's export, 26 Nov). A person can only press
 * a button on a page they opened, and every opened page records a page view, so a click with a spot but no page view
 * from the same visitor (same address and browser) in the 48 hours before (a page can stay open in a tab) is a script's.
 */
async function noPageBefore(db: D1, mid: string, ts: number) {
  const since = new Date(ts - PAGE_WINDOW).toISOString().slice(0, 10);
  const row = await db
    .prepare("SELECT 1 FROM ev WHERE day >= ? AND name = 'pageview' AND mid = ? AND ts >= ? LIMIT 1")
    .bind(since, mid, ts - PAGE_WINDOW)
    .first();
  return !row;
}

/** The same rule, once, for clicks recorded before it existed. */
async function cleanScriptClicks(db: D1) {
  const done = await db.prepare("SELECT n FROM daily WHERE day = 'meta' AND metric = 'migration' AND key = 'no-page-clicks'").first();
  if (done) return;
  await db.batch([
    db.prepare(
      `UPDATE ev SET name = 'auto:Outbound' WHERE name = 'Outbound' AND place IS NOT NULL AND place != 'unknown' AND NOT EXISTS (
         SELECT 1 FROM ev p WHERE p.name = 'pageview' AND (p.vid = ev.vid OR (ev.mid IS NOT NULL AND p.mid = ev.mid))
           AND p.ts >= ev.ts - ${PAGE_WINDOW} AND p.ts <= ev.ts + 60000)`
    ),
    db.prepare("INSERT OR REPLACE INTO daily (day, metric, key, n) VALUES ('meta', 'migration', 'no-page-clicks', 1)")
  ]);
}

// Networks of hosting companies: real people browse from home, office and mobile networks, crawlers from these.
// Left out on purpose: Cloudflare, Fastly and Akamai Technologies (Apple's Private Relay and WARP leave through them)
// and the networks most consumer VPNs rent (M247, Datacamp), so VPN users still count.
const HOSTING =
  /amazon|\baws\b|google cloud|google llc|microsoft|digitalocean|\bovh\b|hetzner|linode|akamai connected|vultr|choopa|constant company|alibaba|tencent|oracle|contabo|scaleway|online s\.a\.s|huawei cloud|\bionos\b|hostinger|kamatera|upcloud/i;

/**
 * True when a hit does not look like a person using a browser: it comes from a hosting network, or it lacks the
 * headers every current browser adds (Sec-Fetch-*), or, for a "Get the card" link, nothing shows a person pressed it
 * (not on a G2M page and not a link they opened themselves). Such hits are kept as "auto:<event>", outside every count.
 */
export function isAutomated(req: Request, click: boolean) {
  const org = String((context()?.cf as { asOrganization?: unknown } | undefined)?.asOrganization ?? '');
  if (org && HOSTING.test(org)) return true;
  const fetchSite = req.headers.get('sec-fetch-site');
  if (!fetchSite) return true;
  if (!click) return false;
  return !(fetchSite === 'same-origin' || req.headers.get('sec-fetch-user') === '?1');
}

// Crawlers, link previews (X, WhatsApp, Telegram, Slack...), uptime checkers and scripts.
const BOT =
  /bot\b|bot\/|crawl|spider|scrapy|slurp|preview|headless|lighthouse|pagespeed|python|curl|wget|httpclient|okhttp|axios|node-fetch|go-http|java\/|facebookexternalhit|whatsapp|telegram|discord|slack|embedly|vercel|uptime|monitor|scan/i;

export function isBot(ua: string) {
  return !ua || BOT.test(ua);
}

export function deviceOf(ua: string) {
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return 'phone';
  return 'computer';
}

const SOURCES: [RegExp, string][] = [
  [/(^|\.)google\./, 'Google'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/duckduckgo\.com$/, 'DuckDuckGo'],
  [/search\.brave\.com$/, 'Brave Search'],
  [/(^|\.)(yahoo|yandex|baidu|ecosia|naver)\./, 'Other search'],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, 'X'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'LinkedIn'],
  [/(^|\.)reddit\.com$/, 'Reddit'],
  [/(^|\.)(facebook\.com|fb\.com|instagram\.com|threads\.net)$/, 'Meta'],
  [/(^|\.)(t\.me|telegram\.org)$/, 'Telegram'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com)$/, 'AI chat']
];

/** Where a visit came from: the campaign tag if the link had one, else the referring site, else Direct. */
export function sourceOf(refHost: string | null, utm: string | null) {
  if (utm) {
    const host = utm.toLowerCase().replace(/^www\./, '');
    for (const [re, label] of SOURCES) if (re.test(host)) return label;
    return `Campaign: ${utm.slice(0, 40)}`;
  }
  if (!refHost) return 'Direct';
  for (const [re, label] of SOURCES) if (re.test(refHost)) return label;
  return refHost;
}

export function refHostOf(ref: string | null | undefined, ownHost: string) {
  if (!ref) return null;
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '');
    return host === ownHost.replace(/^www\./, '') ? null : host.slice(0, 80);
  } catch {
    return null;
  }
}

async function sha(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const salt = () => process.env.ANALYTICS_SALT || process.env.STATS_PASSWORD || 'g2m';

/**
 * Anonymous visitor codes; neither can be turned back into an IP. `vid`: same person, same day (changes at midnight
 * UTC), for visitors per day. `mid`: same person, same calendar month, for unique visitors over a range.
 */
const visitorOf = (period: string, ip: string, ua: string) => sha(`${period}|${ip}|${ua}|${salt()}`).then((h) => h.slice(0, 16));

/** Login cookie value: a hash of the password, never the password itself. */
export const statsToken = (password: string) => sha(`stats|${password}|g2m`);

export async function isStatsUser(cookieValue: string | undefined) {
  const pw = process.env.STATS_PASSWORD;
  return Boolean(pw && cookieValue && cookieValue === (await statsToken(pw)));
}

const clip = (v: string | null | undefined, n: number) => (v ? String(v).slice(0, n) : null);

/** Records one hit for this request. Skips bots and devices marked "don't count". Never throws. */
export async function record(req: Request, hit: Hit) {
  try {
    const db = getDb();
    if (!db) return;
    const ua = req.headers.get('user-agent') ?? '';
    if (isBot(ua)) return;
    if ((req.headers.get('cookie') ?? '').includes(`${IGNORE_COOKIE}=1`)) return;
    await ensureSchema(db);
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    const country = (req.headers.get('cf-ipcountry') ?? '').toUpperCase();
    const ownHost = new URL(req.url).hostname;
    const refHost = refHostOf(hit.ref, ownHost);
    // A visit "comes from" somewhere only on its first page, and not when the referrer is this site itself.
    const sameSite = !refHost && Boolean(hit.ref) && hit.ref!.includes(ownHost);
    const source = hit.landing && !sameSite ? sourceOf(refHost, clip(hit.utm, 40)) : null;
    const mid = await visitorOf(day.slice(0, 7), ip, ua);
    let name = `${isAutomated(req, hit.name === 'Outbound') ? 'auto:' : ''}${hit.name}`;
    // A "Get the card" button press needs a page with the button: no page view from this visitor in the 2 days before
    // means a script fetched the link (see noPageBefore). Links opened on their own (no spot, e.g. one shared on X) are exempt.
    if (name === 'Outbound' && hit.place && hit.place !== 'unknown' && (await noPageBefore(db, mid, now.getTime()))) name = 'auto:Outbound';
    await db
      .prepare('INSERT INTO ev (ts, day, name, path, card, place, props, source, ref, country, device, vid, mid) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(
        now.getTime(),
        day,
        name.slice(0, 40),
        clip(hit.path, 200),
        clip(hit.card, 60),
        clip(hit.place, 60),
        hit.props && Object.keys(hit.props).length ? JSON.stringify(hit.props).slice(0, 600) : null,
        source,
        refHost,
        /^[A-Z]{2}$/.test(country) && country !== 'XX' ? country : null,
        deviceOf(ua),
        await visitorOf(day, ip, ua),
        mid
      )
      .run();
    if (Math.random() < 0.005) await tidy(db, day);
  } catch (e) {
    console.error('analytics: could not record', e);
  }
}

/** Rolls rows older than KEEP_DAYS into daily totals (views, visitors, clicks per card), then deletes them. */
async function tidy(db: D1, today: string) {
  const cutoff = new Date(Date.parse(today) - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
  await db.batch([
    db
      .prepare("INSERT OR REPLACE INTO daily SELECT day, 'views', '', COUNT(*) FROM ev WHERE name = 'pageview' AND day < ? GROUP BY day")
      .bind(cutoff),
    db
      .prepare(
        "INSERT OR REPLACE INTO daily SELECT day, 'visitors', '', COUNT(DISTINCT vid) FROM ev WHERE name = 'pageview' AND day < ? GROUP BY day"
      )
      .bind(cutoff),
    db
      .prepare(
        "INSERT OR REPLACE INTO daily SELECT day, 'clicks', card, COUNT(*) FROM ev WHERE name = 'Outbound' AND day < ? GROUP BY day, card"
      )
      .bind(cutoff),
    db.prepare('DELETE FROM ev WHERE day < ?').bind(cutoff)
  ]);
}

/** Stats queries need the tables even before the first hit. */
export async function readyDb() {
  const db = getDb();
  if (db) await ensureSchema(db);
  return db;
}
