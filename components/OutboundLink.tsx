'use client';

import { ArrowIcon } from '@/components/bits';

// Every "Get the card" button goes through /go/[slug], which adds UTM tags, swaps in your referral link
// when the card has one, and records the click for /stats (?p= = where on the site it was clicked).
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
      href={`/go/${slug}?p=${encodeURIComponent(placement)}${campaign ? `&c=${campaign}` : ''}`}
      target="_blank"
      rel="nofollow sponsored noopener"
      className={className}
    >
      {children ?? <>Get the {name}</>}
      <ArrowIcon />
    </a>
  );
}
