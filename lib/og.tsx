import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Shared pieces for the social preview images (1200×630), drawn with next/og.
export const OG_SIZE = { width: 1200, height: 630 };

export const METAL_BG: Record<string, string> = {
  rose: 'linear-gradient(135deg, #7a3f31 0%, #e8a891 25%, #b9705c 45%, #ffd9cb 60%, #c9806b 80%, #6b372a 100%)',
  gold: 'linear-gradient(135deg, #7a5a12 0%, #e9c766 22%, #b58a2a 42%, #fff1b8 58%, #c99a3a 78%, #6e4f10 100%)',
  silver: 'linear-gradient(135deg, #5e6368 0%, #d9dde1 20%, #8f959b 45%, #f7f8f9 60%, #a4aab0 80%, #4e5357 100%)',
  champagne: 'linear-gradient(135deg, #8c7a55 0%, #e7d9b5 30%, #b9a57a 50%, #f7efda 65%, #8a7650 100%)',
  black: 'linear-gradient(135deg, #0b0b0d 0%, #2a2b30 45%, #3a3b41 55%, #121316 100%)',
  gunmetal: 'linear-gradient(135deg, #22262a 0%, #5a6067 35%, #8a9097 55%, #4a5056 70%, #1c1f22 100%)'
};

export const ROSE = 'linear-gradient(100deg, #8a4a3a 0%, #f0b5a0 28%, #b9705c 48%, #ffe0d4 63%, #c9806b 82%, #7a3f31 100%)';

export function OgLogo({ size = 64 }: { size?: number }) {
  // Flat version of the Coin x Card mark (Satori does not support SVG gradients with clip paths well).
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="15" fill="#141416" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="14.5" fill="none" stroke="#f0b5a0" strokeOpacity="0.35" />
      <rect x="15" y="24" width="40" height="28" rx="6" fill="#c9806b" />
      <circle cx="23" cy="26" r="14" fill="#d9dde1" />
      <path d="M15 30 A6 6 0 0 1 21 24 L35.6 24 A14 14 0 0 1 23 40 A14 14 0 0 1 15 37.4 Z" fill="#5a2e24" />
    </svg>
  );
}

/** Inter (OFL) for the share images, bundled in assets/fonts so builds never depend on a font host. */
export async function ogFonts() {
  const dir = join(process.cwd(), 'assets', 'fonts');
  const [regular, bold] = await Promise.all([
    readFile(join(dir, 'Inter-Regular.otf')),
    readFile(join(dir, 'InterDisplay-Bold.otf'))
  ]);
  return [
    { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Inter', data: bold, weight: 700 as const, style: 'normal' as const },
    { name: 'Inter', data: bold, weight: 800 as const, style: 'normal' as const }
  ];
}
