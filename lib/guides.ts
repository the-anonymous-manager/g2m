import 'server-only';
import type { Card } from '@/lib/types';
import { getCards } from '@/lib/cards';
import { rankIn } from '@/lib/score';
import { availabilityIn, countryName } from '@/lib/regions';
import { COUNTRY_CODES } from '@/lib/countries.mjs';

// The /guides pages. Every list and number comes from the card data, so a sheet edit updates the guides too;
// only the general explanations are written here, and they name no card facts.

/** A country gets its own "best crypto cards in" guide once this many cards are confirmed there. */
export const MIN_CONFIRMED = 5;

export const countrySlug = (cc: string) =>
  countryName(cc)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const countryGuidePath = (cc: string) => `/guides/best-crypto-cards/${countrySlug(cc)}`;

export type CountryGuide = { cc: string; name: string; confirmed: Card[]; unconfirmed: number };

let countryCache: CountryGuide[] | null = null;
/** Countries with a guide, most confirmed cards first. Cards are in that country's rank order. */
export function countryGuides(): CountryGuide[] {
  if (countryCache) return countryCache;
  const cards = getCards();
  countryCache = COUNTRY_CODES.map((cc: string) => {
    const ranked = rankIn(cards, cc);
    const confirmed = ranked.filter((c) => availabilityIn(c, cc) === 'yes');
    return { cc, name: countryName(cc), confirmed, unconfirmed: ranked.length - confirmed.length };
  })
    .filter((g: CountryGuide) => g.confirmed.length >= MIN_CONFIRMED)
    .sort((a: CountryGuide, b: CountryGuide) => b.confirmed.length - a.confirmed.length || a.name.localeCompare(b.name));
  return countryCache!;
}

export const countryGuide = (slug: string) => countryGuides().find((g) => countrySlug(g.cc) === slug);

const hasLounge = (c: Card) => [...c.perks, ...c.tiers.flatMap((t) => t.perks)].some((p) => /lounge/i.test(p));

export type Topic = {
  slug: string;
  /** Link text and page heading. */
  title: string;
  description: string;
  /** Plain explanation shown above the list; no card facts. */
  intro: string[];
  match: (c: Card) => boolean;
  /** What to check before picking one. */
  tips: string[];
  /** The /cards view with the same filter, when there is one. */
  rankings?: string;
};

