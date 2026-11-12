'use client';

import { useMemo, useState } from 'react';
import { COUNTRY_NAMES } from '@/lib/countries.mjs';
import { REGIONS, REGION_OF } from '@/lib/continents.mjs';
import { MarketBadge } from '@/components/bits';
import { useRegion } from '@/components/RegionContext';
import type { Availability } from '@/lib/types';
import type { Ui } from '@/lib/i18n/ui/en';

const fillT = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k) => String(v[k] ?? m));

type Props = {
  cardName: string;
  /** Every country code with this card's answer for it. */
  status: Record<string, Availability>;
  /** True when the issuer publishes a full list, so countries not on it are "no" rather than "not confirmed". */
  complete: boolean;
  /** Another language: its card words, common words, BCP 47 tag and country names from the server. */
  words?: Ui['card'];
  common?: Ui['common'];
  tag?: string;
  countryNames?: Record<string, string>;
};

/** Codes grouped by world region, regions in display order, countries A to Z. */
function grouped(codes: string[], byName: (a: string, b: string) => number) {
  return REGIONS.map((region) => ({ region, codes: codes.filter((c) => REGION_OF[c] === region).sort(byName) })).filter(
    (g) => g.codes.length
  );
}

// Every country a card works in, by region, with a quick check for one country.
export function CountryList({ cardName, status, complete, words, common, tag, countryNames }: Props) {
  const name = (c: string) => countryNames?.[c] ?? COUNTRY_NAMES[c] ?? c;
  const byName = (a: string, b: string) => (tag ? name(a).localeCompare(name(b), tag) : name(a).localeCompare(name(b)));
  const w = words;
  const { country: mine } = useRegion();
  const [query, setQuery] = useState('');
  const all = useMemo(() => Object.keys(status), [status]);
  const yes = useMemo(() => all.filter((c) => status[c] === 'yes'), [all, status]);
  const no = useMemo(() => all.filter((c) => status[c] === 'no'), [all, status]);
  const unknown = all.length - yes.length - no.length;

  const q = query.trim().toLowerCase();
  const matches = q
    ? all
        .filter((c) => name(c).toLowerCase().includes(q) || (COUNTRY_NAMES[c] ?? '').toLowerCase().includes(q) || c.toLowerCase() === q)
        .sort(byName)
        .slice(0, 12)
    : [];

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="country-summary">
        {yes.length ? <span className="badge badge-yes">{w ? fillT(w.nAvailable, { n: yes.length }) : `${yes.length} available`}</span> : null}
        {no.length ? <span className="badge badge-no">{w ? fillT(w.nNotAvailable, { n: no.length }) : `${no.length} not available`}</span> : null}
        {unknown ? <span className="badge badge-unknown">{w ? fillT(w.nNotConfirmed, { n: unknown }) : `${unknown} not confirmed`}</span> : null}
        {mine && status[mine] ? (
          <span className="country-mine">
            {w ? fillT(w.whereYouAre, { place: name(mine) }) : `Where you are, ${COUNTRY_NAMES[mine]}:`}{' '}
            <MarketBadge value={status[mine]} where={name(mine)} words={common} />
          </span>
        ) : null}
      </div>

      <div className="field" style={{ maxWidth: 420 }}>
        <label className="field-label" htmlFor="country-check">
          {w?.checkACountry ?? 'Check a country'}
        </label>
        <input
          id="country-check"
          className="input"
          type="search"
          placeholder={w?.countryPlaceholder ?? 'Type a country, e.g. Japan'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>
      {q ? (
        matches.length ? (
          <ul className="list-plain country-matches" aria-live="polite">
            {matches.map((c) => (
              <li key={c}>
                <span>{name(c)}</span>
                <MarketBadge value={status[c]} where={name(c)} words={common} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted" aria-live="polite" style={{ margin: 0 }}>
            {w ? fillT(w.noMatch, { q: query }) : `No country matches “${query}”.`}
          </p>
        )
      ) : null}

      {yes.length ? (
        <div className="stack" style={{ gap: 18 }}>
          <h3 className="country-heading">
            {w ? fillT(w.availableInN, { n: yes.length }) : `Available in ${yes.length} ${yes.length === 1 ? 'country' : 'countries'}`}
          </h3>
          {grouped(yes, byName).map((g) => (
            <div key={g.region} className="country-group">
              <h4>
                {w?.regionNames[g.region] ?? g.region} <span className="faint">{g.codes.length}</span>
              </h4>
              <ul className="country-cols">
                {g.codes.map((c) => (
                  <li key={c} className={c === mine ? 'is-mine' : undefined}>
                    {name(c)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {w ? fillT(w.noneConfirmedYet, { name: cardName }) : `${cardName} has not confirmed any country yet.`}
        </p>
      )}

      {no.length ? (
        <details className="country-more">
          <summary>
            {w ? fillT(w.notAvailableInN, { n: no.length }) : `Not available in ${no.length} ${no.length === 1 ? 'country' : 'countries'}`}
          </summary>
          <ul className="country-cols country-cols-muted">
            {[...no].sort(byName).map((c) => (
              <li key={c}>{name(c)}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="faint" style={{ fontSize: 13, margin: 0 }}>
        {w
          ? complete
            ? fillT(w.fromListComplete, { name: cardName })
            : unknown
              ? fillT(w.noFullList, { name: cardName, n: unknown })
              : fillT(w.fromList, { name: cardName })
          : complete
            ? `From ${cardName}'s own country list. Countries it does not list are marked not available.`
            : unknown
              ? `${cardName} has not published a full country list, so the other ${unknown} countries are not confirmed either way. Check with the issuer before you apply.`
              : `From ${cardName}'s own country list.`}
      </p>
    </div>
  );
}
