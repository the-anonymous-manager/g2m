# G2M handoff: everything decided so far

Started 22 Oct 2026 at the end of the version 1 build; last updated 25 Oct 2026 (pull request #21: receipt matching, nomad mode, per-purchase caps). Read this
with `CLAUDE.md` before changing anything. The owner, Akash, is not a developer: explain in plain words and do the
technical steps yourself.

## Where things stand (quick summary)

- Live at https://g2m.life (Vercel, from `main`). 26 cards. Work happens on the branch `claude/great-lamport-3kjmvq`
  and goes live through a pull request that Akash merges; pushing straight to `main` deploys the site. Pull requests
  #1 to #20 are merged; #21 (receipt matching plus nomad mode) is waiting for Akash.
- Card data is edited in the Google Sheet "G2M Card data" (see "Card data in a Google Sheet"). An hourly GitHub
  Action copies it to the site. Claude edits the sheet, not `data/cards.json`, for data changes, then checks with
  `node scripts/sheet-sync.mjs --check`.
- Scoring is v3 (rewards 25, fees 30, coverage 20, banking features 15, control 10), see "Scoring rules v3".
- Pages and tools: rankings, card pages (score, tier break-even with live staking check, every country by region,
  banking features, link to the swipe receipt), card finder, rewards calculator (best card / tiers of one card /
  line by line; one-line wallet summary on top), wallet builder (`/wallet`, best 2-card combo with must-haves), swipe
  receipt (`/receipt`, three currencies, share picture with @0akash0x and g2m.life), corridor and IBAN finder
  (`/corridors`), compare, methodology, submit.
- Live data: token prices (CoinGecko) and exchange rates (open.er-api.com, CoinGecko fallback), cached one hour
  (`lib/prices.ts`). To see them when testing in a Claude cloud session, build and start with `NODE_USE_ENV_PROXY=1`.
- Real card pictures come from the sheet's "Card image" column: all 26 cards have one (25 Oct 2026, pictures Akash
  sent). Originals are in `public/card-originals/`; renders that were not card-shaped were fitted to 1.586, tilted
  or framed photos were cut out and straightened (Krak, Karta, Avalanche, Tangem Pay, Bleap, Ethena Pay).
- Outreach to card issuers (email, DM, per-card gaps, how to sell the Sponsored spot) is in the Claude Doc
  "G2M card issuer outreach": https://claude.ai/artifact/96NsBhL6naMwqvFJctKpt5

## Next session (agreed with Akash)

