# G2M handoff: everything decided so far

Started 22 Oct 2026 at the end of the version 1 build; last updated 25 Oct 2026 (pull request #21: receipt matching, nomad mode, per-purchase caps). Read this
with `CLAUDE.md` before changing anything. The owner, Akash, is not a developer: explain in plain words and do the
technical steps yourself.

## Where things stand (quick summary)

- Live at https://g2m.life on Cloudflare Workers (since 25 Oct 2026; Vercel is no longer serving the site). 26 cards.
  Every push to `main` deploys through `.github/workflows/cf-deploy.yml` (also after each sheet sync, via
  `workflow_run`, because a sync's own push can't trigger another workflow). Work happens on the branch
  `claude/great-lamport-3kjmvq` and goes live through a pull request that Akash merges.
- 28 Oct 2026 pull request (see "Calculator, finder and navigation upgrades"): compare tiers across up to 3 cards,
  live stake values, five-question finder, Back button, wider rankings, region links.
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
  Solid's card is a vertical design; laid flat, VISA goes on the right like the other cards (`solid-visa-right.webp`).
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
  country count when unknown), region panels (browse chips removed 28 Oct at Akash's request) (the visitor's country, US, UK, EU / EEA, Asia), links
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
- Plausible analytics events when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set. Turned on 28 Oct 2026: Akash's Plausible
  account for g2m.life, domain and script URL set as plain (non-secret) env vars in `cf-deploy.yml`'s Deploy step
  (`NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_PLAUSIBLE_SRC`), since Next bakes `NEXT_PUBLIC_*` vars in at build
  time. Events already wired in: Outbound (card + placement), Compare add/open, Share, Theme, Region, Submit,
  Calculator/Finder/Wallet/Corridor use (debounced). View at plausible.io once logged in.
  Switched off 29 Oct 2026 (Plausible is paid after its 30-day trial): the env vars were removed from
  `cf-deploy.yml`, so the site loads no analytics script.
- G2M's own analytics (29 Oct 2026), replacing Plausible, free: Cloudflare D1 database `g2m-analytics` (binding `DB`),
  read at g2m.life/stats with the `STATS_PASSWORD` Worker secret. Records page views (with source on the landing page,
  country, device), every "Get the card" click on the server in `/go/[slug]` (card, spot via `?p=`, sponsored, referral,
  country), tool use (calculator with spend bands, compare sets, finder answers + top picks, rankings filters, wallet,
  corridors, shares, region, theme, submit) and 404s. No visitor cookies or IPs: a visitor is a hash that changes daily (`vid`, visitors per day) plus one that
  changes monthly (`mid`, unique visitors over a range; a person counts once per calendar month).
  Bots skipped by user agent. Akash's devices are excluded by the `g2m_ignore` cookie, set when logging in to /stats
  or with "Don't count this device"; it lasts ~400 days and is renewed at each login (logins last 30 days). Rows older
  than 400 days roll into daily totals (`daily` table). Methodology has a "What G2M counts" section.
- "No ID check" (31 Oct 2026): new last column on the Cards tab (`noIdCheck`): `yes` or the name of the option that
  needs no identity verification (SolCard: `Virtual card`). Card page badge, rankings filter (`?noid=1`) and a compare
  row. Score unchanged. SolCard added the same day (Virtual 5% top-up + $10/card, no ID; Platinum KYC, no top-up fee,
  not in the US; cashback only via SOLC staking tiers).
- Home page top spot, 31 Oct 2026: Akash said no one had paid, so KAST's "Featured · Sponsored" booking was removed
  (it was mislabelled as paid). The Sponsor tab now has a Type column: "Featured" (paid, both dates, "Sponsored"
  note) or "Our pick" (his own choice, no dates needed, note "Our pick, chosen by G2M."). Solid is set as Our pick;
  the three Our picks are COCA, ether.fi and Plasma One (Picks tab, no dates).
- Sign-up bonuses (3 Nov 2026), inspired by cardifycrypto.com's "sign-up bonus" per card: two last Cards columns,
  "Sign-up bonus" (issuer's own terms only, what the person joining through G2M's link gets) and "Referral code".
  Card page box with a Copy button, a line on home tiles, a "Sign-up bonus" rankings filter (?bonus=1), compare row.
  Confirmed on issuer pages: Solid ($25 FUSE, $150 at 3+ merchants in 30 days), Plasma One ($10 spend credit,
  $100 at 2+ merchants in 14 days), Nexo (NEXO tokens by tier within 45 days). Kite and Bitget Wallet pay only the
  referrer; ether.fi has no running offer; the rest have no issuer-published friend bonus (only third-party claims).
- SEO step 3 (4 Nov 2026), after comparing with cryptocards.so (ranks for "crypto cards"; 130 cards x 8 languages,
  Product+Review+FAQ data on every card page, no-KYC and country landing pages):
  home title "Best Crypto Cards {year}: Fees, Cashback & Rewards Compared", its h1 is the small label above the tagline
  (tagline now a <p class="h1">, looks the same), WebSite+SearchAction, Organization and top-10 ItemList data.
  Card pages: "{Card} Review {year}" titles, Product data with G2M's score as an editorial review rating (out of 100),
  and a visible "Questions about…" section built only from published data, sent as FAQPage. New guides:
  /guides/no-kyc-crypto-cards and /guides/crypto-card-sign-up-bonuses. Not code: Search Console, backlinks, more cards,
  an About page, other languages (see the SEO plan given to Akash).
- One address (4 Nov 2026): www.g2m.life served a full copy of the site, and Search Console showed Google had chosen
  https://www.g2m.life/ as the main address of the home page ("URL is not on Google" for g2m.life/). next.config.mjs
  now forwards every www page permanently (308) to the same page on g2m.life, filters and query strings kept.
