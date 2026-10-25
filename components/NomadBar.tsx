'use client';

import { COUNTRIES, countryName } from '@/lib/regions';
import type { NomadFit } from '@/lib/nomad';

type Props = {
  passport: string;
  home: string;
  myCountry?: string | null;
  onPassport: (v: string) => void;
  onHome: (v: string) => void;
  /** Label of the "no country" option for where you live (e.g. "All countries"). */
  anyHome?: string;
  idPrefix: string;
};

// "My passport + Where I live": for people living outside their passport country. Cards are then filtered on the
// issuer's ID rules, not only on where they are offered.
export function NomadBar({ passport, home, myCountry, onPassport, onHome, anyHome = 'All countries', idPrefix }: Props) {
  const nomad = Boolean(passport && home && passport !== home);
  return (
    <div className="nomad-bar" data-on={nomad ? 'true' : 'false'}>
      <div className="field">
        <label className="field-label" htmlFor={`${idPrefix}-passport`}>
          My passport
        </label>
        <select id={`${idPrefix}-passport`} className="select" value={passport} onChange={(e) => onPassport(e.target.value)}>
          <option value="">Same as where I live</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <span className="nomad-plus" aria-hidden="true">
        +
      </span>
      <div className="field">
        <label className="field-label" htmlFor={`${idPrefix}-home`}>
          Where I live
        </label>
        <select id={`${idPrefix}-home`} className="select" value={home} onChange={(e) => onHome(e.target.value)}>
          <option value="">{anyHome}</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
              {c.code === myCountry ? ' (your location)' : ''}
            </option>
          ))}
        </select>
      </div>
      <p className="nomad-hint faint">
        {nomad
          ? `Showing cards offered in ${countryName(home)} that accept a passport from ${countryName(passport)}, or a residence ID from ${countryName(home)}.`
          : passport && !home
            ? 'Pick where you live too, to check ID rules.'
            : 'Living abroad? Pick your passport to see the cards whose ID checks you can pass.'}
      </p>
    </div>
  );
}

/** The eligibility badge for one card in nomad mode. */
export function NomadBadge({ fit }: { fit: NomadFit | null }) {
  if (!fit) return null;
  return <span className={`nomad-badge nomad-${fit.tone}`}>{fit.badge}</span>;
}
