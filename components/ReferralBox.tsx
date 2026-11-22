'use client';

import { useState } from 'react';
import { track } from '@/lib/analytics';
import type { Ui } from '@/lib/i18n/ui/en';

const fillT = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);

// On a card page: the sign-up bonus for joining through G2M's referral link, and G2M's referral code with a copy
// button, for apps that ask for a code. Only shown when the card has a referral link (lib/types toRow).
export function ReferralBox({
  slug,
  brand,
  bonus,
  code,
  ends,
  words
}: {
  slug: string;
  brand: string;
  bonus?: string;
  code?: string;
  /** Last day of a limited-time bonus, already written as a date in the page's language. */
  ends?: string;
  /** Another language's card words (lib/i18n/ui); English when left out. */
  words?: Ui['card'];
}) {
  const [copied, setCopied] = useState(false);
  if (!bonus && !code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code!);
      setCopied(true);
      track('Share', { channel: 'code', card: slug });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(words?.copyCode ?? 'Copy this code', code);
    }
  };

  return (
    <div className="referral-box">
      {bonus ? (
        <p>
          {ends ? (
            <span className="badge badge-warn referral-limited">{fillT(words?.bonusUntil ?? 'Limited time, until {date}', { date: ends })}</span>
          ) : null}
          <strong>{words?.bonusWithLink ?? "Sign-up bonus with G2M's link:"}</strong> {bonus}
        </p>
      ) : null}
      {code ? (
        <p className="referral-code">
          <span>{words?.referralCode ?? 'Referral code'}</span>
          <code className="mono">{code}</code>
          <button type="button" className="btn btn-sm" onClick={copy}>
            {copied ? (words?.copied ?? 'Copied') : (words?.copy ?? 'Copy')}
          </button>
        </p>
      ) : null}
      <p className="faint" style={{ fontSize: 13 }}>
        {words ? (
          <>
            {bonus ? fillT(words.ownTerms, { brand }) : ''}
            {words.refFee}
          </>
        ) : (
          <>
            {bonus ? `${brand}'s own terms; they can change. ` : ''}G2M may earn a referral fee. It never changes a card&apos;s
            score or rank.
          </>
        )}
      </p>
    </div>
  );
}