- Wording (4 Nov 2026): visitors see "non-custodial", never "self-custodial" (labels, filters, home stat, picks, guide,
  methodology, card text). The guide moved to /guides/non-custodial-crypto-cards (old address redirects). The sheet's
  Custody value is still `self-custodial` internally. The score's "control" points are unchanged.
- Tracking fix (11 Nov 2026). Akash's 30-day export showed 266 "Get the card" clicks against 243 page views: about
  250 were crawlers opening every /go link (no page behind the click, "phone" user agents from DE/NL/SG/HK/KR, bursts
  of 15 links in 20 seconds, the first home-page link fetched dozens of times). About 16 clicks were real. Now:
  `isAutomated()` in `lib/stats/server.ts` stores a hit as `auto:<event>` (outside every number, shown as one "left
  out" line on /stats) when it comes from a hosting network (Cloudflare `cf.asOrganization`; Private Relay and VPN
  networks are not on the list), lacks the Sec-Fetch headers every browser sends, or, for /go, is neither a
  same-origin press nor a link a person opened (Sec-Fetch-User). Old direct /go rows are moved to `auto:Outbound`
  once (flag row in `daily`, new rows carry `"v":2`). Client: no hits from scripted browsers (`navigator.webdriver`),
  a page view counts when the tab is visible, tool events are sent once per page per state, and tool breakdowns count
  people. `utm_source=chatgpt.com` now shows as "AI chat". The events export has a Visitor column.
- /stats additions (11 Nov 2026): change against the period before (when the data goes back that far), "Clicks that
  earn nothing" (cards without a referral link), "Views by kind of page" with visits from search, "Where visits
  start", and "What people search for" (new `Search` event from the rankings box with the number of cards found;
  0 = a card to add). Missing-card signals so far: 404s for /cards/bit2me and /cards/bitpanda.
- "X vs Y" titles (11 Nov 2026): `versusTitle()` in `lib/versus.ts`, short names, at most 60 characters with " · G2M"
  (e.g. "ether.fi vs KAST Card: Fees & Cashback (2026)").
- Referral code pages (11 Nov 2026): `/cards/[slug]/referral-code` for cards with a referral link and a code or
  bonus (17 now; `lib/referral.ts`): the code with a copy button, the bonus in the issuer's terms, generic steps, FAQ
  and HowTo data. Linked from the card page, /guides ("Referral codes") and the sitemap.
- Speed (11 Nov 2026): guides, country guides, "X vs Y", alternatives and referral-code pages (about 930) are built
  ahead of time and served from Workers static assets (`open-next.config.ts`, static-assets incremental cache; the
  deploy command fills it). Local test: about 20 ms against 40 to 100 ms; live they also skip the Worker's cold start.
  The build takes about 70 s. Home, rankings, card reviews (live prices) and tools stay dynamic.
- Languages (11 Nov 2026). Akash chose Chinese (Hong Kong), Russian, German, Arabic (UAE) and Turkish, and asked for
  the top 3 European languages by crypto card users. No public source gives card users by country; from what exists
  (Chainalysis 2026: UK the largest Western European market, Germany 13th worldwide, France first in Western Europe
  for exchange withdrawals; OKX's European card report covers France, Germany, the Netherlands and Poland; CoinGate
  2026 payment share France 2.87%, Poland 2.06%, Spain 1.39%, Italy 1.09%) the three added are French, Spanish
  (also Latin America, where G2M already has visitors) and Polish. Dutch and Italian are the next candidates.
  Built: `/de`, `/fr`, `/es`, `/pl`, `/tr`, `/ru`, `/ar` (right to left), `/zh-hk`, each with a home page (full
  ranking, how the score works, FAQ), a page per card (facts, tiers, score parts, availability in that language's
  markets, FAQ, referral code) and a page per country guide: 259 pages a language, 2,072 in all. Words come from
  `lib/i18n/dict/*.ts` (93 lines each, written by Claude, not reviewed by native speakers); values come from the
  card data through Intl, so nothing goes stale. Sheet text (summaries, notes, pros, cons, bonus terms) is English
  only and is left off; each page links to the English review. `LocaleFrame` (in the root layout) gives translated
  addresses their own header and footer inside a `<div lang dir>`; `<html lang>` is corrected in the browser.
  hreflang links join the English home, card and country pages with their translations; the footer lists the
  languages; the sitemap has them (3,045 addresses). /stats: "Other languages" by language, and a page kind.
  Home and card pages are prebuilt (296), language-market country pages too, the other country pages on first visit.
  Not translated yet: rankings table, "X vs Y", topic guides, alternatives, referral pages, tools, methodology.
- Languages, part 2 (11 Nov 2026, Akash: "why not translated those pages?", then "go 1,2,3"). Added in all 8
  languages: "X vs Y" (`/de/compare/a-vs-b`; who wins each point comes from `lib/verdict.ts`, the sentences from
  the dictionary in `lib/i18n/verdict.ts`; matchups among the top 10 cards prebuilt, the rest on first visit),
  alternatives, referral code pages, a guides hub and the 20 topic guides (`/de/guides/...`; the long fees guide
  stays English), and a shorter methodology (`/de/methodology`; calculator details link to English). Sheet text
  (summaries, pros, cons, sign-up bonuses) and the guide text now show translated, from `data/i18n/<code>.json`,
  which maps the exact English text to its translation (359 lines a language, written by Claude, numbers checked
  against the English; not reviewed by native speakers). When the sheet text changes, the page shows the new English
  text marked as English until the line is translated: `npm run i18n:missing` lists what is missing. A guide only
  appears in a language once its title and description are translated. Dictionaries: 211 lines each.
  Language menu (Akash: "on the top with sign"): a globe button with the language code in the header of every page
  (`components/LanguageMenu.tsx`), opening the same page in the chosen language where it exists, else that language's
  home (`pathIn` in `lib/i18n/locales.ts`); it replaces the footer language lists. hreflang added to the English
  "X vs Y", alternatives, referral, guides and methodology pages; sitemap 4,005 addresses.
