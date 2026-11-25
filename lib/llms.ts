import 'server-only';
import { getCards, getClosedCards } from '@/lib/cards';
import { getUpdates, hasEnded, updatePath } from '@/lib/updates';
import { CUSTODY_LABEL, cashbackLabel, perPurchaseFee, pct, tierCashback, usd } from '@/lib/format';
import { tierHoldUsd } from '@/lib/calc';
import { site } from '@/lib/site';
import type { Card } from '@/lib/types';

// Plain-text pages for AI assistants and research chats (Akash, 25 Nov 2026: "share the data, the other chat doesn't
// work properly on research"): /llms.txt is a short guide, /llms-full.txt every card's facts, the live offers and
// news. Facts only: no wording rules, since Akash also uses them in chats where he posts as an independent
// influencer (25 Nov 2026). Built from the same card data as the site, so they are always current.

const MARKETS = { IN: 'India', AE: 'UAE', US: 'US', GB: 'UK', EU: 'EU/EEA' } as const;
const line = (label: string, value: string | null | undefined) => (value ? `- ${label}: ${value}\n` : '');

function cardBlock(c: Card, closed = false): string {
  const f = c.fees;
  const markets = (Object.keys(MARKETS) as (keyof typeof MARKETS)[]).map((m) => `${MARKETS[m]} ${c.coverage.markets[m]}`).join(', ');
  const eco = c.ecosystem;
  let s = `### ${c.name}${closed ? ` (CLOSED on ${c.closed})` : ` (rank ${c.rank}, score ${c.score.total}/100)`}\n`;
  s += line('Page', `${site.url}/cards/${c.slug}`);
  if (!closed) s += line('Referral link', `${site.url}/go/${c.slug}`);
  s += line('Summary', c.summary);
  s += line('Type', `${c.network} ${c.type}, ${c.forms.join('/')}, ${CUSTODY_LABEL[c.custody]}`);
  s += line('Cashback', `${cashbackLabel(c.cashback.basePct, c.cashback.maxPct)}${c.cashback.payout ? ` paid in ${c.cashback.payout}` : ''}${c.cashback.note ? `. ${c.cashback.note}` : ''}`);
  s += line(
    'Fees',
    [
      `annual ${usd(f.annualUsd)}`,
      `FX ${pct(f.fxPct)}`,
      `top-up ${pct(f.topUpPct)}`,
      `per purchase ${perPurchaseFee(f)}`,
      f.cardFeeUsd ? `card fee ${usd(f.cardFeeUsd)}` : null,
      f.atm ? `ATM ${f.atm}` : null
    ]
      .filter(Boolean)
      .join('; ')
  );
  s += line('FX note', f.fxNote);
  if (f.other?.length) s += line('Other fees', f.other.join('; '));
  const count = c.coverage.countries && !/\d/.test(c.coverage.scope) ? ` (${c.coverage.countries} countries)` : '';
  s += line('Where it works', `${c.coverage.scope}${count}. ${markets}`);
  if (c.tiers.length) {
    s += '- Tiers:\n';
    for (const t of c.tiers) {
      const hold = tierHoldUsd(t);
      s += `  - ${t.name}: ${t.feeUsdYear == null ? 'price not published' : t.feeUsdYear ? `${usd(t.feeUsdYear)} a year` : 'free'}, cashback ${tierCashback(t)}${t.requirement ? `; needs: ${t.requirement}` : ''}${hold ? ` (money to hold: ${usd(hold)})` : ''}${t.comingSoon ? ' (coming soon)' : ''}\n`;
    }
  }
  if (eco) {
    s += line(
      'Banking',
      [
        eco.iban ? `bank account: ${eco.iban}` : null,
        eco.payoutCorridors ? `bank payouts in ${eco.payoutCorridors} currencies` : null,
        eco.ramps ? `fiat on/off-ramp: ${eco.ramps}` : null,
        eco.credit ? 'crypto-backed credit' : null,
        eco.yield ? 'yield on balance' : null
      ]
        .filter(Boolean)
        .join(', ')
    );
  }
  s += line('Apple Pay / Google Pay', `${c.wallets.applePay ? 'yes' : c.wallets.applePay === false ? 'no' : 'not published'} / ${c.wallets.googlePay ? 'yes' : c.wallets.googlePay === false ? 'no' : 'not published'}`);
  if (c.perks.length) s += line('Perks', c.perks.join('; '));
  if (c.pros.length) s += line('Good', c.pros.join('; '));
  if (c.cons.length) s += line('Watch out', c.cons.join('; '));
  if (!closed && c.links.affiliate) {
    s += line('Sign-up bonus with this referral link', c.signupBonus ?? 'none published');
    if (c.bonusEnds) s += line('Limited-time bonus until', c.bonusEnds);
    s += line('Referral code', c.referralCode);
  }
  s += line('Last checked', c.lastChecked);
  if (c.sources.length) s += `- Sources:\n${c.sources.map((x) => `  - ${x.label}${x.verified ? ` (${x.verified})` : ''}: ${x.url}`).join('\n')}\n`;
  return s;
}

/** /llms.txt: what G2M is and where the data is. */
export function llmsShort(): string {
  const cards = getCards();
  return `# ${site.name} (Gwei 2 Merchant)

> The crypto card directory: every crypto card ranked on rewards, fees and where it works. ${site.tagline}

${cards.length} cards, ranked by a computed score (rewards, fees, coverage, banking features, control). Data is checked
against each issuer's own pages, with sources and dates.

## Data
- [Everything in one file: every card, tiers, fees, countries, bonuses, live offers and news](${site.url}/llms-full.txt)
- [Rankings](${site.url}/cards)
- [Updates: card news and offers](${site.url}/updates) ([RSS](${site.url}/updates/feed.xml))
- [How the score works](${site.url}/methodology)

## Tools
- [Wallet builder: the best one or two cards for your spending](${site.url}/wallet)
- [Rewards calculator](${site.url}/calculator)
- [Swipe receipt: what one purchase really costs](${site.url}/receipt)
- [Card finder](${site.url}/finder)
`;
}

/** /llms-full.txt: every card's facts, the live offers and news. */
export function llmsFull(): string {
  const today = new Date().toISOString().slice(0, 10);
  const cards = getCards();
  const updates = getUpdates();
  const live = updates.filter((u) => !hasEnded(u, today));
  let s = `# ${site.name} card data (${today})

Every crypto card on ${site.url}, ranked by G2M's computed score, with fees, countries, tiers, banking features,
sign-up bonuses with the referral link and sources. Then the live offers and news. Generated from the site's own data.

## Live offers and news (${live.length})
`;
  for (const u of live) {
    s += `\n### ${u.title}\n`;
    s += line('Date', u.date);
    s += line('Type', `${u.type}${u.sponsored ? ' (Sponsored)' : ''}`);
    s += line('Card', u.card ? `${u.card} (${site.url}/cards/${u.card})` : null);
    s += line('Ends', u.ends);
    s += line('Summary', u.summary);
    if (u.body) s += `\n${u.body}\n\n`;
    s += line('Post', `${site.url}${updatePath(u.slug)}`);
    s += line('Source', u.source);
  }
  s += `\n## Cards, by rank (${cards.length})\n\n`;
  s += cards.map((c) => cardBlock(c)).join('\n');
  const closed = getClosedCards();
  if (closed.length) s += `\n## Closed cards (no longer work, not ranked)\n\n${closed.map((c) => cardBlock(c, true)).join('\n')}`;
  return s;
}
