'use client';

import { useState } from 'react';
import { track } from '@/lib/analytics';

// On a card page: the sign-up bonus for joining through G2M's referral link, and G2M's referral code with a copy
// button, for apps that ask for a code. Only shown when the card has a referral link (lib/types toRow).
export function ReferralBox({ slug, brand, bonus, code }: { slug: string; brand: string; bonus?: string; code?: string }) {
  const [copied, setCopied] = useState(false);
  if (!bonus && !code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code!);
      setCopied(true);
      track('Share', { channel: 'code', card: slug });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this code', code);
    }
  };

  return (
    <div className="referral-box">
      {bonus ? (
        <p>
          <strong>Sign-up bonus with G2M&apos;s link:</strong> {bonus}
        </p>
      ) : null}
      {code ? (
        <p className="referral-code">
          <span>Referral code</span>
          <code className="mono">{code}</code>
          <button type="button" className="btn btn-sm" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </p>
      ) : null}
      <p className="faint" style={{ fontSize: 13 }}>
        {bonus ? `${brand}'s own terms; they can change. ` : ''}G2M may earn a referral fee. It never changes a card&apos;s
        score or rank.
      </p>
    </div>
  );
}
