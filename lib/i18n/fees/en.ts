// The fees guide's text for translated pages (/de/guides/crypto-card-fees-explained). Server only: the page is built
// ahead of time and none of this is sent to the browser. {x} slots get numbers, money and dates already formatted.
// The English page (app/(en)/guides/crypto-card-fees-explained) writes the same text in place.
export const feesEn = {
  title: 'Crypto card fees explained',
  description:
    'The fees a crypto card can charge (annual, FX, top-up, per-purchase, small-purchase, ATM), what they cost on a month of spending, and how to compare them.',
  tile: 'Every fee, and what it costs on a month of spending',
  eyebrow: 'guide',
  lead: 'A crypto card can look free and still cost a few percent of everything you spend. Here is each fee, how common it is across the {n} cards on G2M, and what the fees add up to on the same month of spending.',
  hAnnual: 'Annual or monthly fee',
  pAnnual:
    'A subscription for the card or its tier. {free} of the {total} cards that publish one have a free entry tier; the paid ones charge {min} to {max} a year. Higher tiers often swap the fee for a token you hold or stake, whose price can move. ',
  noAnnualLink: 'Cards with no annual fee',
  hFx: 'FX (foreign exchange) fee',
  pFx: 'A percentage added when you pay in a currency the card is not billed in. Most crypto cards bill in US dollars, so someone paying in rupees, dirhams or pounds pays it at home on every purchase, not only abroad. Across the {count} cards that publish it, it runs from {min} to {max} (median {median}). ',
  noFxLink: 'Cards with no FX fee',
  hTopUp: 'Top-up fee',
  pTopUp:
    'A percentage for loading the card, for example when you move stablecoins or crypto onto it. {free} of the {total} cards that publish it charge nothing; the highest is {max}. It applies to everything you load, so it works like a fee on every purchase.',
  hPurchase: 'Fee on every purchase',
  pPurchase:
    'A percentage or a flat amount on each payment, sometimes called a conversion or spread fee. {n} of the {total} cards charge one. A flat fee hurts most on small, frequent purchases.',
  hSmall: 'Small-purchase fee',
  pSmall: 'A flat fee on purchases under a set amount. {n} of the {total} cards charge one{foreign}{free}. It adds up on coffees and other small, frequent purchases.',
  smallForeign: "; {n} only on purchases in a currency other than the card's",
  smallFreeOne: '; {n} gives some free each month',
  smallFreeMany: '; {n} give some free each month',
  hAtm: 'ATM fees',
  pAtm: "A flat fee, a percentage, or both, often with a free amount each month on higher tiers. Each card's review lists its ATM terms.",
  hMonth: 'What the fees cost on a {x} month',
  pMonth:
    "Every card spending the same G2M test basket: {x} in {purchases} purchases from {a} to {b}. The first column is spending in the card's own currency; the second is the same month in another currency, so the FX fee and any foreign-only fees apply. Annual fees and cashback are not included.",
  thCard: 'Card',
  thHome: 'In its own currency',
  thAbroad: 'In another currency',
  thAnnual: 'Annual fee',
  foot: 'Entry tier of each card. “Not published” means the issuer does not state a fee the month needs. Card data last checked {date}. ',
  basketLink: 'How the test basket works',
  q1: 'What fees do crypto cards charge?',
  a1: 'Up to six kinds: an annual or monthly fee, an FX fee on foreign currency, a top-up fee to load the card, a fee on every purchase, a small-purchase fee, and ATM fees. Most cards charge only some of them.',
  q2: 'What is a normal FX fee on a crypto card?',
  a2: 'Across the {count} cards on G2M that publish one, the FX fee runs from {min} to {max}, with a median of {median}. {zero} charge none.',
  q3: 'Which crypto card is cheapest to use?',
  a3: 'On a {x} month spent in a currency the card does not bill in, the lowest fees on G2M are on {list}. The annual fee comes on top; the rewards calculator adds cashback and works out the whole year.',
  calcLine: '{link} puts cashback and every fee together for your own spending.',
  calcLink: 'The rewards calculator'
};
