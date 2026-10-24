// Server only (uses fetch caching).
// Live prices from CoinGecko, fetched on the server and cached for an hour (shared by every page), so a slow or
// failing API never breaks a page: callers get null and say the price is unavailable.

const CACHE = { next: { revalidate: 3600 } } as const;

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { ...CACHE, signal: AbortSignal.timeout(5000), headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** USD prices for CoinGecko ids, e.g. { 'ether-fi': 0.62 }. Missing ids are left out. */
export async function usdPrices(ids: string[]): Promise<Record<string, number>> {
  const list = [...new Set(ids)].sort();
  if (!list.length) return {};
  const data = (await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${list.join(',')}&vs_currencies=usd`)) as Record<
    string,
    { usd?: number }
  > | null;
  const out: Record<string, number> = {};
  for (const id of list) {
    const usd = data?.[id]?.usd;
    if (typeof usd === 'number' && usd > 0) out[id] = usd;
  }
  return out;
}

/** Fiat currencies per 1 US dollar, e.g. { EUR: 0.92, INR: 84.1 }. null when unavailable. */
export async function fiatPerUsd(): Promise<Record<string, number> | null> {
  // An exchange-rate service first, CoinGecko's BTC-based rates as a fallback.
  const er = (await getJson('https://open.er-api.com/v6/latest/USD')) as { result?: string; rates?: Record<string, number> } | null;
  if (er?.result === 'success' && er.rates?.EUR) {
    return Object.fromEntries(Object.entries(er.rates).filter(([, v]) => typeof v === 'number' && v > 0));
  }
  const data = (await getJson('https://api.coingecko.com/api/v3/exchange_rates')) as {
    rates?: Record<string, { value: number; type: string }>;
  } | null;
  const rates = data?.rates;
  const usd = rates?.usd?.value;
  if (!rates || !usd) return null;
  const out: Record<string, number> = {};
  for (const [code, r] of Object.entries(rates)) {
    if (r.type === 'fiat' && r.value > 0) out[code.toUpperCase()] = r.value / usd;
  }
  return out;
}
