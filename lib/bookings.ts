import 'server-only';
import { getDb, type D1 } from '@/lib/stats/server';

// Requests from card issuers to book a spot in "Our picks" or the top spot (the form under the picks on the home
// page). Stored in the same D1 database as the stats (table `booking`) and listed on the private /stats page.
// A request is only a request: nothing goes live until Akash confirms and adds it to the sheet's Picks or Sponsor tab.

export const SPOTS = ['any', 'slot1', 'slot2', 'slot3', 'top'] as const;
export type Spot = (typeof SPOTS)[number];
export const SPOT_LABEL: Record<Spot, string> = {
  any: 'Any of the three picks',
  slot1: 'Pick 1',
  slot2: 'Pick 2',
  slot3: 'Pick 3',
  top: 'Top spot on the home page'
};
export const MONTHS = [1, 3, 6, 12] as const;

export type BookingInput = {
  card: string; // a listed card's slug, or the name of a card not on G2M yet
  listed: boolean;
  spot: Spot;
  budgetUsd: number; // what they want to pay a month
  months: number;
  start: string; // YYYY-MM, or '' for as soon as possible
  company: string;
  name: string;
  email: string;
  telegram: string; // username without the @ (Telegram or email, at least one)
  note: string;
  lang: string;
};

export type Booking = BookingInput & { id: number; ts: number };

let schema: Promise<unknown> | null = null;
function ensure(db: D1) {
  schema ??= db
    .prepare(
      `CREATE TABLE IF NOT EXISTS booking (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, card TEXT, listed INTEGER,
        spot TEXT, budget INTEGER, months INTEGER, start TEXT, company TEXT, name TEXT, email TEXT, telegram TEXT, note TEXT,
        lang TEXT, who TEXT)`
    )
    .run()
    .catch((e) => {
      schema = null;
      throw e;
    });
  return schema;
}

async function sha(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/** A one-way code of the sender's connection for today, only to stop one sender from flooding the list. */
export const senderCode = (ip: string) =>
  sha(`book|${new Date().toISOString().slice(0, 10)}|${ip}|${process.env.ANALYTICS_SALT || process.env.STATS_PASSWORD || 'g2m'}`);

/** Saves a request. Returns 'saved', 'limit' (5 a day from one sender) or 'offline' (no database, e.g. `next dev`). */
export async function saveBooking(b: BookingInput, who: string): Promise<'saved' | 'limit' | 'offline'> {
  const db = getDb();
  if (!db) return 'offline';
  await ensure(db);
  const since = Date.now() - 24 * 3600 * 1000;
  const recent = await db.prepare('SELECT COUNT(*) AS n FROM booking WHERE who = ? AND ts > ?').bind(who, since).first<{ n: number }>();
  if (Number(recent?.n ?? 0) >= 5) return 'limit';
  await db
    .prepare(
      'INSERT INTO booking (ts, card, listed, spot, budget, months, start, company, name, email, telegram, note, lang, who) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    )
    .bind(Date.now(), b.card, b.listed ? 1 : 0, b.spot, b.budgetUsd, b.months, b.start, b.company, b.name, b.email, b.telegram, b.note, b.lang, who)
    .run();
  return 'saved';
}

/** The latest requests, newest first, for /stats. */
export async function listBookings(db: D1, limit = 50): Promise<Booking[]> {
  await ensure(db);
  const { results } = await db
    .prepare(
      'SELECT id, ts, card, listed, spot, budget AS budgetUsd, months, start, company, name, email, telegram, note, lang FROM booking ORDER BY ts DESC LIMIT ?'
    )
    .bind(limit)
    .all<Omit<Booking, 'listed'> & { listed: number }>();
  return results.map((r) => ({ ...r, listed: Boolean(r.listed) }));
}
