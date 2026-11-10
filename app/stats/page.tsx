import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { countryName } from '@/lib/regions';
import { IGNORE_COOKIE, STATS_COOKIE, isStatsUser, readyDb } from '@/lib/stats/server';
import { RANGES, rangeDays, report, type Report } from '@/lib/stats/report';
import { login, logout, setCounted } from './actions';

// The private stats page: G2M's own analytics (lib/stats). Locked with STATS_PASSWORD (a Cloudflare Worker secret).
export const metadata: Metadata = { title: 'Stats', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const n = (v: unknown) => Number(v ?? 0).toLocaleString('en-US');
const country = (cc: unknown) => (cc ? `${countryName(String(cc))} (${cc})` : 'Unknown');

/** A table with a bar behind the main number, so the biggest rows stand out. */
function BarTable({ head, rows, empty = 'Nothing yet.' }: { head: string[]; rows: (string | number | React.ReactNode)[][]; empty?: string }) {
  if (!rows.length) return <p className="faint" style={{ fontSize: 14 }}>{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => Number(r[1]) || 0));
  return (
    <div className="table-wrap">
      <table className="table st-table">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" style={i ? { textAlign: 'right' } : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>
                <span className="st-bar" style={{ width: `${((Number(r[1]) || 0) / max) * 100}%` }} aria-hidden="true" />
                <span className="st-label">{r[0]}</span>
              </td>
              {r.slice(1).map((c, j) => (
                <td key={j} className="num" style={{ textAlign: 'right' }}>
                  {typeof c === 'number' ? n(c) : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="stack" style={{ gap: 12 }}>
      <div>
        <h2 className="h3">{title}</h2>
        {note ? <p className="faint" style={{ fontSize: 14, marginTop: 4 }}>{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Long ranges are shown week by week (one bar per 7 days), so the chart still fits a phone screen. */
function byWeek(rows: Report['daily']): Report['daily'] {
  const out: Report['daily'] = [];
  for (let i = 0; i < rows.length; i += 7) {
    const week = rows.slice(i, i + 7);
    const sum = (k: string) => week.reduce((n, r) => n + Number(r[k] ?? 0), 0);
    out.push({ day: `Week of ${week[0].day}`, views: sum('views'), visitors: sum('visitors'), visits: sum('visits'), clicks: sum('clicks') });
  }
  return out;
}

function Daily({ rows: days }: { rows: Report['daily'] }) {
  if (!days.length) return <p className="faint" style={{ fontSize: 14 }}>Nothing yet.</p>;
  const rows = days.length > 100 ? byWeek(days) : days;
  // One scale for both, so a day with more clicks than visitors stays inside the chart.
  const max = Math.max(1, ...rows.flatMap((r) => [Number(r.visitors), Number(r.clicks)]));
  return (
    <div className="st-days" role="img" aria-label={days.length > 100 ? 'Visitors per week' : 'Visitors per day'}>
      {rows.map((r) => (
        <div key={String(r.day)} className="st-day" title={`${r.day}: ${n(r.visits)} visits, ${n(r.visitors)} ${days.length > 100 ? 'visitors (each day counted)' : 'unique visitors'}, ${n(r.views)} page views, ${n(r.clicks)} clicks`}>
          <span style={{ height: `${(Number(r.visitors) / max) * 100}%` }} />
          {Number(r.clicks) ? <b style={{ height: `${(Number(r.clicks) / max) * 100}%` }} /> : null}
        </div>
      ))}
    </div>
  );
}

function Dashboard({ data, days, counted }: { data: Report; days: number; counted: boolean }) {
  const t = data.totals;
  return (
    <>
      <div className="stats">
        <div className="stat">
          <b>{n(t.visits)}</b>
          <span className="faint">total visits</span>
        </div>
        <div className="stat">
          <b>{n(t.visitors)}</b>
          <span className="faint">unique visitors</span>
        </div>
        <div className="stat">
          <b>{n(t.views)}</b>
          <span className="faint">page views</span>
        </div>
        <div className="stat">
          <b>{n(t.clicks)}</b>
          <span className="faint">&ldquo;Get the card&rdquo; clicks</span>
        </div>
        <div className="stat">
          <b>{n(t.clickers)}</b>
          <span className="faint">
            people who clicked{t.visitors ? ` (${Math.round((t.clickers / t.visitors) * 1000) / 10}% of visitors)` : ''}
          </span>
        </div>
      </div>
      <p className="faint" style={{ fontSize: 14, marginTop: -16 }}>
        Total visits: every time someone comes to the site, so a person who comes back three times counts three times.
        Unique visitors: each person once, however many times they come back (an anonymous code, no cookies, renewed each
        calendar month, so someone who returns next month counts again). Clicks are counted on G2M&apos;s server, so ad
        blockers can&apos;t hide them, while visits are counted in the browser, where some ad blockers hide them.
      </p>

      <Section title="Day by day" note={
          data.daily.length > 100
            ? 'One bar per week. Light bars: visitors. Dark marks inside: Get the card clicks. Hover or tap a week for its numbers.'
            : 'Light bars: unique visitors that day. Dark marks inside: Get the card clicks. Hover or tap a day for its numbers.'
        }>
        <Daily rows={data.daily} />
      </Section>

      <Section
        title="Get the card, per card"
        note="Clicks: every press of a Get the card button for that card, anywhere on the site. From its page: presses on the card's own page. Click rate: people who read the card page and pressed its button, out of everyone who read it (people, so someone clicking twice counts once)."
      >
        <BarTable
          head={['Card', 'Clicks', 'From its page', 'Sponsored', 'People', 'Page views', 'Click rate']}
          rows={data.cards.map((c) => [
            <>
              <Link href={`/cards/${c.slug}`}>{c.name}</Link>
              {c.referral ? <span className="badge badge-accent st-tag">referral</span> : null}
            </>,
            c.clicks,
            c.fromPage,
            c.sponsored,
            c.people,
            c.views,
            c.rate == null ? '–' : `${n(c.fromPagePeople)} of ${n(c.visitors)} (${c.rate}%)`
          ])}
        />
      </Section>

      <div className="grid-2">
        <Section title="Where the clicks happen">
          <BarTable head={['Spot on the site', 'Clicks']} rows={data.byPlace.map((r) => [r.place, r.clicks])} />
        </Section>
        <Section title="Clicks by country">
          <BarTable head={['Country', 'Clicks']} rows={data.clickCountries.map((r) => [country(r.country), Number(r.clicks)])} />
        </Section>
      </div>

      <Section title="Top pages">
        <BarTable
          head={['Page', 'Views', 'Visitors']}
          rows={data.pages.map((r) => [<Link key={String(r.path)} href={String(r.path)}>{String(r.path)}</Link>, Number(r.views), Number(r.visitors)])}
        />
      </Section>

      <div className="grid-2">
        <Section title="Where visitors come from" note="Counted on the first page of each visit.">
          <BarTable head={['Source', 'Visits', 'Visitors']} rows={data.sources.map((r) => [String(r.source), Number(r.visits), Number(r.visitors)])} />
        </Section>
        <Section title="Referring websites">
          <BarTable head={['Website', 'Visits']} rows={data.refs.map((r) => [String(r.ref), Number(r.visits)])} />
        </Section>
      </div>

      <div className="grid-2">
        <Section title="Countries">
          <BarTable head={['Country', 'Visitors', 'Views']} rows={data.countries.map((r) => [country(r.country), Number(r.visitors), Number(r.views)])} />
        </Section>
        <Section title="Devices">
          <BarTable head={['Device', 'Visitors']} rows={data.devices.map((r) => [String(r.device), Number(r.visitors)])} />
        </Section>
      </div>

      <Section title="How people use the tools" note="Each tool, then its most common choices.">
        <BarTable head={['Tool', 'Times', 'People']} rows={data.tools.map((x) => [x.label, x.n, x.people])} />
        <div className="grid-2">
          {data.tools
            .filter((x) => x.fields.length)
            .map((x) => (
              <div key={x.name} className="panel panel-pad stack" style={{ gap: 10 }}>
                <h3 className="field-label">{x.label}</h3>
                {x.fields.map((f) => (
                  <div key={f.k} style={{ fontSize: 14 }}>
                    <span className="mono faint">{f.k}: </span>
                    {f.values.map((v, i) => (
                      <span key={v.v}>
                        {i ? ', ' : ''}
                        {v.v} <span className="faint">({n(v.n)})</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
        </div>
      </Section>

      <Section title="Broken pages (404)" note="Addresses people tried that don't exist, and where the link was.">
        <BarTable
          head={['Address', 'Times', 'Linked from']}
          rows={data.broken.map((r) => [String(r.path), Number(r.n), r.ref ? String(r.ref) : '–'])}
          empty="None. Good."
        />
      </Section>

      <Section title="Download">
        <div className="chip-row">
          <a className="btn btn-sm" href={`/stats/export?r=${days}&kind=cards`}>
            Cards summary (CSV)
          </a>
          <a className="btn btn-sm" href={`/stats/export?r=${days}&kind=events`}>
            Every event (CSV)
          </a>
        </div>
        <p className="faint" style={{ fontSize: 14 }}>
          Opens in Google Sheets or Excel. The cards summary is the one to show a sponsor. This device is {counted ? 'counted' : 'not counted'}.
        </p>
      </Section>
    </>
  );
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ r?: string; wrong?: string }> }) {
  const sp = await searchParams;
  const jar = await cookies();
  const counted = jar.get(IGNORE_COOKIE)?.value !== '1';

  if (!process.env.STATS_PASSWORD) {
    return (
      <div className="wrap section stack" style={{ gap: 16, maxWidth: 640 }}>
        <h1 className="h2">Stats</h1>
        <p className="notice">
          Set a password first: in Cloudflare, Workers &amp; Pages → g2m → Settings → Variables and Secrets → Add, type Secret, name
          STATS_PASSWORD.
        </p>
      </div>
    );
  }

  if (!(await isStatsUser(jar.get(STATS_COOKIE)?.value))) {
    return (
      <div className="wrap section stack" style={{ gap: 16, maxWidth: 420 }}>
        <h1 className="h2">Stats</h1>
        <p className="muted">Private. Logging in on a device also stops your own visits on it from being counted.</p>
        <form action={login} className="stack" style={{ gap: 12 }}>
          <label className="field">
            <span className="field-label">Password</span>
            <input className="input" type="password" name="password" autoComplete="current-password" required autoFocus />
          </label>
          {sp.wrong ? <p className="badge badge-no" style={{ alignSelf: 'flex-start' }}>Wrong password</p> : null}
          <button className="btn btn-metal" type="submit" style={{ alignSelf: 'flex-start' }}>
            Log in
          </button>
        </form>
      </div>
    );
  }

  const days = rangeDays(sp.r);
  const db = await readyDb().catch(() => null);
  const data = db ? await report(db, days).catch((e) => (console.error('stats: report failed', e), null)) : null;

  return (
    <div className="wrap section stack" style={{ gap: 32 }}>
      <div className="stack" style={{ gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <h1 className="h2">Stats</h1>
          <form action={logout}>
            <button className="btn btn-sm" type="submit">
              Log out
            </button>
          </form>
        </div>
        <nav className="chip-row" aria-label="Date range">
          {RANGES.map((x) => (
            <Link key={x.days} href={`/stats?r=${x.days}`} className="chip" aria-current={x.days === days ? 'page' : undefined}>
              {x.label}
            </Link>
          ))}
        </nav>
        <form action={setCounted} className={counted ? 'notice' : 'notice st-ok'} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="hidden" name="r" value={days} />
          <span style={{ flex: '1 1 240px' }}>
            {counted
              ? 'This device is counted. Mark it if it is yours, so your own visits stay out of the numbers.'
              : 'This device is not counted ✓ Your own visits and clicks on it never show here.'}
          </span>
          <button className="btn btn-sm" type="submit" name="count" value={counted ? '0' : '1'}>
            {counted ? "Don't count this device" : 'Count it again'}
          </button>
        </form>
        {data ? <p className="faint" style={{ fontSize: 14 }}>From {data.from} to today (dates in UTC).</p> : null}
      </div>
      {data ? (
        <Dashboard data={data} days={days} counted={counted} />
      ) : (
        <p className="notice">The stats database is not connected yet (the D1 binding &quot;DB&quot; in wrangler.jsonc).</p>
      )}
    </div>
  );
}
