import type { Availability, CardData, Market, Tier } from '@/lib/types';
import { COUNTRY_NAMES, EEA, isCountry } from '@/lib/countries.mjs';

export { isCountry };

export const MARKET_LABELS: Record<Market, string> = {
  IN: 'India',
  AE: 'UAE',
  US: 'United States',
  GB: 'United Kingdom',
  EU: 'EU / EEA'
};

export const MARKET_FLAGS: Record<Market, string> = { IN: 'IN', AE: 'AE', US: 'US', GB: 'UK', EU: 'EU' };

const EEA_SET = new Set(EEA);

/** Every country, sorted by name, for pickers. */
export const COUNTRIES: { code: string; name: string }[] = Object.entries(COUNTRY_NAMES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const countryName = (code: string): string => COUNTRY_NAMES[code] ?? code;

/** Map an ISO country code (e.g. from the hosting provider's geo header) to a G2M market. */
export function countryToMarket(code: string | null | undefined): Market | null {
  if (!code) return null;
  const cc = code.trim().toUpperCase();
  if (cc === 'IN' || cc === 'AE' || cc === 'US' || cc === 'GB') return cc;
  if (cc === 'UK') return 'GB';
  if (EEA_SET.has(cc)) return 'EU';
  return null;
}

// Browser-side fallback when no geo header is available (local dev, other hosts).
const TZ_COUNTRY: Record<string, string> = {
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Dubai': 'AE', 'Europe/London': 'GB', 'Asia/Tokyo': 'JP',
  'Asia/Singapore': 'SG', 'Asia/Hong_Kong': 'HK', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN', 'Asia/Bangkok': 'TH',
  'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH', 'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD', 'Asia/Riyadh': 'SA',
  'Asia/Kuala_Lumpur': 'MY', 'Asia/Ho_Chi_Minh': 'VN', 'Europe/Istanbul': 'TR', 'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Lisbon': 'PT',
  'Europe/Dublin': 'IE', 'Europe/Zurich': 'CH', 'Europe/Warsaw': 'PL', 'Europe/Stockholm': 'SE', 'Africa/Lagos': 'NG',
  'Africa/Nairobi': 'KE', 'Africa/Johannesburg': 'ZA', 'Africa/Cairo': 'EG', 'America/Toronto': 'CA',
  'America/Vancouver': 'CA', 'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX', 'America/Bogota': 'CO',
  'America/Argentina/Buenos_Aires': 'AR', 'America/Buenos_Aires': 'AR', 'America/Lima': 'PE', 'America/Santiago': 'CL',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Phoenix': 'US',
  'America/Los_Angeles': 'US', 'America/Anchorage': 'US', 'Pacific/Honolulu': 'US', 'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU', 'Pacific/Auckland': 'NZ'
};

export function countryFromTimezone(tz: string | undefined): string | null {
  return (tz && TZ_COUNTRY[tz]) || null;
}

export const isMarket = (v: unknown): v is Market =>
  v === 'IN' || v === 'AE' || v === 'US' || v === 'GB' || v === 'EU';

export const REGION_COOKIE = 'g2m_cc';

/**
 * Can someone living in `cc` get this card? The issuer's country list decides when it can (a listed
 * country, or a complete list's rule for everyone else). Otherwise the five checked markets answer
 * (an EU answer covers every EEA country), and failing that it is not confirmed.
 */
export function availabilityIn(card: Pick<CardData, 'coverage'>, cc: string): Availability {
  const list = card.coverage.countryList;
  if (list) {
    if (list.yes.includes(cc)) return 'yes';
    if (list.no.includes(cc)) return 'no';
    if (!list.unclear.includes(cc) && list.others !== 'unknown') return list.others;
  }
  const market = countryToMarket(cc);
  return market ? card.coverage.markets[market] : 'unknown';
}

const placeMatches = (places: string[] | undefined, cc: string) =>
  Boolean(places?.some((p) => p === cc || (p === 'EEA' && EEA_SET.has(cc))));

/** Is this tier offered to residents of `cc`? Tiers without country rules are offered everywhere. */
export function tierOffered(tier: Pick<Tier, 'countries' | 'exceptCountries'>, cc: string): boolean {
  if (tier.countries && !placeMatches(tier.countries, cc)) return false;
  return !placeMatches(tier.exceptCountries, cc);
}
