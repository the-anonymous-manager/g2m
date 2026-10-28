// Server only.
// Live prices (CoinGecko, DefiLlama as a backup) and exchange rates, cached for an hour, so a slow or failing API never
// breaks a page: callers get null or a partial answer and say the price is unavailable.
//
// The cache is our own (memory, plus Cloudflare's edge cache when running there), not Next's fetch cache: on
// Cloudflare Workers there is no storage behind Next's cache, and requests that relied on it quietly returned nothing.

const TTL_MS = 60 * 60 * 1000;
const memory = new Map<string, { at: number; data: unknown }>();

type EdgeCache = { match(req: Request): Promise<Response | undefined>; put(req: Request, res: Response): Promise<void> };
const edgeCache = (): EdgeCache | null => {
  const c = (globalThis as { caches?: { default?: EdgeCache } }).caches;
  return c?.default ?? null;
};

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown | null> {
  const hit = memory.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const edge = edgeCache();
  const key = new Request(url);
  try {
    const cached = await edge?.match(key);
    if (cached) {
      const data = await cached.json();
      memory.set(url, { at: Date.now(), data });
      return data;
    }
  } catch {}
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
      headers: { accept: 'application/json', 'user-agent': 'g2m.life (+https://g2m.life)', ...headers }
    });
    if (!res.ok) {
      console.warn(`prices: ${new URL(url).host} answered ${res.status}`);
      return null;
    }
    const data = await res.json();
    memory.set(url, { at: Date.now(), data });
    try {
      await edge?.put(key, new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } }));
    } catch {}
    return data;
  } catch (e) {
    console.warn(`prices: ${new URL(url).host} failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

// CoinGecko demo key (free plan: 10,000 calls a month), a Cloudflare Worker secret named COINGECKO_API_KEY. Without it
// the public API is used. Either way the hourly cache keeps calls low, and DefiLlama answers when CoinGecko does not.
const geckoHeaders = (): Record<string, string> => {
  const key = process.env.COINGECKO_API_KEY;
  return key ? { 'x-cg-demo-api-key': key } : {};
};

/** USD prices for CoinGecko ids, e.g. { 'ether-fi': 0.62 }. Missing ids are left out. */
export async function usdPrices(ids: string[]): Promise<Record<string, number>> {
  const list = [...new Set(ids)].sort();
  if (!list.length) return {};
  const out: Record<string, number> = {};
  const data = (await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${list.join(',')}&vs_currencies=usd`, geckoHeaders())) as Record<
    string,
    { usd?: number }
  > | null;
  for (const id of list) {
    const usd = data?.[id]?.usd;
    if (typeof usd === 'number' && usd > 0) out[id] = usd;
  }
  // Backup: DefiLlama prices the same CoinGecko ids, for anything CoinGecko did not answer.
  const missing = list.filter((id) => !(id in out));
  if (missing.length) {
    const llama = (await getJson(`https://coins.llama.fi/prices/current/${missing.map((id) => `coingecko:${id}`).join(',')}`)) as {
      coins?: Record<string, { price?: number }>;
    } | null;
    for (const id of missing) {
      const usd = llama?.coins?.[`coingecko:${id}`]?.price;
      if (typeof usd === 'number' && usd > 0) out[id] = usd;
    }
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
  const data = (await getJson('https://api.coingecko.com/api/v3/exchange_rates', geckoHeaders())) as {
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
