'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Market } from '@/lib/types';
import { REGION_COOKIE, countryFromTimezone, countryToMarket, isCountry } from '@/lib/regions';
import { track } from '@/lib/analytics';

const STORE_KEY = 'g2m-region';

type RegionState = {
  /** The viewer's country (ISO code, e.g. "JP"), or null when we could not tell or they chose "All countries". */
  country: string | null;
  /** The same place as one of the five checked markets, for tools that only cover those. */
  market: Market | null;
  /** True once we have looked at the cookie, storage and timezone. */
  ready: boolean;
  setCountry: (cc: string | null) => void;
};

const RegionCtx = createContext<RegionState>({ country: null, market: null, ready: false, setCountry: () => {} });

function readCookie(name: string): string | null {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.split('=')[1] ?? '') : null;
}

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [country, setCountryState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fromTimezone = () => countryFromTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    let found: string | null = null;
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved === 'ALL') found = null;
      else if (isCountry(saved)) found = saved;
      else {
        // 1. Country from the host's geo header (set by middleware). 2. Browser timezone, only when
        // there is no header (a VPN changes the country but not the computer's clock).
        const cc = readCookie(REGION_COOKIE);
        found = cc ? (isCountry(cc) ? cc : null) : fromTimezone();
      }
    } catch {
      found = fromTimezone();
    }
    setCountryState(found);
    setReady(true);
  }, []);

  const setCountry = useCallback((cc: string | null) => {
    setCountryState(cc);
    try {
      localStorage.setItem(STORE_KEY, cc ?? 'ALL');
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
    track('Region', { country: cc ?? 'ALL' });
  }, []);

  return (
    <RegionCtx.Provider value={{ country, market: countryToMarket(country), ready, setCountry }}>
      {children}
    </RegionCtx.Provider>
  );
}

export const useRegion = () => useContext(RegionCtx);
