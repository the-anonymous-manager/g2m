'use client';

import { useState } from 'react';
import { track } from '@/lib/analytics';

// Share the current view (with its filters in the URL) on X, or copy the link.
export function ShareBar({ text, path, label = 'Share this view' }: { text: string; path?: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const currentUrl = () => {
    if (typeof window === 'undefined') return '';
    return path ? new URL(path, window.location.origin).toString() : window.location.href;
  };

  const shareX = () => {
    const url = currentUrl();
    track('Share', { channel: 'x' });
    const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(intent, '_blank', 'noopener,noreferrer');
  };

  const copy = async () => {
    const url = currentUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track('Share', { channel: 'copy' });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link', url);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} aria-label={label}>
      <button type="button" className="btn btn-sm" onClick={shareX}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.2h1.7L7.4 4.7H5.57l11.1 14.5Z"
          />
        </svg>
        Post on X
      </button>
      <button type="button" className="btn btn-sm" onClick={copy}>
        {copied ? 'Link copied' : 'Copy link'}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Link copied to clipboard' : ''}
      </span>
    </div>
  );
}
