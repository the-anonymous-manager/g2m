import { NextResponse, type NextRequest } from 'next/server';
import { MONTHS, SPOTS, saveBooking, senderCode, type BookingInput, type Spot } from '@/lib/bookings';
import { isBot } from '@/lib/stats/server';
import { getCards } from '@/lib/cards';

// Receives the "Book a spot" form under "Our picks" (components/BookSpotForm.tsx) and stores it for /stats.

const text = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: NextRequest) {
  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'bad' }, 400);
  }
  // A field people never see: forms filled in by bots fill it in.
  if (text(raw.website, 10) || isBot(req.headers.get('user-agent') ?? '')) return json({ ok: true });

  const slugs = new Set(getCards().map((c) => c.slug));
  const cardSlug = text(raw.card, 60);
  const listed = slugs.has(cardSlug);
  const card = listed ? cardSlug : text(raw.cardName, 80);
  const spot = (SPOTS as readonly string[]).includes(String(raw.spot)) ? (raw.spot as Spot) : 'any';
  const budgetUsd = Math.round(Number(raw.budget));
  const months = Number(raw.months);
  const start = /^\d{4}-\d{2}$/.test(String(raw.start)) ? String(raw.start) : '';
  const email = text(raw.email, 120);
  // "@name", "t.me/name" or "name" all become "name".
  const telegram = text(raw.telegram, 80).replace(/^(?:https?:\/\/)?(?:t\.me\/|telegram\.me\/)?@?/i, '');

  const b: BookingInput = {
    card,
    listed,
    spot,
    budgetUsd,
    months: (MONTHS as readonly number[]).includes(months) ? months : 1,
    start,
    company: text(raw.company, 100),
    name: text(raw.name, 80),
    email,
    telegram,
    note: typeof raw.note === 'string' ? raw.note.trim().slice(0, 1500) : '',
    lang: text(raw.lang, 8) || 'en'
  };
  const okEmail = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const okTelegram = !telegram || /^[A-Za-z0-9_]{5,32}$/.test(telegram);
  if (!b.card || !b.company || !(email || telegram) || !okEmail || !okTelegram || !Number.isFinite(budgetUsd) || budgetUsd < 1 || budgetUsd > 10_000_000) {
    return json({ ok: false, error: 'invalid' }, 400);
  }

  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  try {
    const result = await saveBooking(b, await senderCode(ip));
    if (result === 'saved') return json({ ok: true });
    if (result === 'limit') return json({ ok: false, error: 'limit' }, 429);
    return json({ ok: false, error: 'offline' }, 503);
  } catch (e) {
    console.error('booking: could not save', e);
    return json({ ok: false, error: 'offline' }, 503);
  }
}
