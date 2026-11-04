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
  },
  {
    slug: 'crypto-cards-with-apple-pay',
    title: 'Crypto cards with Apple Pay',
    description: 'Every crypto card on G2M you can add to Apple Pay, ranked by the G2M score, with cashback, annual fee and FX fee.',
    intro: [
      'With Apple Pay you add the card to the Wallet app and pay by tapping your iPhone or Apple Watch, in shops and in apps, without carrying the card itself. A virtual card is often enough.',
      'Apple Pay support is listed only when the issuer confirms it. It can also depend on the country: Apple Pay itself does not work everywhere.'
    ],
    match: (c) => c.wallets.applePay === true,
    tips: [
      'Check that Apple Pay works in your country, not only that the card supports it.',
      'Some cards add Apple Pay only on certain tiers or card types.',
      'Tapping your phone counts as a normal card purchase: the same FX and per-purchase fees apply.'
    ]
  },
  {
    slug: 'crypto-cards-with-google-pay',
    title: 'Crypto cards with Google Pay',
    description: 'Every crypto card on G2M you can add to Google Pay (Google Wallet), ranked by the G2M score.',
    intro: [
      'With Google Pay (Google Wallet) you add the card to an Android phone or watch and pay by tapping it, in shops and online, without the plastic card.',
      'Google Pay support is listed only when the issuer confirms it, and Google Pay itself is not offered in every country.'
    ],
    match: (c) => c.wallets.googlePay === true,
    tips: [
      'Check that Google Pay works in your country, not only that the card supports it.',
      'Some cards add Google Pay only on certain tiers or card types.',
      'Paying with your phone costs the same as paying with the card: the FX and per-purchase fees still apply.'
    ]
  },
  {
    slug: 'crypto-credit-cards',
    title: 'Crypto credit cards (spend without selling)',
    description: 'Crypto cards that let you borrow against your crypto and spend without selling it, ranked by the G2M score.',
    intro: [
      'Most crypto cards are debit or prepaid: you spend money you already hold, and paying with crypto counts as selling it. The cards here offer credit instead, usually a loan backed by the crypto you deposit, so you can spend while keeping your coins.',
      'Borrowing against crypto has a cost and a risk: interest on what you borrow, and if the price of your collateral falls far enough, part of it can be sold (liquidated) to repay the loan.'
    ],
    match: (c) => c.ecosystem?.credit === true || c.type === 'credit',
    tips: [
      'Check the interest rate on what you borrow and when it has to be repaid.',
      'Check how much you can borrow against each coin (the loan-to-value) and when liquidation starts.',
      'A card can call itself a credit card and still need you to deposit funds first.'
    ]
  },
  {
    slug: 'usdt-crypto-cards',
    title: 'USDT cards: spend Tether with a crypto card',
    description: 'Crypto cards you can top up or spend with USDT (Tether), ranked by the G2M score, with fees and where each one works.',
    intro: [
      'USDT (Tether) is the most used stablecoin: a token meant to stay worth one US dollar. These cards accept USDT, either to load the card or to spend straight from your balance.',
      'Check which network the card takes USDT on (for example Tron, Ethereum or Solana): sending on the wrong network can lose the funds, and network fees differ a lot.'
    ],
    match: (c) => c.assets.some((a) => a.toUpperCase() === 'USDT'),
    tips: [
      'Check the supported networks and the deposit fee for each one.',
      'Look at the top-up fee: some cards charge a percentage to turn USDT into card balance.',
      'Most cards bill in US dollars, so spending in another currency adds the FX fee.'
    ]
  },
  {
    slug: 'usdc-crypto-cards',
    title: 'USDC cards: spend USDC with a crypto card',
    description: 'Crypto cards you can top up or spend with USDC, ranked by the G2M score, with cashback, fees and where each one works.',
    intro: [
      'USDC is a stablecoin issued by Circle, meant to stay worth one US dollar. These cards accept USDC, either to load the card or to spend straight from your balance or wallet.',
      'Check which network the card takes USDC on (for example Solana, Base or Ethereum): network fees differ, and sending on the wrong network can lose the funds.'
    ],
    match: (c) => c.assets.some((a) => a.toUpperCase() === 'USDC'),
    tips: [
      'Check the supported networks and what each costs to deposit.',
      'Look at the top-up fee and whether the card keeps your USDC on-chain or converts it.',
      'Most cards bill in US dollars, so spending in another currency adds the FX fee.'
    ]
  },
  {
    slug: 'crypto-visa-cards',
    title: 'Crypto Visa cards',
    description: 'Every crypto card on G2M that runs on Visa, ranked by the G2M score, with cashback, annual fee and FX fee.',
    intro: [
      'These crypto cards run on the Visa network, so they work wherever Visa is accepted, in shops, online and at most ATMs. Visa or Mastercard makes little difference at the till; the issuer sets the fees and the cashback.',
      'Some Visa crypto cards are Visa Signature or Platinum, which can add benefits such as purchase protection or concierge, usually on higher tiers.'
    ],
    match: (c) => c.network.includes('Visa'),
    tips: [
      'Compare the issuer’s fees: the network does not set them.',
      'Check which tier comes with Visa Signature or Platinum benefits.',
      'Check that the card is confirmed where you live before you apply.'
    ],
    rankings: '/cards?net=visa'
  },
  {
    slug: 'crypto-mastercard-cards',
    title: 'Crypto Mastercard cards',
    description: 'Every crypto card on G2M that runs on Mastercard, ranked by the G2M score, with cashback, annual fee and FX fee.',
    intro: [
      'These crypto cards run on the Mastercard network, so they work wherever Mastercard is accepted, in shops, online and at most ATMs. The issuer, not the network, sets the fees and the cashback.',
      'A few issuers offer both a Visa and a Mastercard version, sometimes as different card types with different fees.'
    ],
    match: (c) => c.network.includes('Mastercard'),
    tips: [
      'Compare the issuer’s fees: the network does not set them.',
      'If a card comes on both networks, check which version you get where you live.',
      'Check that the card is confirmed where you live before you apply.'
    ],
    rankings: '/cards?net=mastercard'
  },
  {
    slug: 'virtual-crypto-cards',
    title: 'Virtual crypto cards',
    description: 'Crypto cards that come as a virtual card you can use online and with Apple Pay or Google Pay right away, ranked by the G2M score.',
    intro: [
      'A virtual card is a card number you get in the app, usually within minutes. You can use it online straight away, and in shops if you add it to Apple Pay or Google Pay.',
      'Many issuers give a virtual card first and a physical card later, sometimes for a fee or only on higher tiers.'
    ],
    match: (c) => c.forms.includes('virtual'),
    tips: [
      'Check whether the virtual card works with Apple Pay or Google Pay where you live.',
      'Check the cost of each extra virtual card, if you want one per subscription.',
      'Some merchants (hotels, car rental) prefer a physical card.'
    ]
  },
  {
    slug: 'high-cashback-crypto-cards',
    title: 'Crypto cards with 2% or more cashback',
    description: 'Crypto cards that pay 2% or more cashback on everyday spending on their entry tier, ranked by the G2M score.',
    intro: [
      'These cards pay at least 2% back on everyday purchases on their entry tier, the one you get without paying for a plan or staking a token. Rates on higher tiers are often higher still.',
      'Cashback is often paid in a token rather than cash, and many cards cap it each month. A high rate with a low cap can earn less than a lower rate without one.'
    ],
    match: (c) => (c.cashback.basePct ?? 0) >= 2,
    tips: [
      'Check the monthly cap and any spending bands where the rate drops.',
      'Check what the cashback is paid in: a token’s price can fall.',
      'Fees can cancel cashback out: use the rewards calculator to see what you keep.'
    ],
    rankings: '/cards?sort=cashback:desc'
  },
  {
    slug: 'crypto-cards-with-yield',
    title: 'Crypto cards that pay yield on your balance',
    description: 'Crypto cards whose app pays interest or yield on the money you have not spent yet, ranked by the G2M score.',
    intro: [
      'Some crypto card apps pay a yield on your unspent balance, often on stablecoins, so money waiting to be spent earns something.',
      'Yield is not a bank deposit rate: it usually comes from lending or on-chain strategies, it changes over time, and it is not protected by deposit insurance.'
    ],
    match: (c) => c.ecosystem?.yield === true,
    tips: [
      'Check where the yield comes from and whether the rate is fixed or changes.',
      'Check whether you can spend or withdraw the balance at any time.',
      'Some cards pay the higher rates only on higher tiers or up to a cap.'
    ]
  },
  {
    slug: 'bitcoin-crypto-cards',
    title: 'Bitcoin cards: spend BTC with a crypto card',
    description: 'Crypto cards that accept Bitcoin (BTC) to load, spend or borrow against, ranked by the G2M score.',
    intro: [
      'These cards accept Bitcoin: some sell it for you when you pay or top up, others let you borrow against it and keep it.',
      'Paying with Bitcoin usually counts as selling it, which can matter for tax where you live. Borrowing against it avoids the sale but brings interest and liquidation risk.'
    ],
    match: (c) => c.assets.some((a) => /BTC/i.test(a)),
    tips: [
      'Check whether the card sells your BTC at each purchase or lends against it.',
      'Check the conversion fee or spread on turning BTC into card balance.',
      'Check which Bitcoin network or wrapped version the card accepts.'
    ]
  },
  {
    slug: 'no-fx-fee-crypto-cards-in-euros',
    title: 'Crypto cards with no FX fee in euros',
    description: 'Crypto cards that charge no FX fee when you pay in euros, ranked by the G2M score: useful if you live in or travel to the eurozone.',
    intro: [
      'Most crypto cards bill in US dollars, so every purchase in euros costs an FX fee. The cards here publish no FX fee on euro spending, either because they bill in euros or because they hold a euro balance.',
      'Spending in other currencies can still carry an FX fee on these cards.'
    ],
    match: (c) => c.fees.fxByCurrency?.EUR === 0,
    tips: [
      'Check the FX fee on currencies other than the euro if you travel.',
      'Check whether you need a euro balance on the card for the free rate.',
      'Check that the card is confirmed in your country before you apply.'
    ]
  }
];

export const FEES_GUIDE = {
  slug: 'crypto-card-fees-explained',
  title: 'Crypto card fees explained',
  description: 'The fees a crypto card can charge (annual, FX, top-up, per-purchase, small-purchase, ATM), what they cost on a month of spending, and how to compare them.'
};

export const topicCards = (t: Topic) => getCards().filter(t.match);
