import type { Market } from '@/lib/types';

export const MARKET_LABELS: Record<Market, string> = {
  IN: 'India',
  AE: 'UAE',
  US: 'United States',
  GB: 'United Kingdom',
  EU: 'EU / EEA'
};

export const MARKET_FLAGS: Record<Market, string> = { IN: 'IN', AE: 'AE', US: 'US', GB: 'UK', EU: 'EU' };

const EEA = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO'
]);

/** Map an ISO country code (e.g. from the hosting provider's geo header) to a G2M market. */
export function countryToMarket(code: string | null | undefined): Market | null {
  if (!code) return null;
  const cc = code.trim().toUpperCase();
  if (cc === 'IN' || cc === 'AE' || cc === 'US' || cc === 'GB') return cc;
  if (cc === 'UK') return 'GB';
  if (EEA.has(cc)) return 'EU';
  return null;
}

/** Browser-side fallback when no geo header is available. */
export function marketFromTimezone(tz: string | undefined): Market | null {
  if (!tz) return null;
  if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'IN';
  if (tz === 'Asia/Dubai') return 'AE';
  if (tz === 'Europe/London') return 'GB';
  if (tz.startsWith('America/') && !/Sao_Paulo|Argentina|Mexico|Bogota|Lima|Santiago|Caracas/.test(tz)) return 'US';
  if (tz.startsWith('Europe/')) return 'EU';
  return null;
}

export const isMarket = (v: unknown): v is Market =>
  v === 'IN' || v === 'AE' || v === 'US' || v === 'GB' || v === 'EU';

export const REGION_COOKIE = 'g2m_cc';