- Translated home pages (11 Nov 2026, Akash: "homepage isn't translating"). The language menu worked, but `/de` etc.
  was a plain ranking list that looked nothing like the English home page. It now follows the English layout: hero
  with the tagline ("Gib deine Coins klüger aus."), the top spot (same Sponsor tab rules, "Sponsored" note in the
  language), the numbers, New on G2M, the ranking (top 10, then "Show all"), cards by country, Our picks (the
  automatic labels and the Picks tab "why" lines translated; the why lines are in `data/i18n` and in
  `npm run i18n:missing`), how cards are judged, the tools (linked to the English tools) and the FAQ. Rendered on
  every request like the English home page, so sponsor dates apply. 54 new dictionary lines per language.
- Language bug sweep (11 Nov 2026, Akash: "lots of issues with new languages, check all and fix"). Crawled all 5,288
  translated pages (all 200) and swept 9 page types x 8 languages on phone and desktop. Fixed: (1) every translated page
  was sent as `<html lang="en">` (Chrome offered to translate German pages "from English"; screen readers used an
  English voice): the English pages moved to `app/(en)/` and `app/[lang]/layout.tsx` is a second root layout with the
  right `lang` and `dir`; (2) money in translated sheet text was English-style ("$2,000" reads as two dollars in
  German): `localAmounts` in `lib/i18n/notes.ts` writes it per language ("2.000 $", "2 000 $US", "US$2,000");
  (3) "annual fee $0" in sentences now reads "Jahresgebühr entfällt" etc. (`noFeeS`); (4) colons per language (French
  " :", Chinese "："); (5) Russian dates ended in "г.." ; (6) the Chinese header wrapped on phones ("ZH" now); (7) the tools
  link was cut off on phones (shorter); (8) plain tier names ("Virtual card") translated; (9) 404s in the language of
  the address, and unknown first segments (/xyz) get the normal English 404. Akash then asked for the whole site in
  each language (rankings table, calculator, finder, compare, wallet, receipt...): not done yet, planned in stages.
- Whole site in each language, stage 1 (11 Nov 2026; Akash: "better to have language packs than translation", then
  chose "whole site in each language"): the full rankings table at `/de/cards` etc. in all 8 languages, with the
  passport bar, every filter, badges, compare bar and share buttons from `lib/i18n/ui/<code>.ts`. The header's
  "Ranking" link and the language menu point there; hreflang and sitemap added. English `/cards` checked word for word
  against the previous build (same text before and after clicks). Long words: short custody labels in the table and
  wrapping headings, so the table fits 1280 px in every language. Next stages, one PR each: card page in full,
  compare, calculator, finder, wallet, receipt, corridors, submit, fees guide.
- SEO check (13 Nov 2026, Akash: "now seo"): crawled all 4,131 sitemap pages as Googlebot. Already right: every page
  loads, has a title, description, self canonical, one h1, the right html lang, valid JSON-LD, share tags, no noindex,
  no duplicate titles or descriptions, and hreflang that points both ways; no broken internal links. Fixed:
  descriptions longer than Google shows (2,067 pages, mostly country guides, alternatives, referral and tool pages) now
  fit via `metaDescription`; 140 long titles drop " · G2M" (`metaTitle`); 9 English pages (/cards, /finder,
  /calculator, /wallet, /corridors, /compare, /methodology, /submit, /guides) had the home page's share preview, now
  their own; og:locale on every page; the rankings pages (English and 8 languages) give the ranking as an ItemList.
  Left as is: translated "X vs Y" pages beyond the top pairs stay out of the sitemap (linked from the English ones);
  10 titles of far-off territories stay long. Visible page content unchanged (21 pages compared).
- Same header and footer in every language (13 Nov 2026, Akash: "this should match with english website. everything
  should be same"): translated pages now use the English header (Rankings, Card finder, Rewards calculator, Wallet
  builder, Compare, Methodology, language, theme, "Find your best card") and the English footer (description, the 11
  links, disclaimer with the data date), in each language, instead of the shorter Ranking / Guides / Tools header and
  disclaimer-only footer. Header names are shortened where needed (fr "Calculateur", es "Calculadora", ru
  "Калькулятор", pl "Portfel") so every language fits one row at 1,200 px and up and wraps like English below it;
  header height matches English at 390, 900, 1024, 1280 and 1440 px. English pages: same header and footer.
- Whole site in each language, stage 2f (13 Nov 2026, Akash: "step 6", the last of "1,2,3,4,5,6"): the submit form
  (`/de/submit` etc.) and the fees guide (`/de/guides/crypto-card-fees-explained`) in all 8 languages. The form's
  words are translated; the email it prepares stays English ("New card for G2M: …") so the team can read it, and the
  form says so. The fees guide has the same sections, live numbers and $1,000-month table as the English guide (text
  in `lib/i18n/fees`, numbers shared in `lib/feesGuide.ts`), and is listed on the translated guides pages. The
  translated header's "Tools (English)" link is now a Tools menu with the six tools in that language. Card pages'
  "Tell us" link opens the translated form. English `/submit` (with its error messages and prepared email), the fees
  guide, guides, home, card page and methodology checked against the live build: no differences. Every page of the
  site now exists in all 8 languages; translations are Claude's, not yet checked by native speakers.
