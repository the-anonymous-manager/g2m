# G2M handoff: everything decided so far

Written 22 Oct 2026 at the end of the version 1 build. Read this with `CLAUDE.md` before starting version 2.
The owner, Akash, is not a developer: explain in plain words and do the technical steps yourself.

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
| Gnosis Pay Card | self-custodial | Visa | no / no |
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
and Gate Card was then taken off again (Akash's call), leaving 27 cards. None of the original 20 were removed: volume rankings under-count custodial exchange cards (Crypto.com,
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

Cards Akash had on his radar but not yet added: PEXX, Fizen, Infini, Cashi, WasabiCard, Kite.
Akash does not write about Klickl, UPay, Tangem or Hotcoin on X. Klickl, UPay and Hotcoin were left off the site.
Tangem Pay stays: Akash decided on 22 Oct 2026 that it belongs in the directory even though he does not post about it.
Not posting about a card is not a reason to leave it out; the directory aims to be complete.

## What version 1 does

- Home: headline, search, Featured spot, top 5 (its last column is the visitor's market, or a country count when
  unknown), browse chips, cards confirmed in all five markets (the visitor's first), links to the tools.
- Rankings (`/cards`): sort by any column incl. # (overall rank; shift-click for a second sort), filters for region, custody, network,
  minimum cashback, no annual fee, physical, metal, lounge. Every view has its own URL, with "Post on X" and
  "Copy link". The region defaults to where the visitor is. Pick up to 3 cards to compare. On phones it shows a list.
- Card pages (`/cards/<slug>`): key facts, G2M score breakdown, availability for 5 markets, tiers table,
  pros and cons, sources, similar cards, JSON-LD, and a social share image per card.
- Compare (`/compare?c=a,b,c`), Card finder (3 questions, `/finder`), Rewards calculator (`/calculator`, yearly
  value after plan, FX and per-purchase fees), Methodology, Submit a card (prepares an email), 404, sitemap, robots.
- `/go/<slug>` sends visitors to the card's site with UTM tags, or to `links.affiliate` when one is added.
- G2M score: rewards 40, fees 30, coverage 20, control 10. Unknown figures score below known good ones.
  Since 22 Oct 2026 rewards use cashback minus any fee charged on every purchase (`fees.txPct`); only the part of
  that fee larger than the cashback, plus flat and small-purchase fees, counts in the fees section. Small-purchase
  fees live in `fees.smallPurchase` (feeUsd, underUsd, foreignOnly) and the calculator applies them at the
  visitor's typical purchase size. This moved MEXC from #1 to #2 (Ethena Pay #1).
  No paid rankings, ever. Since 22 Oct 2026 the home page hero is a "Featured" spot: a sponsor booked in
  `data/sponsor.json` (slug, start, end; labelled Sponsored, shows its real score and rank, clicks tagged
  utm_campaign=sponsored), otherwise the top-ranked card. The home page re-checks hourly, so bookings start and end
  on their dates without a deploy. Move Vercel to Pro before the first paid booking (Hobby is non-commercial).
- Plausible analytics events when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set.

Tested before handoff: every route, light and dark, desktop and phone widths (no sideways scrolling), filters,
compare, finder, calculator input checks, theme memory, share images, and a clean `npm ci && npm run build`.

## Security

`package.json` pins PostCSS to 8.5.31 or later with an npm `overrides` entry (22 Oct 2026). Next 15 ships PostCSS
8.4.31, which has known advisories; npm's own fix was a jump to Next 16. The override clears `npm audit` while
staying on Next 15. Remove it when the site moves to a Next version that ships a patched PostCSS.

## Still open

1. Done 22 Oct 2026: live on Vercel (Hobby plan, project `g2m`) at https://g2m.life. www.g2m.life 308-redirects to
   g2m.life. DNS stays at Hostinger: A `@` 216.198.79.1, CNAME `www` to Vercel, two `_vercel` TXT verification
   records. All email records (Google Workspace MX/SPF/DKIM, Hostinger mail CNAMEs, DMARC) were left untouched.
2. Settings now default to info@g2m.life and @0akash0x; override them on Vercel only if they change.
3. Add referral links per card when deals are signed. Move Vercel to the Pro plan first (Hobby is non-commercial only).
4. Re-check every card within 90 days of its `lastChecked` date (the validator warns).

## Ideas for version 2 (not decided, ask Akash)

- Add the radar cards above (27 listed as of 22 Oct 2026), then grow towards 50+ cards.
- Edit card data from a Google Sheet instead of `cards.json`.
- Show the live USD value of staking requirements (each tier's `stake.coingeckoId` is already stored for this).
- "X vs Y" comparison pages for SEO, and short guides (custodial vs self-custodial, how card fees work).
- A changelog of fee and cashback changes per card, which also feeds his X posts.
- Email sign-up for card updates.
