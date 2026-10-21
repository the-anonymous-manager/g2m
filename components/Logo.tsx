// The G2M "Coin x Card" mark in rose gold. The tile follows the theme
// (pearl in light mode, obsidian in dark mode) through CSS variables;
// the card and coin keep the same metal in both.
type Props = { size?: number; id?: string; title?: string };

export function LogoMark({ size = 38, id = 'g2m', title }: Props) {
  const t = `${id}-tile`;
  const c = `${id}-card`;
  const o = `${id}-coin`;
  const v = `${id}-over`;
  const k = `${id}-clip`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={t} gradientUnits="userSpaceOnUse" x1="0" y1="64" x2="64" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--tile-0)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--tile-1)' }} />
          <stop offset="1" style={{ stopColor: 'var(--tile-2)' }} />
        </linearGradient>
        <linearGradient id={c} gradientUnits="userSpaceOnUse" x1="16" y1="50" x2="56" y2="22">
          <stop offset="0" stopColor="#7A3F31" />
          <stop offset="0.25" stopColor="#E8A891" />
          <stop offset="0.45" stopColor="#B9705C" />
          <stop offset="0.6" stopColor="#FFD9CB" />
          <stop offset="0.8" stopColor="#C9806B" />
          <stop offset="1" stopColor="#6B372A" />
        </linearGradient>
        <linearGradient id={o} gradientUnits="userSpaceOnUse" x1="10" y1="38" x2="38" y2="10">
          <stop offset="0" stopColor="#5E6368" />
          <stop offset="0.2" stopColor="#E4E7EA" />
          <stop offset="0.45" stopColor="#8F959B" />
          <stop offset="0.6" stopColor="#FFFFFF" />
          <stop offset="0.8" stopColor="#A4AAB0" />
          <stop offset="1" stopColor="#4E5357" />
        </linearGradient>
        <linearGradient id={v} gradientUnits="userSpaceOnUse" x1="16" y1="40" x2="38" y2="22">
          <stop offset="0" stopColor="#3A1A13" />
          <stop offset="0.4" stopColor="#7E4537" />
          <stop offset="0.6" stopColor="#5A2E24" />
          <stop offset="1" stopColor="#2E140F" />
        </linearGradient>
        <clipPath id={k}>
          <rect x="16" y="22" width="40" height="28" rx="6" />
        </clipPath>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${t})`} />
      <rect x="0.5" y="0.5" width="63" height="63" rx="14.5" fill="none" style={{ stroke: 'var(--tile-rim)' }} />
      <g transform="translate(-1 2)">
        <rect x="16" y="22" width="40" height="28" rx="6" fill={`url(#${c})`} />
        <rect x="16.4" y="22.4" width="39.2" height="27.2" rx="5.6" fill="none" stroke="#F0B5A0" strokeOpacity="0.55" strokeWidth="0.8" />
        <circle cx="24" cy="24" r="14" fill={`url(#${o})`} />
        <circle cx="24" cy="24" r="14" fill={`url(#${v})`} clipPath={`url(#${k})`} />
        <circle cx="24" cy="24" r="11" fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="0.9" />
        <circle cx="24" cy="24" r="13.6" fill="none" stroke="#FFF" strokeOpacity="0.4" strokeWidth="0.6" />
      </g>
    </svg>
  );
}

export function LogoLockup({ id = 'hdr', size = 38 }: { id?: string; size?: number }) {
  return (
    <>
      <LogoMark size={size} id={id} />
      <span className="brand-name">
        <span className="brand-word metal-text">G2M</span>
        <span className="brand-sub">GWEI 2 MERCHANT</span>
      </span>
    </>
  );
}
