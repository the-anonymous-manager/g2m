import { ImageResponse } from 'next/og';
import { getCard } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { swipeReceipt } from '@/lib/swipe';
import { fiatPerUsd } from '@/lib/prices';
import { parseReceiptParams } from '@/lib/receipt-params';
import { OG_SIZE, OgLogo, ROSE, ogFontsRuntime } from '@/lib/og';
import { site } from '@/lib/site';

// The shareable receipt picture: the swipe line by line, the real result, G2M's X handle on one side and the site on
// the other. Wide (1200 x 630) for link previews; tall (1080 x 1350, `size=tall`) for "Download image", because X
// crops wide pictures to near-squares when a post has more than one.
const TALL = { width: 1080, height: 1350 };

function fmt(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export async function GET(req: Request) {
  const search = new URL(req.url).searchParams;
  const p = parseReceiptParams(Object.fromEntries(search));
  const tall = search.get('size') === 'tall';
  const size = tall ? TALL : OG_SIZE;
  const card = p.card ? getCard(p.card) : null;
  const fonts = await ogFontsRuntime();
  const handle = site.twitter.startsWith('@') ? site.twitter : `@${site.twitter}`;
  const domain = site.url.replace(/^https?:\/\//, '');

  if (!card) {
    return new ImageResponse(<div style={{ display: 'flex', width: '100%', height: '100%', background: '#0a0a0c' }} />, size);
  }
  const row = toRow(card);
  const tier = row.tiers[Math.min(p.tier, row.tiers.length - 1)];
  const perUsd = (await fiatPerUsd()) ?? {};
  const cur = p.cur === 'USD' || perUsd[p.cur] ? p.cur : 'USD';
  const show = p.show && (p.show === 'USD' || perUsd[p.show]) ? p.show : cur;
  const r = swipeReceipt(row, tier, p.amt, cur, perUsd, { base: p.base, display: show, homeCurrency: p.home, cleared: p.cleared, total: p.total, rate: p.rate });
  const good = r.net >= 0;
  const color = good ? '#6fd39c' : '#f08a80';
  if (tall) return tallReceipt({ card, tier, r, p, cur, show, handle, domain, fonts });

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0c', color: '#f7f5f0', fontFamily: 'Inter' }}>
        <div style={{ display: 'flex', height: 8, backgroundImage: ROSE }} />
        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: tall ? 'column' : 'row',
            padding: tall ? '56px 64px 32px' : '40px 56px 24px',
            gap: tall ? 44 : 48,
            alignItems: tall ? 'stretch' : 'center',
            justifyContent: 'center'
          }}
        >
          {/* The receipt */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              ...(tall ? {} : { width: 560 }),
              padding: tall ? '36px 40px' : '28px 32px',
              borderRadius: 22,
              background: '#f7f5f0',
              color: '#1a1714',
              border: '3px solid #c9806b'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: tall ? 22 : 18, letterSpacing: 2, color: '#9a5340', textTransform: 'uppercase' }}>
              <span>[ swipe receipt ]</span>
              <span>{card.name.length > 22 ? `${card.name.slice(0, 21)}…` : card.name}</span>
            </div>
            <div style={{ display: 'flex', fontSize: tall ? 22 : 18, color: '#6b625a', marginTop: 8, marginBottom: 14 }}>
              {p.what} · {tier.name} · {r.base} card · paid in {cur}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: '2px dashed #cdbfb3', paddingTop: 12, gap: 8 }}>
              {r.lines.slice(0, 7).flatMap((l) => [
                <div key={l.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: tall ? 26 : 21, color: l.kind === 'fee' ? '#a3322a' : l.kind === 'reward' ? '#1f6b45' : '#1a1714' }}>
                  <span style={{ display: 'flex', maxWidth: tall ? 640 : 360 }}>
                    {l.kind === 'fee' ? '+ ' : l.kind === 'reward' ? '− ' : ''}
                    {l.label.length <= 34 ? l.label : l.label.replace(/\s*\(.*\)$/, '')}
                  </span>
                  <span>{fmt(l.amount, show)}</span>
                </div>,
                // Card apps show price + FX as one "cleared" amount.
                ...(l.key === 'fx'
                  ? [
                      <div key="cleared" style={{ display: 'flex', justifyContent: 'space-between', fontSize: tall ? 21 : 17, color: '#6b625a', marginTop: -4 }}>
                        <span>= Cleared (price + FX)</span>
                        <span>{fmt(r.cleared, show)}</span>
                      </div>
                    ]
                  : [])
              ])}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: '2px dashed #cdbfb3', marginTop: 14, paddingTop: 12, gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: tall ? 28 : 22, fontWeight: 700 }}>
                <span>Paid at the till</span>
                <span>{fmt(r.totalPaid, show)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: tall ? 28 : 22, fontWeight: 700 }}>
                <span>Real cost after cashback</span>
                <span>{fmt(r.totalPaid - r.cashback, show)}</span>
              </div>
            </div>
          </div>

          {/* The verdict */}
          <div style={{ display: 'flex', flexDirection: 'column', ...(tall ? {} : { flex: 1 }), justifyContent: 'center', gap: 14 }}>
            <div style={{ display: 'flex', fontSize: 26, color: '#b8ada3' }}>
              {r.headlinePct != null ? `Advertised: up to ${r.headlinePct}% back` : 'Advertised rewards'}
            </div>
            <div style={{ display: 'flex', fontSize: tall ? 150 : 120, fontWeight: 800, letterSpacing: -4, color, lineHeight: 1 }}>
              {good ? '+' : '−'}
              {Math.abs(r.netPct).toFixed(2)}%
            </div>
            <div style={{ display: 'flex', fontSize: tall ? 38 : 30, fontWeight: 700 }}>
              {good ? `You keep ${fmt(r.net, show)}` : `Costs you ${fmt(-r.net, show)} more`}
            </div>
            <div style={{ display: 'flex', fontSize: 22, color: '#b8ada3' }}>
              after every fee on a {fmt(p.amt, cur)} {p.what.toLowerCase()}
            </div>
          </div>
        </div>

        {/* Footer: our X handle on one side, the site on the other */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            // Tall: room under the footer, since X trims the top and bottom in a post with two pictures.
            padding: tall ? '22px 64px 84px' : '18px 56px 26px',
            borderTop: '1px solid #2a2622',
            fontSize: 26
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="26" height="26" viewBox="0 0 24 24">
              <path fill="#f7f5f0" d="M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.9-6.4L6.3 22H3.2l7.3-8.3L1 2h6.3l4.4 5.9L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z" />
            </svg>
            <span>{handle}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <OgLogo size={40} />
            <span style={{ fontWeight: 700 }}>{domain}/receipt</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' }
    }
  );
}

