# G2M handoff: everything decided so far

Started 22 Oct 2026 at the end of the version 1 build; last updated 24 Oct 2026 during scoring rules v3 (in progress;
see "Scoring rules v3"). Read this with `CLAUDE.md` before changing anything.
The owner, Akash, is not a developer: explain in plain words and do the technical steps yourself.

## Where things stand (quick summary)

- Live at https://g2m.life (Vercel, from `main`). 26 cards. Work happens on a branch and goes live through a pull
  request that Akash merges; pushing straight to `main` deploys the site.
- Card data is edited in the Google Sheet "G2M Card data" (see "Card data in a Google Sheet"). An hourly GitHub
  Action copies it to the site. Claude edits the sheet, not `data/cards.json`, for data changes.
- Real card pictures come from the sheet's "Card image" column (none added yet).
- Outreach to card issuers (email, DM, per-card gaps, how to sell the Sponsored spot) is in the Claude Doc
  "G2M card issuer outreach": https://claude.ai/artifact/96NsBhL6naMwqvFJctKpt5
- Pull requests so far: #1 to #9 merged; #10 (small display bugs, and every country in the finder and calculator)
  waiting for Akash to merge.

## Who it is for

Akash builds a name on X as a KOL on crypto cards and stablecoin payments, with an India, UAE, digital nomad and
retention angle. g2m.life is his crypto card directory, like CoinMarketCap or CoinGecko but for crypto cards:
"a market for spenders who want to learn about better card rewards".

G2M is a **global** brand (Akash, 22 Oct 2026). The site favours no market: visitors see their own market, and
anyone outside the five tracked markets sees all regions. India and the UAE stay Akash's angle on X, not on the site.
The home page region panels are the visitor's own country (when it has no panel), the US, the UK, the EU / EEA and
Asia (Akash, 22 Oct 2026: Asia replaces separate India and UAE panels). Asia follows the UN geoscheme without Cyprus
(`ASIA` in `lib/countries.mjs`); a card counts there when it is confirmed in at least one Asian country, and each card
shows how many.

Location: middleware refreshes the `g2m_cc` country cookie from Vercel's geo header on every page load (so VPNs and
travel apply at once); the browser timezone is only used when there is no header. A detected region is never written
into the rankings URL; only a region the visitor picks is, so shared links follow each reader's location.

