import { ImageResponse } from 'next/og';
import { getCard, getCards, getRank } from '@/lib/cards';
import { cashbackLabel, pct, usd } from '@/lib/format';
import { METAL_BG, OG_SIZE, OgLogo, ROSE, ogFonts } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'G2M card score';

export function generateStaticParams() {
  return getCards().map((c) => ({ slug: c.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = getCard(slug);
  const total = getCards().length;
  if (!card) {
    return new ImageResponse(<div style={{ display: 'flex', width: '100%', height: '100%', background: '#0a0a0c' }} />, size);
  }
  const darkCard = card.metal === 'black' || card.metal === 'gunmetal';
  const facts = [
    { k: 'Cashback', v: cashbackLabel(card.cashback.basePct, card.cashback.maxPct) },
    { k: 'Annual fee', v: usd(card.fees.annualUsd) },
    { k: 'FX fee', v: pct(card.fees.fxPct) }
  ];
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#0a0a0c',
          color: '#edede8',
          padding: '56px 64px',
          fontFamily: 'Inter'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <OgLogo size={56} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: '#f0b5a0' }}>G2M</span>
              <span style={{ fontSize: 13, letterSpacing: 5, color: '#e8a68f' }}>GWEI 2 MERCHANT</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span style={{ fontSize: 22, color: '#e8a68f', letterSpacing: 2 }}>
              #{getRank(card.slug)} OF {total} CRYPTO CARDS
            </span>
            <span style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05, maxWidth: 640 }}>{card.name}</span>
            <div style={{ display: 'flex', gap: 28, marginTop: 10 }}>
              {facts.map((f) => (
                <div key={f.k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 18, color: '#8f8e87' }}>{f.k}</span>
                  <span style={{ fontSize: 28, fontWeight: 700 }}>{f.v}</span>
                </div>
              ))}
            </div>
          </div>
          <span style={{ fontSize: 20, color: '#8f8e87' }}>g2m.life · Spend your bags better.</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36, width: 380 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              width: 360,
              height: 227,
              borderRadius: 22,
              backgroundImage: METAL_BG[card.metal] ?? METAL_BG.black,
              padding: 26,
              transform: 'rotate(-6deg)',
              color: darkCard ? '#e6e5e0' : '#141416',
              boxShadow: '0 30px 60px rgba(0,0,0,0.6)'
            }}
          >
            <div
              style={{
                width: 56,
                height: 42,
                borderRadius: 8,
                backgroundImage: 'linear-gradient(135deg, #5e6368, #f4f6f8 40%, #8f959b 60%, #ffffff 85%)'
              }}
            />
            <span style={{ fontSize: 30, fontWeight: 800 }}>{card.brand}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 96,
                fontWeight: 800,
                backgroundImage: ROSE,
                backgroundClip: 'text',
                color: 'transparent'
              }}
            >
              {card.score.total}
            </span>
            <span style={{ fontSize: 28, color: '#8f8e87' }}>/100</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() }
  );
}