export const TOPICS: Topic[] = [
  {
    slug: 'no-fx-fee-crypto-cards',
    title: 'Crypto cards with no FX fee',
    description: 'Every crypto card on G2M with a 0% FX fee, ranked by the G2M score, with cashback, annual fee and where each one works.',
    intro: [
      'An FX (foreign exchange) fee is a percentage a card adds when you pay in a currency it is not billed in. Most crypto cards are billed in US dollars, so for many people that is every purchase at home, not only when travelling.',
      'These cards publish a 0% FX fee. Check the other costs too: a card can skip the FX fee and still charge for top-ups or small purchases.'
    ],
    match: (c) => c.fees.fxPct === 0,
    tips: [
      'Look at the top-up fee: loading the card can cost more than an FX fee would.',
      'Some cards charge a fee on small purchases, sometimes only on foreign-currency ones.',
      'Check that the card is confirmed where you live before you apply.'
    ],
    rankings: '/cards?sort=fx:asc'
  },
  {
    slug: 'no-annual-fee-crypto-cards',
    title: 'Crypto cards with no annual fee',
    description: 'Every crypto card on G2M you can get without a yearly or monthly fee, ranked by the G2M score.',
    intro: [
      'These cards have an entry tier with no yearly or monthly subscription. Higher tiers of the same card may cost money or ask you to hold or stake a token.',
      'A free card is not always the cheapest one to use: the FX fee and per-purchase fees can cost more over a year than a small annual fee.'
    ],
    match: (c) => c.fees.annualUsd === 0,
    tips: [
      'Check for a one-off fee to get the card, or the cost of a physical card and shipping.',
      'Compare the FX fee if you spend in a currency other than the one the card bills in.',
      'Use the rewards calculator to see what each card keeps you after fees at your own spending.'
    ],
    rankings: '/cards?nofee=1'
  },
  {
    slug: 'non-custodial-crypto-cards',
    title: 'Non-custodial crypto cards',
    description: 'Crypto cards that let you keep control of your funds until you spend, ranked by the G2M score, plus custodial vs non-custodial explained.',
    intro: [
      'With a custodial card, the company holds your crypto in its own account and you hold a balance with it, much like a bank or an exchange. With a non-custodial card, the funds stay in a wallet you control and only leave it when you pay.',
      'Non-custodial means the company cannot freeze or lose the funds you have not spent yet, but you are responsible for your wallet and its recovery phrase. Some cards let you choose either way.'
    ],
    match: (c) => c.custody === 'self-custodial' || c.custody === 'both',
    tips: [
      'Keep your recovery phrase safe: with a non-custodial wallet nobody can reset it for you.',
      'Check which networks and tokens the card spends from, and the cost of moving funds there.',
      'Most cards still ask for an identity check (KYC), non-custodial or not.'
    ],
    rankings: '/cards?custody=self'
  },
  {
    slug: 'crypto-cards-with-iban',
    title: 'Crypto cards with a bank account (IBAN)',
    description: 'Crypto cards that come with an IBAN or bank account number to receive money, ranked by the G2M score.',
    intro: [
      'Some crypto cards come with a bank account number (an IBAN in Europe) so you can receive a salary or a bank transfer straight into the app, then spend it or swap it to crypto.',
      'An account in your own name works like a normal bank account. A shared account takes payments into the company’s account with a reference code, which some employers and banks do not accept.'
    ],
    match: (c) => c.ecosystem?.iban === 'named' || c.ecosystem?.iban === 'shared',
    tips: [
      'Check whether the account is in your name or shared with a reference code.',
      'Check which currencies you can receive and send, and the fee for each transfer.',
      'Some accounts are only for residents of certain countries.'
    ]
  },
  {
    slug: 'metal-crypto-cards',
    title: 'Metal crypto cards',
    description: 'Crypto cards with a metal card option, ranked by the G2M score, with the fee and cashback of each.',
    intro: [
      'A metal card is the same card in a heavier, metal body. It is usually part of a higher tier, so it can come with a yearly fee, a token to hold or stake, or a one-off cost.',
      'The card works the same as the plastic one at the till: what changes is the price of the tier and what that tier earns.'
    ],
    match: (c) => c.forms.includes('metal'),
    tips: [
      'Check which tier includes the metal card and what that tier costs a year.',
      'If the tier asks you to stake a token, the token’s price can move.',
      'Use Compare to see each card’s tiers side by side.'
    ],
    rankings: '/cards?metal=1'
  },
  {
    slug: 'crypto-cards-with-lounge-access',
    title: 'Crypto cards with airport lounge access',
    description: 'Crypto cards that list airport lounge access on at least one tier, ranked by the G2M score.',
    intro: [
      'Lounge access is usually a perk of a higher tier, through a programme such as Priority Pass or LoungeKey, often with a set number of free visits a year.',
      'Read what the tier costs before you weigh the perk: a yearly fee or a token to stake can cost more than paying for the odd lounge visit.'
    ],
    match: hasLounge,
    tips: [
      'Check how many visits a year are free, and whether a guest is included.',
      'Check which tier gives access and what it costs.',
      'Lounge perks change often; confirm on the issuer’s site before you apply.'
    ],
    rankings: '/cards?lounge=1'
  },
  {
    slug: 'no-kyc-crypto-cards',
    title: 'No-KYC crypto cards (no ID check)',
    description: 'Crypto cards you can get without an identity check (KYC), or with a card option that needs none, ranked by the G2M score.',
    intro: [
      'Most crypto cards ask for an identity check (KYC) before you can use them: a photo of your ID and sometimes a selfie or proof of address. A few let you get a card, or one card option, with only an email or a wallet.',
      'Cards without an ID check usually cost more to load, have lower spending limits or expire after a while. They are listed here only when the issuer itself says no ID check is needed.'
    ],
    match: (c) => Boolean(c.noIdCheck),
    tips: [
      'Check which card option needs no ID check: often only a virtual card or a lower-limit tier.',
      'Look at the loading fee and the spending limit, which are often higher and lower than on verified cards.',
      'The issuer can still ask for ID later, for example above a limit or when you withdraw.'
    ],
    rankings: '/cards?noid=1'
  },
  {
    slug: 'crypto-card-sign-up-bonuses',
    title: 'Crypto card sign-up bonuses',
    description: 'Every crypto card on G2M with a sign-up bonus for joining through G2M’s link, with the spend and time limit to get it, ranked by the G2M score.',
    intro: [
      'Many crypto cards pay new users a bonus for joining through a referral link: spend credit, cashback on the first purchases, or a token reward once you spend a set amount within a set number of days.',
      'The bonuses here are the ones each issuer publishes for people who join through G2M’s link. G2M may earn a referral fee too; it never changes a card’s score or rank.'
    ],
    match: (c) => Boolean(c.links.affiliate && c.signupBonus),
    tips: [
      'Read the spend you need and the deadline: a bonus that needs $1,000 in 30 days is only worth it if you spend that anyway.',
      'Check how it is paid: spend credit and tokens are not the same as cash.',
      'Pick the card for its fees and cashback first; a bonus is paid once, fees are paid every month.'
    ],
    rankings: '/cards?bonus=1'
  }
];

export const FEES_GUIDE = {
  slug: 'crypto-card-fees-explained',
  title: 'Crypto card fees explained',
  description: 'The fees a crypto card can charge (annual, FX, top-up, per-purchase, small-purchase, ATM), what they cost on a month of spending, and how to compare them.'
};

export const topicCards = (t: Topic) => getCards().filter(t.match);
