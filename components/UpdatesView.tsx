import Link from 'next/link';
import type { ReactNode } from 'react';
import { getCard } from '@/lib/cards';
import { fmtDate } from '@/lib/format';
import { bodyBlocks, getUpdates, hasEnded, intlUpdate, intlUpdates, isTranslated, updatePath, UPDATES_PATH, type Update } from '@/lib/updates';
import { fill, intlCard, type Locale } from '@/lib/i18n/locales';
import { en, type Dict } from '@/lib/i18n/dict/en';
import { DICTS } from '@/lib/i18n/dict';
import { note } from '@/lib/i18n/notes';
import { CardArt } from '@/components/CardArt';
import { Eyebrow, ScorePill } from '@/components/bits';
import { OutboundLink } from '@/components/OutboundLink';
import { IntlText } from '@/components/IntlText';

// The Updates page and each post's page, in English (no locale) and in the other languages. The post text comes
// from the sheet's Updates tab (lib/updates.ts) and is translated in data/i18n like other sheet text; untranslated
// text shows in English, marked as English. Every "Get the card" button goes through /go/<card> (the referral link).

type Ctx = {
  locale?: Locale;
  d: Dict;
  /** Sheet text in the page's language (or English, marked). */
  tx: (english: string) => ReactNode;
  date: (iso: string) => string;
  /** Where a post opens: its own page in this language when translated, else the English one. */
  href: (u: Update) => string;
  cardHref: (slug: string) => string;
  list: string;
};

