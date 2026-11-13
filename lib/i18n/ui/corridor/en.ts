// The corridor (off-ramp) finder's words (/corridors, /de/corridors). {x} slots are filled in the component.
export const corridorEn = {
  metaTitle: 'Crypto off-ramp and IBAN finder: USDC to SEPA, ACH, UPI',
  metaDesc:
    'Which crypto cards move USDC or USDT to a bank: EUR SEPA, USD ACH, GBP Faster Payments, AED, INR or SWIFT. Accounts in your name, cash-out rails and fees.',
  eyebrow: 'off-ramp',
  title: 'Corridor and IBAN finder',
  lead: 'Move stablecoins to a bank. Pick a coin and where the money should land: see which cards give you an account in your name, which can cash out on that rail, and what it costs.',

  move: 'Move',
  to: 'To',
  whereLive: 'Where you live',
  allCountries: 'All countries',
  yourLocation: ' (your location)',
  dEUR: 'EUR · SEPA (Europe)',
  dUSD: 'USD · ACH or US bank',
  dGBP: 'GBP · Faster Payments (UK)',
  dAED: 'AED · UAE bank',
  dINR: 'INR · Indian bank or UPI',
  dSWIFT: 'Global · SWIFT wire',
  dLocal: '{cur} · local bank',

  // "USDC to EUR · SEPA (Europe): 3 cards can cash out, 5 can receive money"
  summary: '{coin} to {dest}: {cash} can cash out, {receive} can receive money',
  cardsOne: '{n} card',
  cardsMany: '{n} cards',
  receiveN: '{n}',
  inCountry: ' · cards you may get in {place}',
  share: 'Which crypto cards move {coin} to {dest} · G2M corridor finder',
  none: 'No card {where}has a confirmed {dest} rail yet. Try SWIFT, or another currency.',
  noneWhere: 'available in {place} ',

  caption: 'Cards that move {coin} to {dest}',
  thCard: 'Card',
  thCashOut: 'Cash out to a bank',
  thReceive: 'Receive from a bank',
  thRail: 'Rail',
  thFees: 'Fees and notes',
  thNonRes: 'Non-residents',
  dlCashOut: 'Cash out',
  dlReceive: 'Receive',
  score: 'G2M score {n}',
  named: 'Account in your name',
  shared: 'Shared account (reference code)',
  account: 'Account details (type not stated)',
  no: 'No',
  yes: 'Yes',
  notPublished: 'Not published',
  supported: 'Supported',
  notStated: 'Not stated',

  // Rail names: "EUR SEPA", "USD wire", "SWIFT wire"
  swiftWire: 'SWIFT wire',
  mWIRE: 'wire',
  mFPS: 'Faster Payments',
  mBANK: 'bank transfer',

  footA:
    'Rails come from each issuer\'s own help pages and fee lists. “Cash out” means you can send money from the app to a bank account on that rail; “receive” means the app gives you account details a bank can pay into. Fees are shown where the issuer publishes them (“in” = receiving, “out” = cashing out). ',
  unknownOne: '{n} card here has no confirmed rails yet. ',
  unknownMany: '{n} cards here have no confirmed rails yet. ',
  footB: 'Check limits and eligibility with the issuer before you move money.'
};
