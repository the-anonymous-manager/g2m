'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Market } from '@/lib/types';
import { REGION_COOKIE, countryToMarket, isMarket, marketFromTimezone } from '@/lib/regions';
import { track } from '@/lib/analytics';

const STORE_KEY = 'g2m-region';

type RegionState = {
  /** The viewer's market, or null when we could not tell (or they chose "All regions"). */
  market: Market | null;
  /** True once we have looked at the cookie, storage and timezone. */
  ready: boolean;
  setMarket: (m: Market | null) => void;
};

const RegionCtx = createContext<RegionState>({ market: null, ready: false, setMarket: () => {} });

function readCookie(name: string): string | null {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.split('=')[1] ?? '') : null;
}

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [market, setMarketState] = useState<Market | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let found: Market | null = null;
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved === 'ALL') found = null;
      else if (isMarket(saved)) found = saved;
      else {
        // 1. Country from the host's geo header (set by middleware). A country outside our five
        // markets means "all regions", not a guess. 2. Browser timezone, only when there is no header
        // (a VPN changes the country but not the computer's clock).
        const cc = readCookie(REGION_COOKIE);
        found = cc ? countryToMarket(cc) : marketFromTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
      }
    } catch {
      found = marketFromTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
    setMarketState(found);
    setReady(true);
  }, []);

  const setMarket = useCallback((m: Market | null) => {
    setMarketState(m);
    try {
      localStorage.setItem(STORE_KEY, m ?? 'ALL');
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
    track('Region', { market: m ?? 'ALL' });
  }, []);

  return <RegionCtx.Provider value={{ market, ready, setMarket }}>{children}</RegionCtx.Provider>;
}

export const useRegion = () => useContext(RegionCtx);
