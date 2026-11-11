import type { CardRow } from '@/lib/types';
import { availabilityIn, countryName } from '@/lib/regions';

// Nomad / expat mode: someone holding a passport from one country (A) and living in another (B). A card fits when it
// is offered in B, the passport is not on the issuer's blocked list, and either the issuer accepts a B residence ID
// for KYC or it supports the passport country.

export type NomadFit = {
  ok: boolean;
  /** Short badge text for the card (English). */
  badge: string;
  tone: 'ok' | 'warn' | 'no';
  /** Which badge it is, so other languages can word it (lib/i18n/ui: nomad.<kind>). */
  kind: 'citizens' | 'notOffered' | 'residency' | 'passportNo' | 'ruleNP' | 'takes' | 'needs';
};

type Nomad = Pick<CardRow, 'coverage' | 'kycRule' | 'restrictedPassports'>;

/** Null when nomad mode is off: no passport picked, no country picked, or both the same. */
export function nomadFit(card: Nomad, passport: string, home: string): NomadFit | null {
  if (!passport || !home || passport === home) return null;
  const place = countryName(home);
  if (card.restrictedPassports?.includes(passport)) {
    return { ok: false, badge: `Not open to citizens of ${countryName(passport)}`, tone: 'no', kind: 'citizens' };
  }
  if (availabilityIn(card, home) === 'no') return { ok: false, badge: `Not offered in ${place}`, tone: 'no', kind: 'notOffered' };
  if (card.kycRule === 'residency_id') return { ok: true, badge: `Eligible with ${place} residency ID`, tone: 'ok', kind: 'residency' };
  const passportOk = availabilityIn(card, passport);
  if (passportOk === 'no') {
    return { ok: false, badge: `Passports from ${countryName(passport)} not accepted`, tone: 'no', kind: 'passportNo' };
  }
  if (card.kycRule == null) return { ok: true, badge: 'Residency rule not published — check with issuer', tone: 'warn', kind: 'ruleNP' };
  return passportOk === 'yes'
    ? { ok: true, badge: `Takes passports from ${countryName(passport)}`, tone: 'ok', kind: 'takes' }
    : { ok: true, badge: `Needs a supported passport — check ${countryName(passport)} with the issuer`, tone: 'warn', kind: 'needs' };
}