- Whole site in each language, stage 2e (13 Nov 2026, Akash: "step 5"): the wallet builder, swipe receipt and
  corridor finder at `/de/wallet`, `/de/receipt`, `/de/corridors` etc. in all 8 languages: every form, result, table,
  note and share text, with money and percentages from Intl. The maths is unchanged: the wallet's "card 2 for these
  purchases" (`sliceParts`) and the receipt's lines and notes (`vars`, `noteParts`) are recorded as facts and worded
  per language, with English exactly as before. Receipt links keep the English purchase name (`what=Coffee`); each
  language shows its own word. The receipt picture to post or download stays English (no Arabic or Chinese letters
  in its font). The corridor finder's 69 bank rail fee notes are now translated (and listed by `npm run i18n:missing`).
  English `/wallet`, `/receipt` and `/corridors` checked against the live build in 29 states (words, links, labels,
  titles): no differences. Links from the calculator, card pages, finder and translated home pages now open the
  translated tools; hreflang and sitemap added. Arabic pages: letter spacing off in page content, so Arabic letters
  join up (labels were spaced apart before). Next: submit + fees guide, then the header's Tools menu.
- Karta update (12 Nov 2026, Akash sent app screenshots and his referral link): in the sheet, Karta now has its
  referral link (https://karta.social/29fda4cb62, no sign-up bonus for the friend, so none listed), cashback 0% (Karta
  confirms no cashback on your own spending), the metal card (299 USDT pre-order, first shipments planned for December
  2026; plastic 99 USDT for November), virtual card replacement 15 USDT, Tron top-ups 5.90 USDT, the declined-ATM fee and
  the Visa Signature benefits (DragonPass airport offers, GigSky eSIM, car rental and purchase cover, warranty,
  concierge), all from Karta's Help Center. ATM limits (250 USDT per withdrawal including the fee, 3 tries in 24 hours)
  are only in the Karta app: added at Akash's request, marked "Per the Karta app", source = the app link. Its "lounge access at fixed rates" is pay-per-visit, so lounge checks now skip a
  perk that says "at fixed prices" (`lib/perks.ts`). Score (40) and rank (33rd) unchanged. 15 new lines translated.