type Tall = {
  card: { name: string };
  tier: { name: string };
  r: ReturnType<typeof swipeReceipt>;
  p: ReturnType<typeof parseReceiptParams>;
  cur: string;
  show: string;
  handle: string;
  domain: string;
  fonts: Awaited<ReturnType<typeof ogFontsRuntime>>;
};

const INK = '#1a1714';
const MUTED = '#6b625a';
const FEE = '#a3322a';
const GAIN = '#1f6b45';
const RULE = '2px dashed #cdbfb3';
const pctText = (n: number) => `${n.toFixed(2)}%`;

/**
 * "Download image" (1080 x 1350): the same receipt as on the page, line by line with each fee's and the cashback's
 * full description, the totals, the result, the advertised rate and how it was matched, plus the fees and cashback as
 * a share of the price and the date (Akash, 25 Nov 2026: "the one we show on the website is really good, need the same
 * with added details").
 */
function tallReceipt({ card, tier, r, p, cur, show, handle, domain, fonts }: Tall) {
  const good = r.net >= 0;
  const price = r.lines[0]?.amount ?? p.amt;
  const fees = r.lines.filter((l) => l.kind === 'fee').reduce((s, l) => s + l.amount, 0);
  const today = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
  const notes = [
    r.headlinePct != null ? `Advertised: up to ${r.headlinePct}% back` : null,
    r.mode !== 'live' ? `Matched to your app${r.impliedRate ? ` · 1 ${r.base} = ${fmt(r.impliedRate, cur)} before FX` : ''}` : r.foreign ? 'Live mid-market rate; your card\'s rate on the day can differ by a few cents' : null,
    ...r.notes
  ].filter(Boolean) as string[];
  const line = (key: string, label: string, amount: string, color: string, size = 29, bold = false) => (
    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, fontSize: size, color, fontWeight: bold ? 700 : 400 }}>
      <span style={{ display: 'flex', flex: 1, lineHeight: 1.3 }}>{label}</span>
      <span style={{ display: 'flex', lineHeight: 1.3 }}>{amount}</span>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0c', color: '#f7f5f0', fontFamily: 'Inter' }}>
        <div style={{ display: 'flex', height: 8, backgroundImage: ROSE }} />
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', padding: '40px 44px 24px' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '40px 44px',
              borderRadius: 26,
              background: '#f7f5f0',
              color: INK,
              border: '3px solid #c9806b',
              gap: 14
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 23, letterSpacing: 3, color: '#9a5340', textTransform: 'uppercase' }}>
              <span>[ swipe receipt ]</span>
              <span>{card.name.length > 26 ? `${card.name.slice(0, 25)}…` : card.name}</span>
            </div>
            <div style={{ display: 'flex', fontSize: 24, color: MUTED }}>
              {p.what} · {tier.name} · {r.base} card · paid in {cur} · {today}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: RULE, paddingTop: 16, gap: 12 }}>
              {r.lines.flatMap((l) => [
                line(
                  l.key,
                  `${l.kind === 'fee' ? '+ ' : l.kind === 'reward' ? '− ' : ''}${l.label}`,
                  fmt(l.amount, show),
                  l.kind === 'fee' ? FEE : l.kind === 'reward' ? GAIN : INK
                ),
                ...(l.key === 'fx' ? [line('cleared', '= Cleared (price + FX)', fmt(r.cleared, show), MUTED, 24)] : [])
              ])}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: RULE, paddingTop: 16, gap: 10 }}>
              {line('paid', 'Paid at the till', fmt(r.totalPaid, show), INK, 31, true)}
              {line('real', 'Real cost after cashback', fmt(r.totalPaid - r.cashback, show), INK, 31, true)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: RULE, paddingTop: 16, gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: good ? GAIN : FEE }}>
                <span style={{ display: 'flex', fontSize: 112, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>
                  {good ? '+' : '−'}
                  {Math.abs(r.netPct).toFixed(2)}%
                </span>
                <span style={{ display: 'flex', fontSize: 34, fontWeight: 700 }}>{good ? `You keep ${fmt(r.net, show)}` : `Costs you ${fmt(-r.net, show)} more`}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 28, rowGap: 6, fontSize: 24, color: MUTED }}>
                <span>Fees {fmt(fees, show)} ({pctText(price > 0 ? (fees / price) * 100 : 0)} of the price)</span>
                <span>Cashback {fmt(r.cashback, show)} ({pctText(price > 0 ? (r.cashback / price) * 100 : 0)})</span>
              </div>
              {notes.map((n, i) => (
                <div key={i} style={{ display: 'flex', fontSize: 22, color: MUTED, lineHeight: 1.35 }}>
                  {n}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 64px 84px', borderTop: '1px solid #2a2622', fontSize: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="26" height="26" viewBox="0 0 24 24">
              <path fill="#f7f5f0" d="M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.9-6.4L6.3 22H3.2l7.3-8.3L1 2h6.3l4.4 5.9L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z" />
            </svg>
            <span>{handle}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <OgLogo size={40} />
            <span style={{ fontWeight: 700 }}>{domain}/receipt</span>
          </div>
        </div>
      </div>
    ),
    { ...TALL, fonts, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } }
  );
}