1. Moving hosting to Cloudflare Workers, in progress (25 Oct 2026). g2m.life's DNS already moved to Cloudflare
   (nameservers changed at Hostinger; email and the site both kept working through it, everything left "DNS only"
   so Vercel still serves the live site). The OpenNext adapter is built and tested locally (see "Cloudflare Workers
   migration" below); still needed: a Cloudflare API token in this environment's secrets (Network secrets / API
   credentials in the cloud session's settings) to actually deploy and get a `workers.dev` test link, then Akash
   checks that link, then the `A`/`www` records switch from Vercel to the Worker.
2. Crypto.com's `assets` list holds only CRO, so the corridor finder now says "No" for USDC and USDT on it. Its
   top-up coin list is only in the app; confirm it with Crypto.com and add the stablecoins if they are accepted.

## Cloudflare Workers migration (25 Oct 2026, in progress)

Moving off Vercel for cost (avoids Vercel Pro) and security (Cloudflare's DDoS protection and firewall, free). The
site runs on Cloudflare Workers via the `@opennextjs/cloudflare` adapter, with no database or KV/R2 needed — every
route that used to be statically prerendered (ISR) is now rendered fresh per request instead (see below), so there
is nothing for the Worker to persist between requests.

- `wrangler.jsonc`: the Worker's config (name `g2m`, `nodejs_compat` flag, static assets from `.open-next/assets`).
- `open-next.config.ts`: OpenNext's own config, left at its defaults.
- New npm scripts: `cf:build`, `cf:preview` (builds, then serves it locally via `wrangler dev`, for testing),
  `cf:deploy` (builds, then `wrangler deploy` — needs the API token above).
- **Why four routes had to stop being static (ISR):** `/`, `/cards/[slug]`, and their two share-picture routes used
  `export const revalidate` / `generateStaticParams`, which needs a persistent cache (R2 or KV) to serve the
  prerendered HTML on Cloudflare; without one, they 404'd or 500'd in local testing. They now use
  `export const dynamic = 'force-dynamic'` instead, rendered fresh every request — the same way `/calculator`,
  `/compare` and most of the site already worked. This is a strict improvement for the home page's Sponsored-spot
  check in particular (was re-checked hourly, now every request) and costs nothing in practice, since card data is
  bundled at build time either way and the hourly sheet sync already triggers a fresh deploy when data changes.
  Revisit this (an R2-backed incremental cache) only if Cloudflare bills or render times become a real problem —
  unlikely for a site this size.
- **Share pictures (`next/og`) needed two fixes for a host with no real filesystem at request time:**
  - The Inter font files (`assets/fonts/*.otf`) are embedded as base64 in `lib/og-fonts.generated.ts`, generated by
    `scripts/generate-og-fonts.mjs` (run automatically by `npm run build` and `npm run cf:build`; committed too, so
    a plain `next dev` or `next build` works without running it first). Neither `node:fs` nor the
    `fetch(new URL(..., import.meta.url))` pattern Next's own docs suggest worked on the actual Workers runtime in
    testing; embedding the bytes sidesteps path resolution entirely.
  - The card-detail share picture (`app/cards/[slug]/opengraph-image.tsx`) now fetches the card's photo from the
    site's own public URL (`absoluteUrl(...)`) instead of reading it off disk, for the same reason.
- Tested locally with `npm run cf:preview` (`wrangler dev` against the real OpenNext bundle): every page, every
  card page, both share-picture routes, the receipt share picture, `/go/<slug>` redirects and card picture assets
  all return the right status and content; checked in a browser (desktop and phone, light and dark) with no console
  errors and no sideways scroll; live prices came through. `cf-ipcountry` could not be tested locally (Cloudflare's
  local dev simulation fixes it to one sandbox value and does not let a client header override it, which is
  correct: a real visitor cannot spoof this header either — same property Vercel's `x-vercel-ip-country` has).
- Not done yet: an actual Cloudflare deploy (needs the API token), the `workers.dev` test link for Akash to check,
  and switching g2m.life's `A`/`www` DNS records from Vercel to the Worker once that checks out.

## Nomad / expat mode and per-purchase limits (25 Oct 2026, step B part 2, pull request #21)

- `/cards` and `/finder` have "My passport" + "Where I live" (`components/NomadBar.tsx`, `lib/nomad.ts`, URL
  `passport=` on /cards, `pp=` on /finder). A card shows when it is offered where you live, your passport is not on
  its blocked list, and either it accepts a residence ID there (`residency_id`) or it supports your passport country.
  Badges: "Eligible with <B> residency ID", "Takes passports from <A>", "Needs a supported passport — check <A> with
  the issuer", or "Residency rule not published — check with issuer". Card pages show "ID check for people living
  abroad" and "Citizens turned away".
- New Cards columns: "KYC eligibility rule" (`kycRule`: residency_id / passport_strict / both / empty) and
  "Restricted passports" (`restrictedPassports`: `US; IR`, `none`, empty), after "Bank account for non-residents".
  Researched on issuer pages for all 26 cards (quotes checked against the pages). 14 cards have a rule (9
  residency_id, 5 both); the other 12 publish none. US citizens are blocked where the card terms make you confirm you are not a US
  citizen (Exa, Tria, Avici, Karta, Avalanche, KAST non-US) and on Ethena Pay.
- Same research filled cash-out fees per rail, "Bank account for non-residents" (now 17 cards), USDC/USDT in
  `assets`, and rail fixes (e.g. KAST wire and SWIFT payouts, ether.fi SWIFT payouts and Fedwire, Jupiter payouts,
  Avici wire and SWIFT deposits, Plasma Fedwire).
- Coinbase One: owner-set banking features (ramps both, no IBAN, `USD_ACH in+out ($0)`), as its help pages block
  automated reading. Ethena Pay and MEXC yield and Avici credit kept as they were (owner's ruling).
- "Max cashback per purchase $" (`cashback.maxPerTxUsd`, Kolo 1), "Small purchase limit included"
  (`smallPurchase.inclusive`, RedotPay "$1.00 or less") and "Free small purchases a month" (`freePerMonth`, RedotPay 5).
  Used in the 35-purchase scoring basket (Kolo's $200 purchase earns $1), the calculator ("Lost to the per-purchase
  cap" line) and the receipt.
- Coverage fixes from the same research (Akash's go-ahead): Exa now uses its own card page (21 Sep 2026): 45 countries
  plus 31 US states, closed list, India, the UK and the EEA not offered (was 211 countries from an X post). MEXC: its
  User Agreement (13 Oct 2026) excludes residents of the UK, Singapore, Malaysia, Hong Kong, Kazakhstan, Belarus and
  Canada, so UK is now "no". Solayer: EU / EEA is now "no" (only Slovenia and Liechtenstein are open); the validator
  allows EU "no" while fewer than half of the EEA countries are open. COCA: kept UAE "yes", because its newest card
  article (12 Oct 2026) names the UAE (the older docs list says "which include"); added its top-up stablecoins
  (USDT, USDC, EURC, EURS).
- Corridor finder: a coin shows "No" when the card's coin list is known and leaves it out, "Not stated" only when
  the card has no coin list.
- ether.fi (Akash's link, 25 Oct): membership levels from its help pages. Core is free; Luxe $199/yr (or 5K points
  a month, $15K in Liquid, 30K ETHFI staked); Pinnacle $999/yr (or 25K points, $100K Liquid, 150K ETHFI); VIP can't be
  bought ($500K Liquid or 500K ETHFI). Cashback is now banded by monthly spend (Core 3% to $2K, 1% to $3K, then 0.5%;
  Luxe 3% to $10K, 1% to $20K; Pinnacle 3% to $50K, 1% to $80K; VIP 4% to $50K, rate above not published, so counted
  as 0). Paid in ETHFI. Free ATM withdrawals, card prices and Category Cashback per level updated. The tier
  break-even now works for ether.fi (Luxe beats Core from about $2,800 a month).
- Card pictures and issuer replies (25 Oct 2026): Akash sent pictures for Bitget Wallet, RedotPay, ether.fi, Bleap and
  Ethena Pay. Originals are in `public/card-originals/` and the sheet's "Card image" links point to
  `https://g2m.life/card-originals/<file>`, so they work once the pull request is merged and deployed (a sync run
  before that stops with a "link answered 404" issue that closes by itself). RedotPay's photo had white corners and
  Bleap's a dark backdrop; both were cleaned first (`redotpay.png`, `bleap.png`). RedotPay's team replied: fees, ATM
  limits, 3-year validity, Apple Pay confirmed; Google Pay not citable, so it is now "not confirmed" (it came from
  DefiLlama before), which costs RedotPay 2 points; the reply names no restricted passports or banking features.
  Nexo's team replied: eligibility is by residence, not nationality (kycRule residency_id, no restricted passports),
  cashback by loyalty tier (0.5% to 2% in NEXO, caps $50 to $200), personal IBAN, SEPA / FPS / SWIFT / ACH / Fedwire
  rails, 5-year validity. Nexo moves from 20th to 12th. Their coin list is still unnamed ("70+ cryptocurrencies").
  The per-purchase label now reads "at or under" and "first 5 a month free" where that applies.
- Card picture rule (25 Oct 2026, after the first five looked wrong): send the card flat and upright, landscape, front
  only. The site already tilts cards for effect, so a photo that is already tilted ends up twice as crooked, and an
  upright (portrait) card shows tiny in the list. Ethena Pay's and Bleap's tilted photos were straightened
  (`ethena-pay-flat.png`, `bleap-flat.png`) and RedotPay's upright card was laid sideways (`redotpay-landscape.png`) so
  the logo still reads. Keep the originals you straighten in `public/card-originals/` and link them from the sheet.
- Phone: the tiers table on card pages stacks into one block per tier, and the compare table puts each row's label
  above the card values, so neither scrolls sideways at 375 px.

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

## Corridor and IBAN finder (24 Oct 2026, step B part 1)

`/corridors` (`app/corridors`, `components/CorridorFinder.tsx`, `lib/corridors.ts`), linked from `/finder`, the home
tools and the footer: Move [USDC / USDT] to [EUR SEPA / USD ACH / GBP FPS / AED / INR / SWIFT, or any other currency in
the data], filtered to cards available where the visitor lives. Per card: cash out to a bank on that rail, receive
from a bank (account in your name / shared from `ecosystem.iban`), rail, fees and notes, non-residents, coin.
New sheet columns (Cards tab, after "Yield on balance"):
- "Banking rails" (`bankRails`): `RAIL in|out|in+out (fee or note)` separated by `;`, e.g.
  `EUR_SEPA in+out (out EUR 1); GBP_FPS out (1.95 GBP); SWIFT in ($30)`. Rail = currency_method (SEPA, ACH, WIRE, FPS,
  PIX, SPEI, UPI, BANK) or SWIFT. `none` = no bank rails; empty = not confirmed. No `;` inside the brackets.
- "Bank account for non-residents" (`bankForNonResidents`): yes / no / empty (not published). Only COCA is set (no:
  IBAN for EEA and UK residents).
Filled for 24 cards from the 24 Oct issuer research (`docs/research/scoring-v3/fees-eco-*.json`, sources already on
each card). Not confirmed: Coinbase One (help pages blocked), Ethena Pay (IBAN currency and payout currencies not
published). Most cash-out fees and non-resident rules are not published yet: fill them during step B research
(next: #2 Nomad / Expat mode with "KYC eligibility rule" and "Restricted passports").

## Wallet builder and receipt pages (24 Oct 2026)

Akash: the receipt needs its own page with an automatic share picture (G2M's X handle on one side, the site on the
other), and the 2-card wallet is a headline feature that should weigh more than cashback.
- `/receipt` (`app/receipt`): the swipe receipt for any card, settings in the link (`card, tier, amt, cur, what,
  base, show, home`; `lib/receipt-params.ts`). Three currencies: the card's base currency (`baseCurrencies` in
  `lib/swipe.ts`: 0% FX currencies, the holder's own on cards billed in it, else the lowest listed), "paid in" (FX and
  foreign-only fees apply when it differs from the base) and "show receipt in" (all amounts converted).
  Exact matching (25 Oct 2026, Akash's real KAST swipe: INR 1,827 = $19.53 cleared + $0.10 low-value fee = $19.63,
  cashback $0.29): everything is worked out in the card's base currency, each line is rounded to the cent and the
  totals are sums of the rounded lines. A "= Cleared amount (price + FX)" sub-line shows what card apps call the
  transaction amount (FX hidden in the rate). "Match a real swipe" takes the app's cleared amount (`cleared=`), total
  charged (`total=`) or exchange rate (`rate=`, shop currency per 1 base, before FX) and works the price back from it:
  cleared 19.53 / 1.02 = $19.15 + FX $0.38 + $0.10 = $19.63. Empty = live mid-market rate (can differ from the card
  network's rate on the day by a few cents). Cashback is now on the cleared amount (price + FX), as card apps do. Its share preview is `/receipt/image?...` (`app/receipt/image/route.tsx`, 1200 x 630,
  next/og): the receipt, the real result, `site.twitter` (NEXT_PUBLIC_TWITTER_HANDLE, now @0akash0x) on the left and
  the site on the right. "Download image" saves the same PNG. Card pages link to it (`#receipt`); the calculator no
  longer embeds it.
- `/wallet` (`app/wallet`, `components/WalletBuilder.tsx`, `lib/combo.ts` `planWallet`): must-haves (lounges from tier
  perks, yield, borrowing, bank account, bank payouts, self-custody, physical card, Apple/Google Pay; `lib/features.ts`)
  that the two cards must cover between them; every pair x splits x tier combinations; top 3 pairs. The answer is
  compared with the best single card that has every must-have: if no pair beats it, the page says one card does it.
  In the menu, footer, home tools and sitemap. The calculator shows a one-line summary above its leaderboard that opens
  the builder with the same settings.

## Unique tools, step A (24 Oct 2026)

- Real swipe receipt (`lib/swipe.ts`, `components/SwipeReceipt.tsx`) on `/calculator` and every card page
  (`#receipt`): presets ($10 coffee, $20 subscription, $50 dinner, $200 flight or hotel, shown in the visitor's own
  currency) or any amount and currency. Lines: price, per-purchase %, flat fee, small-purchase fee (US-dollar limit;
  foreign-only applies when the card does not bill in that currency), FX fee (`fxIn`), top-up fee, cashback (entry band
  rate), paid at the till, real cost, net %. "Post receipt on X" links to `/cards/<slug>?amt=&cur=&tier=&what=#receipt`,
  which reopens the same receipt. Exchange rates: open.er-api.com, CoinGecko as fallback (`lib/prices.ts`, cached 1h).
- Tier break-even box above every multi-tier card's Tiers table (`components/TierBreakEven.tsx`): monthly spend where
  each tier beats the entry tier (`breakEvens(..., 'entry')`, ongoing rates, caps and fees, all spend in the card's
  currency), plus a staking check for tiers with a stake: live USD value (CoinGecko, one shared request, cached 1h;
  card pages now refresh hourly), a -25% token drop, and months of extra cashback to earn it back at the visitor's
  spend (the yearly fee is left out when staking replaces it). CoinGecko IDs added in the sheet: Plasma XPL `plasma`,
  COCA `coca` (checked: coingecko.com/coins/coca links to coca.xyz).
- Best 2-card wallet on `/calculator` (best-card view; `lib/combo.ts`): spending is split into slices (own currency /
  US dollars / travel x purchase sizes, `buildSegments`); every pair of cards is tried with set splits (small
  purchases, other currencies, both, travel only, US dollars only, under $50) and a slice-by-slice split, each card at
  its best tier for its share, both yearly fees in full. Shown only when the pair beats the best single card by $1+.
- Local testing: Node's fetch here ignores the sandbox proxy; build and start with `NODE_USE_ENV_PROXY=1` to see live
  prices (Vercel needs nothing).

## Card pages: every country by region (24 Oct 2026)

"Where it works" keeps the five checked markets; its "See all N countries" button opens (and closes again) a
full-width "Countries" section, closed at first (a link to `#countries` opens it): counts (available,
not available, not confirmed), the visitor's own country, a "Check a country" search, every available country grouped
by region (`lib/continents.mjs`, all 250 codes), and the not-available list behind a toggle. Statuses come from
`availabilityIn` (the issuer's list, else the five markets), the same as rankings.

## Calculator v2: three views, currency split, small-purchase fix (24 Oct 2026)

Bug fixed (Akash's test: `/calculator?country=IN&spend=100&foreign=0&ticket=100` vs `ticket=5`): foreign-only
small-purchase fees (KAST: $0.10 on non-USD purchases under $25) used the raw "other currencies" share, so someone in
India paying in rupees on a dollar card paid nothing. Now every foreign-only fee uses the same rule as FX: a purchase
is foreign unless the card bills in that currency (`billedIn` in `lib/fx.ts`). KAST at $5 purchases: $24 a year
(240 x $0.10), "You keep" drops by the same $24; at $100 purchases: $0. The score's basket cost uses the same rule.

`/calculator` (all settings in the URL, so any view can be shared):
- Views (`mode`): best card for me (leaderboard; best tier or `tiers=entry` for entry and free tiers only), compare
  tiers of one card (`mode=tiers&card=`; side by side plus the monthly spend where each dearer tier pays off, found
  numerically up to $100,000 a month), one card line by line (`mode=audit&card=&tier=`; yearly, monthly and
  per-purchase receipt: cashback per band, cap haircut, welcome offer, valuation haircut, plan fee, one-off card fee,
  FX at home / US dollars online / travel, per-purchase %, flat fee, small-purchase fee, top-up fee, net and yield).
- Currency split: own currency / US dollars online (`usd`, default 10%) / travel (`travel`, default 10%). Old
  `foreign=` links still work (as travel).
- Purchase sizes: balanced mix (default; 20% of spend in each of $200, $100, $50, $25, $10, as the test basket) or
  one size (`mix=custom&ticket=`; old `ticket=` links switch to one size).
- Top-up fee grossed up: load = (spend + FX + purchase fees) / (1 - top-up %).
- Rewards valuation (`value`): face; conservative (cash, stablecoins, BTC, ETH 100%, other tokens 75%, points 50%,
  payout not published 75%); cash and stablecoins only. Read from "Cashback paid in" (`payoutKind` in `lib/calc.ts`).
- Card (`form`): virtual or physical (virtual-only cards hidden). Year (`year`): 2 = ongoing (default); 1 adds the
  one-off card fee (or physical card and shipping) and the welcome rate.
- Welcome rates: new sheet columns "Intro cashback %" and "Intro offer days" (`cashback.intro`, entry tier only, not
  scored). Kolo: 2% for 30 days (help.kolo.xyz cashback program). Solayer now bills USD with no FX ("No-FX
  currencies" USD 0, from its fee page: "USD Transaction Fee $0.15", FX only on international transactions).
Not modelled yet: per-purchase reward caps (Kolo $1 per purchase), "first 5 small purchases free" (RedotPay), and
"at or under" vs "under" limits (RedotPay is $1.00 or less; KAST and MEXC are strictly under).

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

## Scoring rules v3 (24 Oct 2026, Akash's exact rules)

Code and data are done (pull request #13): `lib/score.ts`, /methodology, card and compare pages, the 5 banking
columns in the sheet, and fees, banking features, custody and country lists for all 26 cards, written to the sheet
and checked with `sheet-sync --check`. Akash reviews the 26-card ranking table before merging.

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
- `fees-eco-1.json` (Crypto.com, Bybit, Coinbase One, Bitget Wallet, KAST, RedotPay, ether.fi, MetaMask, Nexo).
  Gaps: Coinbase's help pages block every download, so Coinbase One's banking features are empty (0 points); Nexo's
  fee help page only opens in the US, so its $0 top-up and per-purchase fees come from the card page's fee FAQ.

Corrections the research found (applied):
- Exa FX 1.5% (site says 3%). Avici FX 0% markup (Visa may add 0.4-1%). Krak FX 0% in the UK/EEA, 1% on the US card.
- MEXC has no physical card ("Physical cards are not available at this time"): remove physical from its forms.
- Karta: bank payouts now "coming soon"; ATM 1 USDT + 2.5%; plastic card 99 USDT plus unpublished shipping.
- Solayer's restricted list includes India, UAE, UK and most EU countries.
- Tangem Pay physical delivery is now $28.82+ (not $17.44) and its FAQ says physical "is not available yet".

Values flagged to Akash: Tria card fee (conflicting pages, left empty), Plasma top-up (0.15-0.75%
by asset; 0.15 used), Karta and COCA physical cost (shipping not published), Avici credit (separate credit line,
partly "coming soon"), Ethena payout currencies (not published) and Daily Boost counted as yield (Ethena says "not
yield"), MEXC yield (campaign Earn product), Avalanche FX (1% / 2% / 3% on different pages; keep 3).

Applied with these calls (24 Oct): Bybit's EU deposit account is a shared public account with a reference
("shared"); MetaMask's ~$0.01 gas is not an issuer fee (0); KAST India back to "unknown" (only an aggregator said
yes); Tangem Pay UK/EU "unknown"; Kolo EU "unknown"; MEXC has no physical card; ether.fi FX 0.5% (Core) / 0.25%
(Luxe) / 0 (Pinnacle, VIP); Wirex One country list refreshed (73 countries).

## Security

`package.json` pins PostCSS to 8.5.31 or later with an npm `overrides` entry (22 Oct 2026). Next 15 ships PostCSS
8.4.31, which has known advisories; npm's own fix was a jump to Next 16. The override clears `npm audit` while
staying on Next 15. Remove it when the site moves to a Next version that ships a patched PostCSS.

## Still open

1. Done 22 Oct 2026: live on Vercel (Hobby plan, project `g2m`) at https://g2m.life. www.g2m.life 308-redirects to
   g2m.life. DNS stays at Hostinger: A `@` 216.198.79.1, CNAME `www` to Vercel, two `_vercel` TXT verification
   records. All email records (Google Workspace MX/SPF/DKIM, Hostinger mail CNAMEs, DMARC) were left untouched.
2. Settings now default to info@g2m.life and @0akash0x; override them on Vercel only if they change.
3. Add referral links per card when deals are signed (sheet column "Referral link"). Before that (and before the
   first paid Sponsored booking) move off Vercel Hobby, which is non-commercial only: Vercel Pro, or Cloudflare (see
   "Next session").
4. Re-check every card within 90 days of its `lastChecked` date (the validator warns).
5. Run the sheet sync once on GitHub (Actions > Sync cards from Google Sheet > Run workflow) to confirm it works
   there; it was tested locally against the live sheet. The hourly check uses roughly 720 GitHub Actions minutes a
   month (2,000 free on a private repo).
6. Send the issuer outreach and add the answers (country lists, fees, card pictures) through the sheet.
7. Data gaps to close with issuers or new research: Coinbase One banking features and rails (its help pages block
   downloads), Ethena Pay rails (IBAN currency and payout currencies not published), Tria card fee (its pages
   disagree), the Crypto.com Level Up price (not published, so its tier break-even can't be worked out), cash-out fees that are only shown in the app (RedotPay, Bitget Wallet, Wirex One, Bybit, Nexo, most ether.fi
   local rails), KYC rules not published (Krak, Exa, Avici, Kolo, Tuyo, MetaMask, Crypto.com, Coinbase One, Tangem).
8. Coin lists (`assets`) are still empty for Coinbase One (paid off in US dollars, no stablecoins) and Nexo (its
   card page says "stablecoins" without naming them), so those show "Not stated" in the corridor finder.

## Ideas for version 2 (not decided, ask Akash)

Done so far: edit card data from a Google Sheet, real card pictures, small bug sweep, every country in the finder
and calculator with FX at home, phone-friendly tiers and Compare tables, live USD value of staking requirements
(tier break-even).

- Add the radar cards above (PEXX, Fizen, Infini, Cashi, WasabiCard, Kite), then grow towards 50+ cards.
- "X vs Y" comparison pages for SEO, and short guides (custodial vs self-custodial, how card fees work).
- A changelog of fee and cashback changes per card, which also feeds his X posts.
- Email sign-up for card updates.
