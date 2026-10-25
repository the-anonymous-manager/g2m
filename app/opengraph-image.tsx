import { ImageResponse } from 'next/og';
import { getCards } from '@/lib/cards';
import { METAL_BG, OG_SIZE, OgLogo, ROSE, ogFontsRuntime } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'G2M · Spend your bags better. The crypto card directory.';
// A metadata route doesn't inherit its page's segment config, so this needs its own force-dynamic: rendered fresh
// on every request rather than prerendered, matching app/page.tsx.
export const dynamic = 'force-dynamic';

export default async function Image() {
  const n = getCards().length;
  const stack = [
    { metal: 'silver', rotate: -14, top: 70, left: 10 },
    { metal: 'black', rotate: -5, top: 160, left: 60 },
    { metal: 'rose', rotate: 5, top: 250, left: 110 }
  ];
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0a0a0c', color: '#edede8', padding: '64px 72px', fontFamily: 'Inter' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <OgLogo size={64} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 34, fontWeight: 800, color: '#f0b5a0' }}>G2M</span>
              <span style={{ fontSize: 14, letterSpacing: 6, color: '#e8a68f' }}>GWEI 2 MERCHANT</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 84, fontWeight: 800, lineHeight: 1 }}>Spend your</span>
            <span style={{ fontSize: 84, fontWeight: 800, lineHeight: 1, backgroundImage: ROSE, backgroundClip: 'text', color: 'transparent' }}>
              bags better.
            </span>
            <span style={{ fontSize: 28, color: '#a3a29b', marginTop: 16 }}>
              {n} crypto cards ranked. From on-chain to checkout.
            </span>
          </div>
          <span style={{ fontSize: 22, color: '#8f8e87' }}>g2m.life</span>
        </div>
        <div style={{ display: 'flex', position: 'relative', width: 430 }}>
          {stack.map((c) => (
            <div
              key={c.metal}
              style={{
                position: 'absolute',
                top: c.top,
                left: c.left,
                width: 320,
                height: 202,
                borderRadius: 20,
                backgroundImage: METAL_BG[c.metal],
                transform: `rotate(${c.rotate}deg)`,
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                display: 'flex'
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: await ogFontsRuntime() }
  );
}
