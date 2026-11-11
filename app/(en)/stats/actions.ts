'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { IGNORE_COOKIE, STATS_COOKIE, statsToken } from '@/lib/stats/server';

const YEAR = 400 * 24 * 3600; // browsers keep a cookie at most ~400 days

/** Logging in also marks this device "don't count": only the owner logs in. */
export async function login(form: FormData) {
  const pw = process.env.STATS_PASSWORD;
  const given = String(form.get('password') ?? '');
  if (!pw || given !== pw) {
    await new Promise((r) => setTimeout(r, 800)); // slows down guessing
    redirect('/stats?wrong=1');
  }
  const jar = await cookies();
  jar.set(STATS_COOKIE, await statsToken(pw), { path: '/stats', httpOnly: true, secure: true, sameSite: 'strict', maxAge: 30 * 24 * 3600 });
  jar.set(IGNORE_COOKIE, '1', { path: '/', secure: true, sameSite: 'lax', maxAge: YEAR });
  redirect('/stats');
}

export async function logout() {
  (await cookies()).delete({ name: STATS_COOKIE, path: '/stats' });
  redirect('/stats');
}

/** The "Don't count this device" switch (works logged in or out, so any device can be excluded). */
export async function setCounted(form: FormData) {
  const jar = await cookies();
  if (form.get('count') === '1') jar.delete({ name: IGNORE_COOKIE, path: '/' });
  else jar.set(IGNORE_COOKIE, '1', { path: '/', secure: true, sameSite: 'lax', maxAge: YEAR });
  redirect(`/stats${form.get('r') ? `?r=${form.get('r')}` : ''}`);
}
