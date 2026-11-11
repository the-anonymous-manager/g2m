'use client';

import type { NomadFit } from '@/lib/nomad';
import { englishFmt, fillText, type ClientFmt } from '@/lib/i18n/clientFormat';
import { uiEn, type Ui } from '@/lib/i18n/ui/en';

type Props = {
  passport: string;
  home: string;
  myCountry?: string | null;
  onPassport: (v: string) => void;
  onHome: (v: string) => void;
  /** Label of the "no country" option for where you live (e.g. "All countries"). */
  anyHome?: string;
  idPrefix: string;
  /** Words and formats for another language (English when left out). */
  ui?: Ui;
  fmt?: ClientFmt;
};

// "My passport + Where I live": for people living outside their passport country. Cards are then filtered on the
// issuer's ID rules, not only on where they are offered.
export function NomadBar({ passport, home, myCountry, onPassport, onHome, anyHome, idPrefix, ui = uiEn, fmt = englishFmt }: Props) {
  const t = ui.nomad;
  const nomad = Boolean(passport && home && passport !== home);
  const countries = fmt.countries();
  return (
    <div className="nomad-bar" data-on={nomad ? 'true' : 'false'}>
      <div className="field">
        <label className="field-label" htmlFor={`${idPrefix}-passport`}>
          {t.passport}
        </label>
        <select id={`${idPrefix}-passport`} className="select" value={passport} onChange={(e) => onPassport(e.target.value)}>
          <option value="">{t.samePassport}</option>
          {countries.map((c) => (
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
          {t.home}
        </label>
        <select id={`${idPrefix}-home`} className="select" value={home} onChange={(e) => onHome(e.target.value)}>
          <option value="">{anyHome ?? t.allCountries}</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
              {c.code === myCountry ? ` ${t.yourLocation}` : ''}
            </option>
          ))}
        </select>
      </div>
      <p className="nomad-hint faint">
        {nomad
          ? fillText(t.hintOn, { home: fmt.country(home), passport: fmt.country(passport) })
          : passport && !home
            ? t.hintPickHome
            : t.hintOff}
      </p>
    </div>
  );
}

/** The eligibility badge for one card in nomad mode. */
export function NomadBadge({
  fit,
  passport = '',
  home = '',
  ui,
  fmt = englishFmt
}: {
  fit: NomadFit | null;
  passport?: string;
  home?: string;
  /** Another language: the badge is worded from its pack (English keeps fit.badge). */
  ui?: Ui;
  fmt?: ClientFmt;
}) {
  if (!fit) return null;
  const text = ui ? fillText(ui.nomad[fit.kind], { passport: fmt.country(passport), home: fmt.country(home) }) : fit.badge;
  return <span className={`nomad-badge nomad-${fit.tone}`}>{text}</span>;
}