function ctx(locale?: Locale): Ctx {
  if (!locale)
    return {
      d: en,
      tx: (s) => s,
      date: fmtDate,
      href: (u) => updatePath(u.slug),
      cardHref: (slug) => `/cards/${slug}`,
      list: UPDATES_PATH
    };
  const d = DICTS[locale.code];
  const dateF = new Intl.DateTimeFormat(locale.tag, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return {
    locale,
    d,
    tx: (s) => <IntlText note={note(locale, s)} label={d.inEnglish} />,
    date: (iso) => dateF.format(new Date(`${iso}T00:00:00Z`)),
    href: (u) => (isTranslated(u, locale) ? intlUpdate(locale, u.slug) : updatePath(u.slug)),
    cardHref: (slug) => intlCard(locale, slug),
    list: intlUpdates(locale)
  };
}

const kindWord = (d: Dict, u: Update) => (u.type === 'offer' ? d.updOffer : u.type === 'bonus' ? d.updBonus : d.updNews);

/** Type, date, end date and the Sponsored mark above a post's title. */
function Meta({ u, c }: { u: Update; c: Ctx }) {
  const ended = hasEnded(u);
  return (
    <div className="update-meta">
      <span className={`badge ${u.type === 'news' ? 'badge-unknown' : 'badge-accent'}`}>{kindWord(c.d, u)}</span>
      <time dateTime={u.date}>{c.date(u.date)}</time>
      {u.ends ? (
        <span className={`badge ${ended ? 'badge-no' : 'badge-warn'}`}>{fill(ended ? c.d.updEnded : c.d.updEnds, { date: c.date(u.ends) })}</span>
      ) : null}
      {u.sponsored ? <span className="badge badge-unknown">{c.d.updSponsored.split(/[.。]/)[0]}</span> : null}
    </div>
  );
}

/** The card a post is about, with its "Get the card" button (referral link) and the review link. */
function CardBox({ slug, c, placement }: { slug: string; c: Ctx; placement: string }) {
  const card = getCard(slug);
  if (!card) return null;
  const bonus = card.links.affiliate ? card.signupBonus : undefined;
  const code = card.links.affiliate ? card.referralCode : undefined;
  return (
    <div className="panel panel-pad ref-hero">
      <Link href={c.cardHref(card.slug)} className="ref-hero-art" aria-label={card.name}>
        <CardArt card={card} width={200} />
      </Link>
      <div className="stack" style={{ gap: 12, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <b style={{ fontSize: 18 }}>
            <bdi>{card.name}</bdi>
          </b>
          <ScorePill value={card.score.total} label={c.d.score} />
        </div>
        {bonus ? (
          <p className="muted" style={{ margin: 0 }}>
            <b style={{ color: 'var(--accent)' }}>{c.d.bonus}:</b> {c.tx(bonus)}
          </p>
        ) : null}
        {code ? (
          <p style={{ margin: 0 }}>
            {c.d.referralCode}:{' '}
            <code className="mono">
              <bdi>{code}</bdi>
            </code>
          </p>
        ) : null}
        <div className="pick-actions">
          <OutboundLink slug={card.slug} name={card.name} placement={placement} className="btn btn-metal">
            {c.d.getCard}
          </OutboundLink>
          <Link href={c.cardHref(card.slug)} className="btn">
            {c.locale ? c.d.details : 'Read the review'}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** One post in the list: its meta line, title, summary, the card it is about and its buttons. */
function Item({ u, c }: { u: Update; c: Ctx }) {
  const card = u.card ? getCard(u.card) : undefined;
  const english = c.locale && !isTranslated(u, c.locale);
  const placement = c.locale ? `intl-${c.locale.code}-updates` : 'updates';
  return (
    <article className="panel panel-pad update-item">
      {card ? (
        <Link href={c.cardHref(card.slug)} className="update-art" aria-label={card.name} tabIndex={-1}>
          <CardArt card={card} size="sm" />
        </Link>
      ) : null}
      <div className="stack" style={{ gap: 8, minWidth: 0 }}>
        <Meta u={u} c={c} />
        <h2 className="h3" style={{ margin: 0 }}>
          <Link href={c.href(u)} style={{ textDecoration: 'none' }} hrefLang={english ? 'en' : undefined}>
            {c.tx(u.title)}
          </Link>
          {english ? (
            <span className="faint" style={{ fontSize: 13, fontWeight: 500, marginInlineStart: 8 }}>
              ({c.d.updEnglishOnly})
            </span>
          ) : null}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {c.tx(u.summary)}
        </p>
        <div className="pick-actions">
          {u.body ? (
            <Link href={c.href(u)} className="btn btn-sm">
              {c.d.updReadMore}
            </Link>
          ) : null}
          {card && !hasEnded(u) ? (
            <OutboundLink slug={card.slug} name={card.name} placement={placement} className="btn btn-sm btn-metal">
              {c.d.getCard}
            </OutboundLink>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** /updates (and /de/updates …): every post, newest first. */
export function UpdatesList({ locale }: { locale?: Locale }) {
  const c = ctx(locale);
  const posts = getUpdates();
  return (
    <div className="wrap section stack" style={{ gap: 28, maxWidth: 900 }}>
      <div className="stack" style={{ gap: 12 }}>
        <Eyebrow>{c.d.updEyebrow}</Eyebrow>
        <h1 className="h2">{c.d.updTitle}</h1>
        <p className="lead">{c.d.updLead}</p>
      </div>
      {posts.length ? (
        <div className="stack" style={{ gap: 14 }}>
          {posts.map((u) => (
            <Item key={u.slug} u={u} c={c} />
          ))}
        </div>
      ) : (
        <p className="panel panel-pad muted" style={{ margin: 0 }}>
          {c.d.updEmpty}
        </p>
      )}
    </div>
  );
}

/** One post's page: the full text, the card it is about with its referral link, the source and more posts. */
export function UpdateArticle({ u, locale, jsonLd }: { u: Update; locale?: Locale; jsonLd: object[] }) {
  const c = ctx(locale);
  const blocks = bodyBlocks(u.body);
  const others = getUpdates()
    .filter((o) => o.slug !== u.slug)
    .slice(0, 4);
  return (
    <article className="wrap section stack" style={{ gap: 28, maxWidth: 860 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="stack" style={{ gap: 12 }}>
        <nav aria-label="Breadcrumb" className="faint" style={{ fontSize: 14 }}>
          <Link href={c.list} style={{ textDecoration: 'none' }}>
            {c.d.updAll}
          </Link>
        </nav>
        <Meta u={u} c={c} />
        <h1 className="h2">{c.tx(u.title)}</h1>
        <p className="lead">{c.tx(u.summary)}</p>
      </div>

      {blocks.length ? (
        <div className="prose">
          {blocks.map((b, i) =>
            b.kind === 'p' ? (
              <p key={i} style={{ margin: 0 }}>
                {c.tx(b.text)}
              </p>
            ) : (
              <ul key={i}>
                {b.items.map((t, j) => (
                  <li key={j}>{c.tx(t)}</li>
                ))}
              </ul>
            )
          )}
        </div>
      ) : null}

      {u.card ? <CardBox slug={u.card} c={c} placement={c.locale ? `intl-${c.locale.code}-update` : `update-${u.slug}`.slice(0, 60)} /> : null}

      {u.source || u.sponsored ? (
        <div className="stack" style={{ gap: 6 }}>
          {u.source ? (
            <p className="faint" style={{ margin: 0, fontSize: 14 }}>
              {c.d.updSource}:{' '}
              <a href={u.source} target="_blank" rel="noopener nofollow" style={{ wordBreak: 'break-all' }}>
                {u.source.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            </p>
          ) : null}
          {u.sponsored ? (
            <p className="faint" style={{ margin: 0, fontSize: 14 }}>
              {c.d.updSponsored}
            </p>
          ) : null}
        </div>
      ) : null}

      {others.length ? (
        <section aria-labelledby="more-updates" className="stack" style={{ gap: 12 }}>
          <h2 id="more-updates" className="h3">
            {c.d.updMore}
          </h2>
          <ul className="guide-links" style={{ columns: 1 }}>
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={c.href(o)}>{c.tx(o.title)}</Link> <span className="faint">· {c.date(o.date)}</span>
              </li>
            ))}
          </ul>
          <p style={{ margin: 0 }}>
            <Link href={c.list}>{c.d.updAll}</Link>
          </p>
        </section>
      ) : null}
    </article>
  );
}
