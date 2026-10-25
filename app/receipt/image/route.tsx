import { ImageResponse } from 'next/og';
import { getCard } from '@/lib/cards';
import { toRow } from '@/lib/types';
import { swipeReceipt } from '@/lib/swipe';
import { fiatPerUsd } from '@/lib/prices';
import { parseReceiptParams } from '@/lib/receipt-params';
import { OG_SIZE, OgLogo, ROSE, ogFonts } from '@/lib/og';
import { site } from '@/lib/site';

// The shareable receipt picture (1200 x 630): the swipe line by line, the real result, G2M's X handle on one side and
// the site on the other. Used as the share preview of /receipt links and for "Download image".

function fmt(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export async function GET(req: Request) {
  const p = parseReceiptParams(Object.fromEntries(new URL(req.url).searchParams));
  const card = p.card ? getCard(p.card) : null;
  const fonts = await ogFonts();
  const handle = site.twitter.startsWith('@') ? site.twitter : `@${site.twitter}`;
  const domain = site.url.replace(/^https?:\/\//, '');

  if (!card) {
    return new ImageResponse(<div style={{ display: 'flex', width: '100%', height: '100%', background: '#0a0a0c' }} />, OG_SIZE);
  }
  const row = toRow(card);
  const tier = row.tiers[Math.min(p.tier, row.tiers.length - 1)];
  const perUsd = (await fiatPerUsd()) ?? {};
  const cur = p.cur === 'USD' || perUsd[p.cur] ? p.cur : 'USD';
  const show = p.show && (p.show === 'USD' || perUsd[p.show]) ? p.show : cur;
  const r = swipeReceipt(row, tier, p.amt, cur, perUsd, { base: p.base, display: show, homeCurrency: p.home, cleared: p.cleared, total: p.total, rate: p.rate });
  const good = r.net >= 0;
  const color = good ? '#6fd39c' : '#f08a80';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0c', color: '#f7f5f0', fontFamily: 'Inter' }}>
        <div style={{ display: 'flex', height: 8, backgroundImage: ROSE }} />
        <div style={{ display: 'flex', flex: 1, padding: '40px 56px 24px', gap: 48, alignItems: 'center' }}>
          {/* The receipt */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: 560,
              padding: '28px 32px',
              borderRadius: 22,
              background: '#f7f5f0',
              color: '#1a1714',
              border: '3px solid #c9806b'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, letterSpacing: 2, color: '#9a5340', textTransform: 'uppercase' }}>
              <span>[ swipe receipt ]</span>
              <span>{card.name.length > 22 ? `${card.name.slice(0, 21)}…` : card.name}</span>
            </div>
            <div style={{ display: 'flex', fontSize: 18, color: '#6b625a', marginTop: 8, marginBottom: 14 }}>
              {p.what} · {tier.name} · {r.base} card · paid in {cur}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: '2px dashed #cdbfb3', paddingTop: 12, gap: 8 }}>
              {r.lines.slice(0, 7).flatMap((l) => [
                <div key={l.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 21, color: l.kind === 'fee' ? '#a3322a' : l.kind === 'reward' ? '#1f6b45' : '#1a1714' }}>
                  <span style={{ display: 'flex', maxWidth: 360 }}>
                    {l.kind === 'fee' ? '+ ' : l.kind === 'reward' ? '− ' : ''}
                    {l.label.replace(/\s*\(.*\)$/, '')}
                  </span>
                  <span>{fmt(l.amount, show)}</span>
                </div>,
                // Card apps show price + FX as one "cleared" amount.
                ...(l.key === 'fx'
                  ? [
                      <div key="cleared" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, color: '#6b625a', marginTop: -4 }}>
                        <span>= Cleared (price + FX)</span>
                        <span>{fmt(r.cleared, show)}</span>
                      </div>
                    ]
                  : [])
              ])}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: '2px dashed #cdbfb3', marginTop: 14, paddingTop: 12, gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 700 }}>
                <span>Paid at the till</span>
                <span>{fmt(r.totalPaid, show)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 700 }}>
                <span>Real cost after cashback</span>
                <span>{fmt(r.totalPaid - r.cashback, show)}</span>
              </div>
            </div>
          </div>

          {/* The verdict */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 14 }}>
            <div style={{ display: 'flex', fontSize: 26, color: '#b8ada3' }}>
              {r.headlinePct != null ? `Advertised: up to ${r.headlinePct}% back` : 'Advertised rewards'}
            </div>
            <div style={{ display: 'flex', fontSize: 120, fontWeight: 800, letterSpacing: -4, color, lineHeight: 1 }}>
              {good ? '+' : '−'}
              {Math.abs(r.netPct).toFixed(2)}%
            </div>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>
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
            padding: '18px 56px 26px',
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
      ...OG_SIZE,
      fonts,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' }
    }
  );
}