- Whole site in each language, stage 2d (12 Nov 2026, Akash: "step 4"): the card finder at `/de/finder` etc. in all 8
  languages: the five questions, the passport option, the results with their reasons and "check first" notes, share
  buttons and links (perks quoted from the sheet translated on the server). The picks are worked out exactly as before;
  `lib/finder.ts` now records each reason as a fact and words it in English the same way. English `/finder` checked
  against the live build in 15 answer sets and clicks: same words, titles and links. The translated home pages' "Find
  your best card" link and finder tile now open the translated finder; hreflang and sitemap added. The header's "Tools
  (English)" link stays until wallet, receipt and corridors are translated. Also: CLAUDE.md now says the site is on
  Cloudflare (Vercel's old project still builds every push and filled its free storage; Akash to disconnect it).
  Next: wallet/receipt/corridors, submit + fees guide.
- Whole site in each language, stage 2c (12 Nov 2026, Akash: "step 3"): the rewards calculator at `/de/calculator` etc.
  in all 8 languages: all three modes (best card, compare tiers, one card line by line), the form, tables, break-even
  lines, notes, share buttons and the 2-card wallet teaser, with money and percentages from Intl and the sheet text it
  shows (tier requirements, "rewards paid in") translated on the server. The maths is untouched: `lib/calc.ts` writes
  its notes in English and the page swaps in the translation (`noteText` in `components/calcText.tsx`). English
  `/calculator` checked against the live build in 24 states (every mode, countries, year 1, physical card, valuation,
  one purchase size, staking tiers): same words and links, and the same phone layout. The compare tool's "what it keeps
  you" button and the translated home page's calculator tile now open the translated calculator; hreflang and sitemap
  added. The swipe receipt, methodology and wallet links stay English and say so. Phone tables now wrap a line only
  when longer words do not fit (English unchanged). Next: finder, wallet/receipt/corridors, submit + fees guide.
- Whole site in each language, stage 2b (12 Nov 2026, Akash: "step 2"): the compare tool at `/de/compare` etc. in all
  8 languages: card and tier pickers, the tier presets, every table row (tier rows and card rows), share buttons and
  links, with numbers from Intl and the sheet text it shows (ATM, perks, requirements, bonus, coverage) translated on
  the server. English `/compare` checked word for word against the live build in 10 states (presets, one tier per
  card, a card's tiers lined up, staking and country-only tiers): no differences. The card page's Compare button, the
  rankings compare bar and the translated home page's Compare tool now open the translated tool; hreflang and sitemap
  added. Also fixed (every language): the "Compare its N tiers side by side" button no longer runs off phone screens.
  Next: calculator, finder, wallet/receipt/corridors, submit + fees guide.
- Card re-check (12 Nov 2026, Akash: "quick check to update the cards details if anything changes"): every card's
  main issuer fee and cashback pages read again. Changed in the sheet (sources added, lastChecked 2026-11-12):
  Plasma One renamed and repriced its tiers on 11 Nov (Standard free 1% to $500 then 0.1%; Premium $600/yr or 20K
  XPL, 2%/1%/0.25%, 0% FX on the first $3K a month; Platinum $2,500/yr or 100K XPL, 3%/2%/1%, 0% FX); Krak's
  cashback is now set by 30-day average balance (EEA/UK 0.5% from EUR 200 to 2% from EUR 50K; US 1% from $1K to 2%
  from $150K; 8 tiers with countries) and Krak charges no ATM fee; COCA cashback is now "unlimited" but each tier can
  claim only $15 to $350 a month (stored as the monthly cap; unclaimed rewards carry over); ether.fi card and lounge
  benefits by level (free virtual cards 1/4/10/50, Core physical card $50, lounges from Luxe), its old benefits page
  was gone; Nexo free ATM EUR 200/400/1,000/2,000 and physical card from Gold; Jupiter's 4% boost capped at $200;
  Tria Lite pays 1% after its cap; Infini says up to 5%; Avalanche's site lists 1% FX (agreements allow more).
  Rank moves: Krak 20th to 14th, Avalanche 29th to 24th, Plasma One 18th to 21st. Unchanged on re-read: Crypto.com
  (Level Up tiers renamed Basic/Plus/Pro/Private on the fee page), Bybit (fee page lists APAC and Georgia FX as "Not
  Supported"; the card FAQ still lists them, so coverage kept), Bitget, KAST, MetaMask, MEXC, Solayer, Tangem, Ethena,
  Exa, Kolo, Karta, Avici, Tuyo, Pionex, DogPay, Solid, Cashi, Kite, SolCard, Laso, XPlace. Not readable as text
  (pictures or moved pages), left as they were: Wirex One, Bleap, RedotPay (fee table image, updated July), Coinbase
  One (card page moved).
- New card, OrbitX (12 Nov 2026, Akash forwarded OrbitX's reply and their card picture): sheet row 38, tiers Neo
  ($12/yr, Visa Platinum, FX 2%, $0.20 "fiat conversion fee" per purchase) and Lux ($30/yr, Visa Signature, FX 1%,
  $0.10), all from orbitxpay.com/card-fees. The $0.20/$0.10 is read as a per-purchase fee (the card terms list
  "authorization and settlement fees up to $0.50" on USD purchases too). Physical cards are not out yet (OrbitX: later;
  Lux metal $350 at launch), so forms = virtual and the ATM line says physical only. Issuer Third National is named in
  OrbitX's published card terms (their email calls the BIN sponsor confidential; it is public in the terms). Funds stay
  in the user's wallet ("will not, in any circumstance, be holding custody"). No published cashback and no country
  list (focus regions only), so all five markets are unknown and it ranks 32nd of 37 (43/100). Named accounts in 9
  currencies, payouts to 100+ countries, yield on USDC. No referral link yet. Picture in `public/card-originals/`
  (sent by OrbitX). Also fixed: per-purchase fees showed "$0.2"/"$0.3" (now "$0.20"/"$0.30", DogPay too), and a
  coverage note ending in a full stop got a second one.
- New cards PEXX and Pulsar Money, referral re-check (13 Nov 2026, Akash sent both card pictures, the PEXX link
  app.pexx.com/referral/T8W78 and Pulsar's invite code KW424). Sheet rows 39-40, 39 cards in all.
  - PEXX (19th of 39): Visa/Mastercard debit, 1% back in PEXX Points (PEXX values 100 points at $1; not cashable yet,
    they convert to HeyMax Max Miles). Fees from PEXX's own FAQ: 0.6% on every purchase plus 1.2% FX outside USD;
    its pricing page still says one flat 2.6%, which the FX note says. 68 card countries (complete list, residence
    based), USD account with routing number for non-US residents, 17 payout currencies, up to 4% APY.
  - Pulsar Money (24th of 39): virtual Visa issued through Wirex, Free (0.5% on the first $500 a month, then 0.25%)
    and Pro ($99.99 a year, standard 2%, 4% on subscriptions; November 2026 runs 4% on the first $3,000). Points are
    USDC refunds on past purchases and expire. No FX fee from a matching USD or EUR balance, up to 1% otherwise; ATM
    free to $200 a month then 2%. 73 card countries (Wirex's list plus Serbia). Custody "unknown": Pulsar's terms
    say each wallet is described by its own control set-up, with no blanket label.
  - Neither PEXX nor Pulsar gives the new user anything for a referral (rewards go to the referrer), so no sign-up
    bonus. Referral re-check of the cards not checked on 12 Nov: KAST changed (the friend now gets 10% off the first
    paid membership, no more $20 after $100), Wirex One now shows its bonus (60-day Premium trial), RedotPay's 5 USDs
    wording made exact (30 days, not for the card fee). Unchanged: Solid, XPlace, Kite (referrer only), SolCard.
    No new-user reward published by the issuer: Tuyo, DogPay, Hyperbeat, Bitget Wallet's guide (its in-app invite
    card is the source of the current line).
  - Pictures: the sync downloads "Card image" links, which point at g2m.life/card-originals/ before those files are
    deployed; run it once with a fetch override that reads them from `public/card-originals/` (Node `--import`).
  - Open: Wirex One now publishes portfolio-based tier requirements ("Wirex One Membership – how it works"); its tier
    rows still say "Not published".
- Whole site in each language, stage 2a (12 Nov 2026; Akash: "first go with 1,2,3,4,5,6", the first being the card
  page): `/de/cards/kast` etc. are now the full English card review in each language, built by the same component
  (`components/CardReview.tsx`; the English page calls it with no language and is unchanged, checked word for word
  for all 36 cards with no country, IN and DE, including the country list after clicking). New in other languages:
  the referral box, country standing with passport fit, the full country list and country check, tier break-even
  and staking check, the tiers table, the receipt teaser, more details, FAQ and its search data. The card page's
  other sheet text (coverage, cashback and fee notes, perks, each tier's requirement, fee note and perks: 495 lines)
  is translated in all eight `data/i18n` files and listed by `npm run i18n:missing`. Translations written by Claude,
  not yet checked by native speakers. Links to compare, receipt and submit still go to the English pages until those
  stages. Next: compare, calculator, finder, wallet/receipt/corridors, submit + fees guide.
- Translated home pages = English home page (11 Nov 2026, Akash with screenshots: "Rangliste" showed the list on the
  home page, "See all cards" missing, a link not working, a plain country list English doesn't have; "similar
  experience for other language like we have in English version, nothing changes"). `/de` etc. now have exactly the
  English sections in the same order: hero with search (searches `/de/cards`), "See all N cards", the top spot,
  numbers, New on G2M with "See all", the top-5 leaderboard by the visitor's country with "Full rankings", the US / UK /
  EU / Asia panels with the visitor's country first, our picks, how cards are judged, the tools. HomeLeaderboard and
  MarketPanels take the language pack; English home checked word for word against the live build (no country, DE, IN).
  The country-guide link list and FAQ left the translated home pages (English has neither; the guides hub links them).
- Google canonical fix (11 Nov 2026, Search Console "Duplicate without user-selected canonical", 56 pages, and
  "User-declared canonical: None" on the home page): Next.js streamed the title and canonical into `<body>` for
  Googlebot, which ignores a canonical there. `htmlLimitedBots: /.*/` in `next.config.mjs` keeps them in `<head>`.
- Site audit (10 Nov 2026, Akash: "check whole website, stats page, bugs, competitors"). Crawled all 959 sitemap
  pages (no broken links, no error pages) and swept 28 page types at 1440, 390 and 320 px. Fixed: (1) 888 pages
  (vs, guides, country guides, alternatives) had no share picture and card pages showed the small X card, because a
  page that sets its own `openGraph`/`twitter` drops the site-wide ones: all pages now use `shareMeta()` in
  `lib/site.ts`; (2) card-page search descriptions were up to 304 characters and read "Not published annual fee":
  now facts first, 160 characters at most; (3) `.grid-2` overflowed 320 px phones; (4) the /stats 12-month chart
  overflowed phones: ranges over 100 days are drawn one bar per week. Not fixed, proposed to Akash: shorter
  "X vs Y" titles (all 630 are over 60 characters), an India guide (only SolCard is confirmed there, so India has no
  country guide), an About page, more cards (competitors list 52 to 137), edge caching (first response 0.3 to 2.9 s),
  and more /stats views (previous period, landing pages, page types, searches with no result, clicks on cards
  without a referral link: 18 of 36 cards have none). The Cloudflare token in the cloud session cannot read the D1
  stats database, so real numbers need Akash's CSV export.
- "See all cards" (4 Nov 2026, Akash): the home "See all N cards" links and the footer "All cards" go to
  `/cards?country=all`, which shows every card worldwide instead of switching to the visitor's detected country;
  `country=all` stays in the address while no country is picked, so reload and Back keep the worldwide list.
  Plain `/cards` (menu "Rankings", "Full rankings") still defaults to the visitor's country.
- Home "New on G2M" (4 Nov 2026, Akash): a strip between the stats and the leaderboard with the 3 most recently
  listed cards (by `addedOn`, newest first, ties by rank), each linking to its review with the date added, cashback, sign-up bonus (when there is a referral link),
  annual fee and score. Updates itself when the sync lists a new card; hidden if no card has an `addedOn`.
- More SEO pages (4 Nov 2026, Akash: "increase the seo pages"): a "Best X alternatives" page per card at
  `/cards/[slug]/alternatives` (top 10 by score not ruled out in the card's confirmed markets, the card's cons as
  "why look for an alternative", where each beats it from the "X vs Y" verdict, FAQ + ItemList data; linked from the
  card page and a new section on /guides), and 11 more topic guides in `lib/guides.ts`: Apple Pay, Google Pay,
  crypto credit cards, USDT, USDC, Visa, Mastercard, virtual cards, 2%+ cashback, yield, Bitcoin, no FX fee in euros.
  All built from the card data. Sitemap now about 956 addresses.
- New cards (4 Nov 2026), Akash's request: Infini (row 35; Pro/Lite/Max tiers from infini.money/en/pricing, 1.5%
  cashback from 1 Nov, no country list), Hyperbeat Pay (row 36; cashback from its 5 Aug 2026 blog post, paid in WHYPE;
  no published fee schedule, so FX and annual fee are empty and it ranks last) and XPlace (row 37; plans and caps from
  docs.x.place; FX: help centre says Visa 1% + a tier fee, card terms say 0%, so FX left empty except Platinum 0%).
  Pictures in `public/card-originals/`: Infini Max (sent by Akash), Hyperbeat and XPlace from their own sites. GMGN is
  not added: gmgn.ai blocks automated reads and no GMGN page publishes the card's terms; waiting for Akash's in-app
  screenshots of fees and cashback (his card picture shows his real last 4 digits, so crop them before using it).
- COCA tracking rule (3 Nov 2026, from COCA's affiliate team): the "Get the card" button must send people through the
  Impact tracking link (`links.affiliate`), which lands on coca.xyz/join-coca (email check) and only then the app
  store. Never swap in a direct App Store / Google Play link: attribution is lost. Checked: /go/coca -> coca.sjv.io
  (Impact) -> coca.xyz/join-coca, with G2M's utm tags and Impact's `im_ref` both carried through. November welcome
  offer (8% on first 3 purchases, until 30 Nov) is in the Sign-up bonus cell; reminder set to remove it on 1 Dec.
- Stats (3 Nov 2026): total visits (landings, repeat visits count) next to unique visitors; "people who clicked";
  per card "From its page" click count and click rate as "people of visitors (%)".

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

## Calculator, finder and navigation upgrades (28 Oct 2026, Akash's test of the live pages)

- `/calculator?mode=tiers` is now "Compare tiers": one card, or up to three (`cards=coca,tria,etherfi`; old `card=coca`
  links still work). With several cards the first column is card + tier, rows sort by "You keep / yr" (or "Group by
  card"), and the winning tier across all of them is highlighted ("Best"). Break-even points are listed per card.
- Duplicate note fixed: COCA's requirement ("Hold 300 COCA") and its stake were both written as notes. Now a stake
  that the requirement already names is not repeated (`stakeFlag` in `lib/calc.ts`). The page fetches live CoinGecko
  prices (`usdPrices`, cached 1h) and shows each stake's value: "Needs: Hold 300 COCA (~$288)" in Notes and
  "Stake ~$288" under "Free" ("Or stake" when staking replaces a yearly fee, e.g. ether.fi Luxe, Plasma Core).
- `/finder` has five questions: 3 is multi-choice (chosen priorities are averaged, so two never weigh double); 4 is
  how you use the card (Apple/Google Pay, physical card, credit, yield, or no preference); 5 is fees and banking
  (free tiers only = $0 fee and no token stake on the entry tier; open to paid or staking tiers; IBAN or bank
  payouts). Link params `m, h, p, u, f, pp` (`p=cashback,travel`, `u=none`, `f=free,bank`); three-answer links still
  open (no preference on 4 and 5). Reasons list what the visitor asked for first.
- `← Back` on card pages and `/compare`: goes back to the previous g2m page in the tab (filters and calculator settings
  kept), else to `/cards` (`components/BackButton.tsx`; `NavMemory` in the root layout remembers this per tab).
- Rankings use a wider layout (`wrap-wide`, 1,400px) so every column, including Compare, fits from 1,280px screens.
- Homepage "All cards for EU / EEA" and "Asia" now open `/cards?region=EU` / `region=ASIA` instead of the visitor's
  own country. Region rules match the homepage counts: the EU uses the card's EU / EEA answer, Asia is "yes" when the
  card is confirmed in at least one Asian country (`availabilityInRegion` in `lib/regions.ts`).

### Follow-up: one tier per card, live prices on Cloudflare (28 Oct 2026)

- Akash wanted to compare one tier of each card, e.g. the tier above the free one on KAST, Tria and ether.fi. Both
  "Compare tiers" (`/calculator?mode=tiers`) and `/compare` now have a tier dropdown per card (real tier names) and
  presets: All tiers (Compare: "Card overview") / Entry / Next tier up / Top tier, each listing the tiers it picks
  ("Next tier up · Premium · Pro · Luxe"; tiers not offered where the visitor lives are skipped). Links use the tier's
  name: `cards=kast:premium,tria:pro,etherfi:luxe` and `/compare?c=kast:premium,...` (`lib/tierpick.ts`); plain slugs
  still work. The calculator adds "Which one pays off at your spend" (best of the shown tiers at $250 to $10,000 a
  month); `/compare` adds tier rows (price, cashback, cap, FX, how to qualify, stake value today, perks, countries).
  The two pages link to each other with the same picks.
- Live stake values were empty on Cloudflare: `lib/prices.ts` relied on Next's fetch cache, which has no storage on
  Workers. It now caches itself (memory, plus Cloudflare's edge cache), uses DefiLlama (`coins.llama.fi`, same
  CoinGecko ids) when CoinGecko does not answer, and logs failures. Optional `COINGECKO_API_KEY` (CoinGecko demo plan,
  10,000 calls a month) as a Worker secret: Workers & Pages → g2m → Settings → Variables and Secrets.

## Our picks on the home page (28 Oct 2026)

- Akash wanted a three-card "Our picks" section (between the region panels and "How cards are judged") whose spots
  can be sold. The sheet has a new Picks tab (tab id 1960518401 in `data/sheet.json`): Slot (1-3), Card ID, Type (Our
  pick / Sponsored, dropdowns), Why (one line), Start, End. The sync writes `data/picks.json` (`PicksSchema`); the
  first booking per slot whose dates include today shows (`lib/picks.ts`). Sponsored needs both dates, is labelled
  Sponsored, uses `campaign=sponsored` on its Get-the-card link and never changes a score or rank. Empty slots fill
  themselves: 1 top ranked, 2 best with no annual fee, 3 best self-custodial (no card twice). The methodology's "How
  G2M makes money" explains it. The separate hero Featured spot (Sponsor tab) is unchanged.
- Same day, Akash: call paid spots "Featured", not "Sponsored" (sheet Type "Featured"; "Sponsored" still accepted;
  internally `type: 'sponsored'`, link `campaign=sponsored`). Both the hero spot and paid picks keep a visible
  "Sponsored" note under the Featured badge, because paid listings must be disclosed (FTC / ASA / ASCI). New cards: no date to type
  (Akash); the sync sets `addedOn` the day a Card ID first reaches the site and carries it over. A card added in the
  last 30 days takes an unbooked slot as "New on G2M" ("Just added to G2M.", newest first) before the automatic picks.
- Calculator fix: with a single tier on screen the summary no longer says "best for you" (it read "best for you:
  Pinnacle (-$279)"): it says what you keep and names a better tier of the same card with a "See all tiers" link.
  When every shown tier loses money it says none pays off and which loses the least.

## SEO step 1: "X vs Y" comparison pages (28 Oct 2026)

- Akash's top v2 priority is SEO. Step 1: a page for every pair of cards at `/compare/<a>-vs-<b>` (card IDs in
  alphabetical order; the other order redirects with a 308; unknown or same card = 404). 26 cards = 325 pages, all in
  the sitemap. Built from the card data only (`lib/versus.ts` addresses, `lib/verdict.ts` wording), so a sheet edit
  updates every page that uses the card. Nothing to write by hand.
- Each page: title and description with both cards' score, cashback, annual fee and FX fee; a one-paragraph summary
  (who scores higher, "Pick A for ...; pick B for ..."); "The short answer" (score, entry-tier cashback, annual fee,
  FX fee, countries, custody); the same side-by-side table as /compare (rows now in `components/compareRows.tsx`);
  five questions with FAQPage structured data; links to five more matchups per card.
- Country wording: a card without a complete country list (`countryList.others` not `no`) is described as "does not
  publish a full country list (N confirmed so far)" rather than losing "229 against 2".
- Links in: card pages ("Compare <card> with": nearest-ranked cards plus the top 3), /compare ("Popular comparisons":
  every pair of the top 7, and a "Full A vs B page" button when two cards are picked).
- Same day: the home page "Browse by" chips were removed (Akash: not needed).
- Next SEO steps: guides (done, see step 2), then Google Search Console (add g2m.life and submit /sitemap.xml).

## SEO step 2: guides (28 Oct 2026)

- `/guides` hub (footer link only; Akash took it out of the top menu) with three kinds of guide, all built from the card data (`lib/guides.ts`):
  - Country guides at `/guides/best-crypto-cards/<country>` (e.g. `united-arab-emirates`): every country where at
    least 5 cards are confirmed (`MIN_CONFIRMED`; 181 countries today). Cards confirmed there, ranked with the G2M
    score for that country, the FX fee on spending in its own currency (`homeFx`), an "At a glance" list (no FX fee,
    no annual fee, self-custodial, how many have not confirmed the country) and four questions.
  - Topic guides at `/guides/<slug>`: no FX fee, no annual fee, self-custodial (with custodial vs self-custodial
    explained), with a bank account (IBAN), metal, lounge access. Each has a short explanation (no card facts), the
    ranked list, "What to check before you pick" and questions.
  - "Crypto card fees explained": each fee with live counts and ranges from the data, plus a table of every card's
    fees on the $1,000 test basket in its own currency and in another currency.
- Each page has a search title and description, FAQPage, ItemList and breadcrumb structured data, and is in the
  sitemap (189 guide pages).
- India has no country guide: no card on G2M has confirmed India yet (19 say no, 7 have not said). It appears on its
  own once 5 cards confirm it. Same for any other country.

## Receipt picture, receipt tier, tiers of one card side by side (28 Oct 2026)

- Receipt "Download image" now gives a tall 1080 x 1350 picture (`/receipt/image?...&size=tall`): X cropped the wide
  1200 x 630 one to near-squares in posts with two pictures. Link previews stay wide. The footer sits 84px up so X's
  trim in two-picture posts does not clip it.
- The receipt's tier picker is always shown, with each tier's price, and greyed out with "has one tier" when a card
  has only one (Solayer has a single "Membership" tier in our data, so Akash saw no picker).
- /compare and the calculator's Compare tiers take the same card more than once with different tiers
  (`c=ethena-pay:standard,ethena-pay:pro,ethena-pay:vip`); picking a card that is already in a slot starts on its next
  tier. /compare with one multi-tier card shows "Compare its N tiers side by side"; with one card in every slot the
  card-level rows and tier presets are hidden (they would repeat).

## Cards added: Pionex and DogPay (28 Oct 2026)

Same day, Akash removed the Pionex DogPay Card (rows deleted from the sheet); the notes on it below are kept for
reference. Live cards: `pionex` and `dogpay`.

Deploy bug found then: after a sheet sync, cf-deploy checked out `workflow_run.head_sha` (the commit the sync
started from), so sheet edits only reached the site with the next code push. It now checks out `github.sha` (newest
commit on main). Earlier "live after the hourly sync" checks were really waiting on a PR merge.

Added through the Google Sheet (Cards, Tiers, Country lists, Sources rows), from issuer pages only:
- **Pionex Visa Card** (`pionex`): free, 1% fee on every purchase (USD too, so FX 0 and txPct 1), 1% cashback,
  5% APY on the card balance, small-purchase 0.2 USDT at $5 or less (first one a month free), virtual only (physical
  closed). Source: help.pionex.com fee and cashback articles.
- **Pionex DogPay Card** (`pionex-dogpay`): Pionex's current Mastercard, issued as the DogPay Card. 3.5% on every
  purchase, 0.1% cashback (Regular tier); an invite-only Gold tier (one-time 100 USDT) pays 5% on the first $4,000 a
  month, then 1%. Pionex's pages disagree on the regular cashback (0.1% vs "0.1% to 1%") and the small-purchase limit
  ($1 vs $5); noted on the card. Separate card from the Visa because the purchase fee is card-level.
- Which of the two you get depends on your KYC country, and Pionex does not publish that split. Both share Pionex's
  unsupported list (US, UK, Canada, France, Netherlands, Japan, Singapore, Hong Kong, China and sanctioned
  countries); every other country is "not confirmed".
- **DogPay Card** (`dogpay`, DogPay's own app): personal plans Basic free / Premium $4.90 / Platinum $9.90 / Ultra
  $29.90 a month, card top-up 1% / 0.8% / 0.5% / 0.3% (tier top-up rates are in the tier perks; the card-level
  top-up is Basic's 1%), $10 virtual card on Basic. DogPay's site does not publish a purchase or FX fee ("check in the
  app"), so FX is "Not published" and the third-party figures (1.5% + $0.30, 3.5%) were not used. No country list
  published. Personal USD account (ACH, Fedwire, SWIFT, $35 in or out).
- Fetching issuer pages: WebFetch could not resolve some hosts in this cloud session, but plain `curl` through the
  proxy works (help.pionex.com, intercom.help, dogpay.com). Do not spoof a browser user agent.

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
- SEO: "X vs Y" pages and guides are done (see above). Next: Google Search Console, and more explainers if wanted.
- A changelog of fee and cashback changes per card, which also feeds his X posts.
- Email sign-up for card updates.