Scores by country (Akash, 22 Oct 2026): the site detects the visitor's country (all 250, not five markets) and ranks
every card for it. Same formula, but rewards and fees come from the tiers offered there (`tier.countries` /
`tier.exceptCountries`), coverage becomes confirmed 12 / not confirmed 5, and cards not available there drop out.
If no card is confirmed in a country, the worldwide coverage points are kept, so visitors see the global ranking with
every card marked not confirmed. Card pages show the worldwide score plus "In <country>: score, #rank".
Availability per country comes from `coverage.countryList` (the issuer's list), then the five checked markets
(EU covers all EEA countries), else "not confirmed".

Country lists (22 Oct 2026): 16 cards have the issuer's own list. Avici and Plasma One came straight from their docs;
14 came from issuer pages compiled by https://cardmap.org (Akash's suggestion), each with the issuer URL as the source.
Bitget Wallet was re-read on its own page (52 countries; Card Map also had Singapore, which Bitget no longer lists).
Lists that only exist on DefiLlama were not imported, so "confirmed" always means the issuer said so. Changes this
caused: Bitget now covers the UK and EEA (was "Asia-Pacific only"); Wirex's UAE is now "not confirmed" (Wirex's list
leaves it out, an older source said yes, and Wirex's list page is offline); MetaMask has paused new US and UK sign-ups.
Still without an issuer list: KAST (in-app only), Coinbase One, Avalanche, Solayer, Bleap, Tangem Pay, Kolo,
Karta.io, Tuyo, and Tria (one country only).

Gnosis Pay was removed (Akash, 22 Oct 2026): it closes its own card on 20 Dec 2026 and ended GNO cashback on
30 Sep 2026, per its help center. 26 cards remain.

Motion (Akash asked for a zerobrand.xyz feel, 22 Oct 2026), all in `components/motion/`, no extra libraries:
a drifting mono glyph field behind the home hero that lights up rose gold around the cursor (24 fps cap, paused
off-screen, still frame on touch screens); a staggered entrance for the hero; blocks that fade and rise as they
scroll in; the Featured card tilting toward the cursor with light across the metal; magnetic metal buttons; counting
stats. All of it switches off for visitors whose system asks for reduced motion, and content never depends on it.
The custom cursor was removed (Akash, 22 Oct 2026: it felt laggy); keep the normal system cursor. Reveals only
animate opacity and transform (no blur, which was slow), and fail open: a block is hidden only while the script is
watching it below the fold, so a page change or re-render can never leave a section blank.

## Brand decisions (locked)

| Item | Decision |
| --- | --- |
| Name | G2M |
| Meaning | Gwei 2 Merchant (fixed). "Go 2 Market" was considered and dropped from the logo; "Gains 2 Moments" was rejected |
| Tagline | Spend your bags better. |
| Sub-line | From on-chain to checkout. |
| Logo | "Coin x Card": a coin overlapping a card. Platinum coin, rose gold card |
| Finish | Rose gold (chosen over Pearl Champagne) |
| Modes | Light (pearl tile, #F7F5F0 page) and dark (obsidian tile, #0A0A0C page), with a toggle |
| Fonts | Inter Tight for UI and headlines, Roboto Mono for labels and data |
| Look | Premium metal-card feel; layout inspired by zerobrand.xyz (mono bracket labels, big type, lots of space) |

Rejected along the way, so do not bring them back: the neon blue/mint isometric logo (the old logo), lime and
emerald greens, Kite-style green (too close to a card brand G2M ranks), flat bright colourways, the "Market M"
and "Card Stack" marks, the "#1 crypto card directory" claim (cannot be backed up by a new site).

Design exploration lives in the claude.ai artifact "G2M Brand Exploration" (rounds 1 to 7):
https://claude.ai/artifact/Ea7SgPvFWucUhaW9L8FpYF Logo files are in
`public/brand/`.

## Research (version 1 data)

20 cards in `data/cards.json`, each with sources and a last-checked date. Main sources: issuer sites and help
pages, and DefiLlama's crypto card dataset.

| Card | Custody | Network | India / UAE |
| --- | --- | --- | --- |
| Crypto.com Visa Card | custodial | Visa / Mastercard | unknown / unknown |
| Bybit Card | custodial | Mastercard | unknown / unknown |
| Coinbase One Card | custodial | Amex | no / no |
| Bitget Wallet Card | not published | Visa | unknown / no |
| KAST Card | not published | Visa | yes / unknown |
| RedotPay Card | custodial | Visa | unknown / yes |
| ether.fi Cash Card | self-custodial | Visa | unknown / yes |
| MetaMask Card | self-custodial | Mastercard | unknown / unknown |
| Nexo Card | custodial | Mastercard | no / no |
| Krak Card | not published | Visa / Mastercard | unknown / no |
| MEXC Card | not published | Visa | unknown / yes |
| Gnosis Pay Card (removed 22 Oct 2026) | self-custodial | Visa | no / no |
| Jupiter Card | not published | Visa | unknown / yes |
| Avalanche Card | self-custodial | Visa | unknown / unknown |
| Solayer Card | self-custodial | Visa | unknown / unknown |
| Wirex One Card | self-custodial | Visa | unknown / yes |
| Bleap Card | self-custodial | Mastercard | no / no |
| Tangem Pay | not published | Visa | unknown / unknown |
| Ethena Pay | self-custodial | Visa | unknown / yes |
| Exa Card | self-custodial | Visa | yes / yes |

### Version 2 additions (22 Oct 2026)

Akash asked for DefiLlama's top 20 cards by spend volume to be covered first. 11 were already listed. 8 were added
and Gate Card was then taken off again (Akash's call), leaving 27 cards (26 after Gnosis Pay was removed). None of the original 20 were removed: volume rankings under-count custodial exchange cards (Crypto.com,
Coinbase, Bybit), which settle off-chain. Every figure below comes from the issuer's own site, docs or help center.

| Card | Custody | Network | India / UAE |
| --- | --- | --- | --- |
| Plasma One | self-custodial | Visa | unknown / unknown |
| Tria Card | self-custodial | Visa | unknown / unknown |
| COCA Card | self-custodial | Visa | unknown / unknown |
| Avici Card | self-custodial | Visa | no / yes |
| Kolo Card | not published | Visa | unknown / yes |
| Tuyo Card | self-custodial | Visa | unknown / unknown |
| Karta.io Card | self-custodial | Visa | unknown / unknown |

Notes for the next data check:
- **Karta**: Karta.io is the right Karta (Akash, 22 Oct 2026). Karta at conkarta.com, #4 on DefiLlama, stays off
  the site: it is a US charge card backed by brokerage assets, with no crypto involved.
- **Gate Card**: removed by Akash on 22 Oct 2026. Do not add it back unless he asks.
- **Tria**: prices (Lite $20, Pro $109, Max $250 a year) and perks come from screenshots of the Tria app that Akash
  sent on 22 Oct 2026; the website does not publish them. The app says Lite pays 0.5% after $1,000 a month; the
  help center still says 1%. The app was used.
- **Kolo**: rebuilt from help.kolo.xyz (Akash pointed to it, 22 Oct 2026). Cashback is 2% for 30 days, then 1%,
  capped at $100 a month. Every card payment pays a 1% conversion fee, even though the homepage says "0% markups".
  Cards are virtual only; physical cards are planned for 2027.
- XPL (Plasma) and COCA token ids for live staking values were not added (CoinGecko lookup was throttled).

Tria's full country list (22 Oct -> 23 Oct 2026): Akash sent 16 screenshots of the Tria app's "Country of
Residence" picker (A-Z) plus the tail as pasted text; 229 of 250 tracked countries are listed, so the 21 missing
(Antarctica, Belarus, China, Cuba, Egypt, India, Iran, Iraq, Israel, Myanmar, Nepal, Nicaragua, North Korea,
Russia, Sri Lanka, Syria, Togo, Turkiye, Ukraine, Venezuela, Vietnam) are "no". Source: "Tria app: Country of
Residence picker (sign-up)". Raised Tria's score from 57 to 67 (rank unchanged, #2) since countries were previously
not published (0 Coverage points); India flips from "unknown" to confirmed not available.

Cards Akash had on his radar but not yet added: PEXX, Fizen, Infini, Cashi, WasabiCard, Kite.
Akash does not write about Klickl, UPay, Tangem or Hotcoin on X. Klickl, UPay and Hotcoin were left off the site.
Tangem Pay stays: Akash decided on 22 Oct 2026 that it belongs in the directory even though he does not post about it.
Not posting about a card is not a reason to leave it out; the directory aims to be complete.

## What version 1 does

- Home: headline, search, Featured spot, top 5 for the visitor's country (its last column is that country, or a
  country count when unknown), browse chips, region panels (the visitor's country, US, UK, EU / EEA, Asia), links
  to the tools.
- Rankings (`/cards`): sort by any column incl. # (overall rank; shift-click for a second sort), filters for region, custody, network,
  minimum cashback, no annual fee, physical, metal, lounge. Every view has its own URL, with "Post on X" and
  "Copy link". The region defaults to where the visitor is. Pick up to 3 cards to compare. On phones it shows a list.
- Card pages (`/cards/<slug>`): key facts, G2M score breakdown, availability for 5 markets, tiers table,
  pros and cons, sources, similar cards, JSON-LD, and a social share image per card.
- Compare (`/compare?c=a,b,c`), Card finder (3 questions, `/finder`), Rewards calculator (`/calculator`, yearly
  value after plan, FX and per-purchase fees), Methodology, Submit a card (prepares an email), 404, sitemap, robots.
- `/go/<slug>` sends visitors to the card's site with UTM tags, or to `links.affiliate` when one is added.
- G2M score: rewards 25, fees 30, coverage 20, banking features 15, control 10 (rules v3 below). Unpublished figures
  score 0.
  Since 22 Oct 2026 rewards use cashback minus any fee charged on every purchase (`fees.txPct`); only the part of
  that fee larger than the cashback, plus flat and small-purchase fees, counts in the fees section. Small-purchase
  fees live in `fees.smallPurchase` (feeUsd, underUsd, foreignOnly) and the calculator applies them at the
  visitor's typical purchase size. This moved MEXC from #1 to #2 (Ethena Pay #1).
  No paid rankings, ever. Since 22 Oct 2026 the home page hero is a "Featured" spot: a sponsor booked in the
  sheet's Sponsor tab, which the sync writes to `data/sponsor.json` (slug, start, end; labelled Sponsored, shows
  its real score and rank, clicks tagged
  utm_campaign=sponsored), otherwise the top-ranked card. The home page re-checks hourly, so bookings start and end
  on their dates without a deploy. Move Vercel to Pro before the first paid booking (Hobby is non-commercial).
- Plausible analytics events when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set.

Tested before handoff: every route, light and dark, desktop and phone widths (no sideways scrolling), filters,
compare, finder, calculator input checks, theme memory, share images, and a clean `npm ci && npm run build`.

## Card data in a Google Sheet (22 Oct 2026)

Akash picked this first for version 2 so he can edit cards himself. The Google Sheet becomes the master copy;
`.github/workflows/sheet-sync.yml` copies it to `data/cards.json` and `data/sponsor.json` every hour, publishing
automatically when every card passes the build checks (Akash chose automatic over approving each change). Bad
data never reaches the site: the run stops and opens a `sheet-sync` issue listing the tab, card and column to fix.
Akash created the sheet "G2M Card data" (https://docs.google.com/spreadsheets/d/1MEa-pk0sYr6EJWT6nLHNJcl68EwSLg4sf_sjkKtA0pw)
on 22 Oct 2026; Claude filled it from `npm run sheet:export`, set every cell to plain text, added a "How to edit"
tab, and recorded the tab ids (gid) in `data/sheet.json`. The live sheet was checked to match cards.json exactly. The sheet must be shared
"Anyone with the link can view". Converter: `scripts/sheet-format.mjs`; it round-trips all cards unchanged.

## Real card pictures (22 Oct 2026)

Akash asked for real card pictures. Cards tab column "Card image" takes a link; the hourly sync
(`scripts/card-images.mjs`, using sharp) downloads it once, trims a plain border, and stores WebP (1000 and 184 wide)
plus a PNG for share images in `public/card-images/`, named from the link so a new link means a new file; unused
files are deleted. `CardArt` shows the picture everywhere (hero, card page, rankings, compare, finder, calculator,
share image) and falls back to the metal art. Upright pictures are fitted inside the card shape with the shadow
following the picture. Source pictures only from issuer press kits or from the issuer directly (the outreach email
asks for one); remove any picture an issuer asks us to take down.

## Bug sweep (22 Oct 2026, pull request #10)

Akash asked for small bugs first. Every page (all 26 card pages included) was checked on phone, tablet and desktop,
light and dark, with an automatic sweep (sideways scrolling, broken images and links, script errors, hidden
sections) plus screenshots read by eye. Fixed:
- Card page score: "/100" was clipped. Metal gradient text only paints inside its box, so tight letter-spacing cuts
  the last glyph; that span gets `paddingRight`. Do not add a negative margin to `.metal-text`: it made the hero
  headline wrap "bags / better." onto two lines.
- Card page: the country count was repeated when the description already contained it.
- Calculator: plans only offered elsewhere (Exa and Avalanche US-only tiers) were picked for other markets. It now
  leaves out tiers not offered in the chosen market (EU = any EEA country). Phones also see "You keep $X a year".
- Home top 5 fits phones (fee columns hidden there), methodology score table stacks on phones, phone menu scrolls
  to the current page and fades its edge, "Custody not published" wording, "#1 of 26 worldwide" on the Featured spot.

Known, left for later (bigger than small bugs): the tiers table on card pages and the Compare table still scroll
sideways on phones.

## Every country in the finder and calculator, with FX at home (22 Oct 2026, pull request #10)

Akash: the finder and calculator must offer every country, because someone in the US or EU spending dollars or
euros pays no FX fee. Both tools now list all 250 countries (starting on the visitor's own). Each country has an
everyday currency (`lib/currencies.mjs`). Cards carry `fees.fxByCurrency` (currencies with no or a lower FX fee,
sheet column "No-FX currencies", e.g. `USD 0; EUR 0`) and `fees.fxHome` (billed in the holder's own currency,
MetaMask). `lib/fx.ts` works out FX on spending at home: none when the card bills in that currency, the card's FX
fee otherwise, and the FX fee when the issuer does not say (Solayer, COCA). The calculator charges FX on home
spending plus the "other currencies" share; the finder uses country scores and mentions FX at home.

Research (22 Oct 2026, issuer pages only; Card Map used for leads): 17 cards bill in US dollars only; ether.fi and
Kolo are free in USD and EUR; Crypto.com, Krak and Bybit bill in the region's currency (union stored); Nexo charges
0.2% on EEA, UK and Swiss currencies; Wirex and Bleap charge no FX at all. FX figures corrected from issuer pages,
which moved ranks: Crypto.com 0% to 3% (US non-USD on the lower tiers; #5 to #15), Coinbase One not published to 0%
(#18 to #11), Karta not published to 1% (#26 to #21), Avalanche US tier 1% to 2% (card agreement). Known gaps the
single FX number does not capture: cross-border fees on USD at foreign merchants (Tuyo, Exa, Avalanche, US Krak,
MetaMask free tier) and per-region card currencies (stored as a union of currencies).

## Scoring rules v2 (22 Oct 2026, Akash's exact rules)

`lib/score.ts`, explained on /methodology. Changed from version 1:
- Rewards: the entry tier's ongoing rate (no intro offers) on a $1,000 test basket (1 x $200, 2 x $100, 4 x $50,
  8 x $25, 20 x $10; 35 purchases), so bands and caps count; minus `fees.txPct`; 40 x min(net / 5%, 1). Only an
  "up to" rate and no entry-tier base rate scores 0 (was 40% of the headline rate).
- Other transaction costs (8): monthly cost on the basket of the per-purchase % fee above the cashback, flat fees
  x 35, top-up fee, and small-purchase fees on basket sizes below the limit ($0 = 8, up to $10 = 4, more = 1). A
  small-purchase fee charged only on foreign purchases is not counted (the basket is home spending; FX is scored on
  its own). Not published (top-up fee unknown) = 0.
- Annual and card-access costs (10): entry-tier yearly fee plus `fees.cardFeeUsd` (one-off fee to get the card,
  sheet "Card activation fee $"); optional physical card shipping is not counted here.
- Physical card (4 in Coverage): physical card 3, +1 when `fees.physicalCardFeeUsd` (sheet "Physical card cost $
  (issuance + shipping)") is under $50; virtual-only 0.
- Countries (12): confirmed countries from the issuer list, else the five checked markets (EU = 30 EEA countries):
  100+ = 12, 50-99 = 10, 20-49 = 8, 5-19 = 5, 1-4 = 2, 0 = 0. The issuer-stated count (`coverage.countries`) is
  shown on the site but no longer scored. Per-country view unchanged (confirmed 12, not confirmed 5).
- Not published scores 0: annual fee, FX fee, top-up fee, wallets, custody (was a middle score).
Big moves on the first run: MEXC #2 to #15 and Bybit #3 to #21 (no published entry-tier rate), Crypto.com to #25.
Many cards lose the 8 transaction-cost points only because their top-up fee is not published yet; filling the
sheet's "Top-up fee %", "Card activation fee $" and "Physical card cost $" columns will move them back.

## Scoring rules v3 (24 Oct 2026, Akash's exact rules) — IN PROGRESS, do not merge yet

The code is done (`lib/score.ts`, /methodology, card pages, compare page, sheet columns). The card data is not
filled in yet, so every card currently scores 0 for Banking features. Do not merge the pull request until the data
below is in. Akash will say "start" in a new session to finish it.

Rules (as built):
- Rewards 25: 25 x min(entry-tier ongoing cashback on the $1,000 basket / 3.5%, 1). Bands and caps apply; intro
  offers left out; "up to"-only = 0. Fees no longer reduce rewards.
- Fees 30: annual and card-access 10 (free 10, up to $100 6, up to $300 3, more 0); FX 12 (0% 12, up to 1% 9, up to
  2% 5, more 2); other transaction costs on the basket 8 ($0 8, up to $10 6, up to $20 3, up to $30 1, more or not
  published 0). Costs = per-purchase % + top-up % + flat fee x 35 + small-purchase fees. In a country view, when the
  card does not bill in that country's currency, its FX fee and foreign-only small-purchase fees are added.
- "No per-purchase fee listed" on a published fee schedule = $0, not "not published". Not published only when there
  is no fee schedule at all, or a fee is said to apply without the amount. A refundable activation top-up = $0.
- Coverage 20: countries 12 (unchanged), Apple Pay 2, Google Pay 2, physical card 3 (+1 under $50).
- Banking features 15 (`ecosystem` in cards.json; sheet columns "IBAN / bank account" (named/shared/none), "Bank
  payout currencies" (number), "Fiat on/off-ramp" (both/on/off/none), "Crypto-backed credit" and "Yield on balance"
  (yes/no)): IBAN named 3 / shared 2; payouts 2+ currencies 3 / 1 = 1.5; ramps both 3 / one way 1.5; credit 3;
  yield 3. Empty = not confirmed = 0.
- Control 10: self-custodial 10, custodial 5, not published 0.

Research done on 24 Oct 2026 (issuer sources only, with quotes), saved in `docs/research/scoring-v3/`:
- `custody-markets.json`: custody for Bitget Wallet, KAST, Krak, MEXC, Jupiter (custodial) and Tangem Pay, Kolo
  (self-custodial); India/UAE checks (Wirex One UAE yes; Crypto.com, Jupiter India, Plasma stay unknown). Wirex's
  country list moved to https://wirexone.freshdesk.com/support/solutions/articles/76000088412 (old URL is 404):
  refresh the Wirex country list from it.
- `country-lists.json`: lists for Kolo, KAST, Coinbase One, Avalanche, Solayer, Bleap, Tangem Pay, Karta, Tuyo.
  Decisions: Tangem Pay UK/EU stay "unknown" (not "no"); Kolo keep UK and UAE yes, EU becomes unknown (no EEA
  country named). Keep the Ethena and Tria lists as they are.
- `fees-eco-2.json` (Krak, MEXC, Jupiter, Avalanche, Solayer, Wirex One, Bleap, Tangem Pay, Ethena Pay) and
  `fees-eco-3.json` (Exa, Plasma One, Kolo, Karta, Tria, COCA, Avici, Tuyo): top-up, per-purchase, flat and
  small-purchase fees, card fee, physical card cost and the 5 banking features, each with a source.
- NOT done: the same fees and banking research for Crypto.com, Bybit, Coinbase One, Bitget Wallet, KAST, RedotPay,
  ether.fi, MetaMask and Nexo (the helper was stopped before saving).

Corrections the research found (apply with the data):
- Exa FX 1.5% (site says 3%). Avici FX 0% markup (Visa may add 0.4-1%). Krak FX 0% in the UK/EEA, 1% on the US card.
- MEXC has no physical card ("Physical cards are not available at this time"): remove physical from its forms.
- Karta: bank payouts now "coming soon"; ATM 1 USDT + 2.5%; plastic card 99 USDT plus unpublished shipping.
- Solayer's restricted list includes India, UAE, UK and most EU countries.
- Tangem Pay physical delivery is now $28.82+ (not $17.44) and its FAQ says physical "is not available yet".

Values to flag to Akash before publishing: Tria card fee (conflicting pages, left empty), Plasma top-up (0.15-0.75%
by asset; 0.15 used), Karta and COCA physical cost (shipping not published), Avici credit (separate credit line,
partly "coming soon"), Ethena payout currencies (not published) and Daily Boost counted as yield (Ethena says "not
yield"), MEXC yield (campaign Earn product), Avalanche FX (1% / 2% / 3% on different pages; keep 3).

Next steps when Akash says "start":
1. Finish the fees and banking research for the 9 cards above.
2. Apply all research to the Google Sheet (Cards, Country lists and Sources tabs; sources dated when checked,
   "Last checked" updated), then check with `node scripts/sheet-sync.mjs --check`.
3. `npm run validate` and `npm run build`; show Akash the 26-card ranking table (v2 vs v3, with part scores)
   before marking the pull request ready.
4. Update the sheet's "How to edit" tab and CLAUDE.md for the 5 banking columns.

## Security

`package.json` pins PostCSS to 8.5.31 or later with an npm `overrides` entry (22 Oct 2026). Next 15 ships PostCSS
8.4.31, which has known advisories; npm's own fix was a jump to Next 16. The override clears `npm audit` while
staying on Next 15. Remove it when the site moves to a Next version that ships a patched PostCSS.

## Still open

1. Done 22 Oct 2026: live on Vercel (Hobby plan, project `g2m`) at https://g2m.life. www.g2m.life 308-redirects to
   g2m.life. DNS stays at Hostinger: A `@` 216.198.79.1, CNAME `www` to Vercel, two `_vercel` TXT verification
   records. All email records (Google Workspace MX/SPF/DKIM, Hostinger mail CNAMEs, DMARC) were left untouched.
2. Settings now default to info@g2m.life and @0akash0x; override them on Vercel only if they change.
3. Add referral links per card when deals are signed (sheet column "Referral link"). Move Vercel to the Pro plan
   first (Hobby is non-commercial only); also before the first paid Sponsored booking.
4. Re-check every card within 90 days of its `lastChecked` date (the validator warns).
5. Run the sheet sync once on GitHub (Actions > Sync cards from Google Sheet > Run workflow) to confirm it works
   there; it was tested locally against the live sheet. The hourly check uses roughly 720 GitHub Actions minutes a
   month (2,000 free on a private repo).
6. Send the issuer outreach and add the answers (country lists, fees, card pictures) through the sheet.

## Ideas for version 2 (not decided, ask Akash)

Done so far: edit card data from a Google Sheet, real card pictures, small bug sweep, every country in the finder
and calculator with FX at home.

- Add the radar cards above, then grow towards 50+ cards.
- Phone-friendly tiers and Compare tables.
- Show the live USD value of staking requirements (each tier's `stake.coingeckoId` is already stored for this).
- "X vs Y" comparison pages for SEO, and short guides (custodial vs self-custodial, how card fees work).
- A changelog of fee and cashback changes per card, which also feeds his X posts.
- Email sign-up for card updates.
