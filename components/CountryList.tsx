'use client';

import { useMemo, useState } from 'react';
import { COUNTRY_NAMES } from '@/lib/countries.mjs';
import { REGIONS, REGION_OF } from '@/lib/continents.mjs';
import { MarketBadge } from '@/components/bits';
import { useRegion } from '@/components/RegionContext';
import type { Availability } from '@/lib/types';

type Props = {
  cardName: string;
  /** Every country code with this card's answer for it. */
  status: Record<string, Availability>;
  /** True when the issuer publishes a full list, so countries not on it are "no" rather than "not confirmed". */
  complete: boolean;
};

const byName = (a: string, b: string) => (COUNTRY_NAMES[a] ?? a).localeCompare(COUNTRY_NAMES[b] ?? b);

/** Codes grouped by world region, regions in display order, countries A to Z. */
function grouped(codes: string[]) {
  return REGIONS.map((region) => ({ region, codes: codes.filter((c) => REGION_OF[c] === region).sort(byName) })).filter(
    (g) => g.codes.length
  );
}

// Every country a card works in, by region, with a quick check for one country.
export function CountryList({ cardName, status, complete }: Props) {
  const { country: mine } = useRegion();
  const [query, setQuery] = useState('');
  const all = useMemo(() => Object.keys(status), [status]);
  const yes = useMemo(() => all.filter((c) => status[c] === 'yes'), [all, status]);
  const no = useMemo(() => all.filter((c) => status[c] === 'no'), [all, status]);
  const unknown = all.length - yes.length - no.length;

  const q = query.trim().toLowerCase();
  const matches = q
    ? all.filter((c) => (COUNTRY_NAMES[c] ?? '').toLowerCase().includes(q) || c.toLowerCase() === q).sort(byName).slice(0, 12)
    : [];

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="country-summary">
        {yes.length ? <span className="badge badge-yes">{yes.length} available</span> : null}
        {no.length ? <span className="badge badge-no">{no.length} not available</span> : null}
        {unknown ? <span className="badge badge-unknown">{unknown} not confirmed</span> : null}
        {mine && status[mine] ? (
          <span className="country-mine">
            Where you are, {COUNTRY_NAMES[mine]}: <MarketBadge value={status[mine]} where={COUNTRY_NAMES[mine]} />
          </span>
        ) : null}
      </div>

      <div className="field" style={{ maxWidth: 420 }}>
        <label className="field-label" htmlFor="country-check">
          Check a country
        </label>
        <input
          id="country-check"
          className="input"
          type="search"
          placeholder="Type a country, e.g. Japan"
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
                <span>{COUNTRY_NAMES[c]}</span>
                <MarketBadge value={status[c]} where={COUNTRY_NAMES[c]} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted" aria-live="polite" style={{ margin: 0 }}>
            No country matches “{query}”.
          </p>
        )
      ) : null}

      {yes.length ? (
        <div className="stack" style={{ gap: 18 }}>
          <h3 className="country-heading">
            Available in {yes.length} {yes.length === 1 ? 'country' : 'countries'}
          </h3>
          {grouped(yes).map((g) => (
            <div key={g.region} className="country-group">
              <h4>
                {g.region} <span className="faint">{g.codes.length}</span>
              </h4>
              <ul className="country-cols">
                {g.codes.map((c) => (
                  <li key={c} className={c === mine ? 'is-mine' : undefined}>
                    {COUNTRY_NAMES[c]}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {cardName} has not confirmed any country yet.
        </p>
      )}

      {no.length ? (
        <details className="country-more">
          <summary>
            Not available in {no.length} {no.length === 1 ? 'country' : 'countries'}
          </summary>
          <ul className="country-cols country-cols-muted">
            {[...no].sort(byName).map((c) => (
              <li key={c}>{COUNTRY_NAMES[c]}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="faint" style={{ fontSize: 13, margin: 0 }}>
        {complete
          ? `From ${cardName}'s own country list. Countries it does not list are marked not available.`
          : unknown
            ? `${cardName} has not published a full country list, so the other ${unknown} countries are not confirmed either way. Check with the issuer before you apply.`
            : `From ${cardName}'s own country list.`}
      </p>
    </div>
  );
}
