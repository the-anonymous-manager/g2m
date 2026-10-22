'use client';

import { track } from '@/lib/analytics';
import { ArrowIcon } from '@/components/bits';

// Every "Get the card" button goes through /go/[slug], which adds UTM tags and,
// when you add one in cards.json, swaps in your referral link.
export function OutboundLink({
  slug,
  name,
  placement,
  campaign,
  className = 'btn btn-metal',
  children
}: {
  slug: string;
  name: string;
  placement: string;
  // Overrides utm_campaign (only values /go/[slug] allows, e.g. "sponsored").
  campaign?: 'sponsored';
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={`/go/${slug}${campaign ? `?c=${campaign}` : ''}`}
      target="_blank"
      rel="nofollow sponsored noopener"
      className={className}
      onClick={() => track('Outbound', { card: slug, placement })}
    >
      {children ?? <>Get the {name}</>}
      <ArrowIcon />
    </a>
  );
}
