import type { CardRow } from '@/lib/types';

// The card's real picture when the sheet links one (downloaded by the sync into public/card-images),
// otherwise a generic metal card rendered in CSS that carries the card's name as text only.
type Props = {
  card: Pick<CardRow, 'name' | 'brand' | 'network' | 'metal'> & Partial<Pick<CardRow, 'image'>>;
  size?: 'sm' | 'md' | 'lg';
  width?: number | string;
  className?: string;
  style?: React.CSSProperties;
};

const NET: Record<string, string> = {
  Visa: 'VISA',
  Mastercard: 'MASTERCARD',
  Amex: 'AMEX',
  'Visa / Mastercard': 'VISA · MC'
};

export function CardArt({ card, size = 'md', width, className = '', style }: Props) {
  if (card.image) {
    // Already resized by the sync, so a plain <img>. Small slots get the 184px version.
    // The alt text names the card for search engines and image search (Bing flagged empty ones, 19 Nov 2026); screen
    // readers still skip the picture (aria-hidden), since the card's name is always written next to it.
    const small = size === 'sm' || (typeof width === 'number' && width <= 92);
    const src = small ? card.image.file.replace(/\.webp$/, '-sm.webp') : card.image.file;
    const Box = size === 'sm' ? 'span' : 'div';
    return (
      <Box className={`card-art photo ${size === 'sm' ? 'sm' : ''} ${className}`} aria-hidden="true" style={{ width, ...style }}>
        <img src={src} alt={card.name} width={small ? 184 : 1000} height={small ? 116 : 631} loading={small ? 'lazy' : 'eager'} decoding="async" />
      </Box>
    );
  }
  if (size === 'sm') {
    return <span className={`card-art sm ${className}`} data-metal={card.metal} aria-hidden="true" style={style} />;
  }
  return (
    <div
      className={`card-art ${className}`}
      data-metal={card.metal}
      aria-hidden="true"
      style={{ width, containerType: 'inline-size', ...style }}
    >
      <div className="card-art-inner">
        <div className="card-art-top">
          <span className="card-chip" />
          <svg width="12%" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ opacity: 0.7 }}>
            <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 8a6 6 0 0 1 0 8" />
              <path d="M12 5a10 10 0 0 1 0 14" />
              <path d="M16 2.5a14 14 0 0 1 0 19" />
            </g>
          </svg>
        </div>
        <div className="card-art-bottom" style={{ fontSize: '8cqw' }}>
          <span className="card-art-name">{card.brand}</span>
          <span className="card-art-net">{NET[card.network] ?? card.network}</span>
        </div>
      </div>
    </div>
  );
}
