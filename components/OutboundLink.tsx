'use client';

import { track } from '@/lib/analytics';
import { ArrowIcon } from '@/components/bits';

// Every "Get the card" button goes through /go/[slug], which adds UTM tags and,
// when you add one in cards.json, swaps in your referral link.
export function OutboundLink({
  slug,
  name,
  placement,
  className = 'btn btn-metal',
  children
}: {
  slug: string;
  name: string;
  placement: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={`/go/${slug}`}
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
