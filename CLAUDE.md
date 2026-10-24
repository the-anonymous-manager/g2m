# G2M · Gwei 2 Merchant (g2m.life)

The crypto card directory: every crypto card ranked on rewards, fees and where it works.
Tagline "Spend your bags better." Sub-line "From on-chain to checkout."

Read `docs/HANDOFF.md` for every decision made so far (brand, research, what is built, open items, v2 ideas).

The owner is not a developer. Explain changes in plain words, do the technical steps yourself,
and confirm what changed on the site (not which files moved).

## Stack

- Next.js 15 App Router, React 19, TypeScript 5.9, Zod. Keep TypeScript on 5.x: Next 15 cannot type-check with TypeScript 7.
- No database. All card data lives in `data/cards.json`; schema in `lib/card-schema.mjs`.
- Hosted on Vercel from this repo's `main` branch; every push to `main` deploys g2m.life.

## Commands

- `npm install` then `npm run dev` (http://localhost:3000)
- `npm run validate` checks `data/cards.json` (run after every data edit)
- `npm run build` runs validate, then the production build. Run it before pushing code changes.

## Editing card data (most requests)

- Once `data/sheet.json` has a sheet id, the Google Sheet is the master copy: an hourly GitHub Action copies it
  into `data/cards.json` and `data/sponsor.json` (see README "Edit cards in the Google Sheet"). Make data edits in
  the sheet (Google Sheets connector), not in the JSON, or the next sync overwrites them. The rules below still apply.
- Without a sheet, edit `data/cards.json` only. Never hard-code card facts in pages or components.
- Use `null` for anything the issuer does not publish. Never guess a fee, rate or country.
- Every change needs a source: add or update an entry in that card's `sources` (label, url, verified date)
  and set `lastChecked` to today (YYYY-MM-DD).
- `coverage.markets` values are only `yes`, `no` or `unknown` for IN, AE, US, GB, EU (checked for every card).
- `coverage.countryList` holds the issuer's own country list when it publishes one: `yes`, `no` and `unclear`
  arrays of ISO codes (e.g. `JP`), and `others` for every country not listed (`no` for a complete list).
  It must agree with `markets`; the validator checks. https://cardmap.org compiles issuer lists
  (see its data-official.js): use the issuer URL it cites as the source, never an aggregator-only list.
- A tier only offered in some countries gets `countries` (e.g. `["TH"]`, `"EEA"` for all 30 EEA countries), or
  `exceptCountries` (e.g. a "Global" tier when the US has its own). Country scores use these.
- `fees.fxByCurrency` (sheet "No-FX currencies", e.g. `USD 0; EUR 0.2`) and `fees.fxHome` ("Billed in your own
  currency") say which spending carries no FX fee; only from issuer sources, else leave empty. `fees.fxPct` stays the
  fee on all other currencies. Country currencies live in `lib/currencies.mjs`.
- Fees: when the issuer publishes its fees and lists no top-up or per-purchase fee, that fee is 0, not empty. Empty
  (not published) only when there is no fee list at all, or a fee is said to apply without the amount.
- Banking features (`ecosystem`; sheet columns "IBAN / bank account" named/shared/none, "Bank payout currencies" a
  number, "Fiat on/off-ramp" both/on/off/none, "Crypto-backed credit" and "Yield on balance" yes/no): issuer sources
  only; empty = not confirmed (scores 0).
- Real card pictures: "Card image" link in the sheet (`image.source`); the sync stores the files in
  `public/card-images/`. Only use issuer press-kit images or ones an issuer sent; never copy from other sites.
- Referral links go in `links.affiliate`; all "Get the card" buttons use `/go/<slug>`, which picks it up.
- Scores and ranks are computed (`lib/score.ts`). Never edit a rank or score by hand, and never change
  a card's position because of a referral deal.
- Run `npm run validate` and fix every error before committing.
- Sponsored spot: book it in the sheet's Sponsor tab (Card ID, Start, End as YYYY-MM-DD; empty = none), which the
  sync writes to `data/sponsor.json`. It is always labelled Sponsored and never changes a score or rank.

## Brand

- Rose gold metal on pearl (light) or obsidian (dark). Tokens at the top of `app/globals.css`.
- Fonts: Inter Tight (UI), Roboto Mono (labels and data).
- Logo: "Coin x Card" mark in `components/Logo.tsx`; files in `public/brand/`.
- Copy style: plain, short sentences, no hype, no "#1" claims.

## Map

- `app/` pages: home, `/cards`, `/cards/[slug]`, `/compare`, `/finder`, `/calculator`, `/methodology`, `/submit`
- `app/go/[slug]` outbound redirect with UTM tags
- `components/` UI, `lib/` logic (score, table engine, calculator, finder, regions), `middleware.ts` geo cookie
- `components/motion/` hero glyph field, scroll reveals, tilt; all off under reduced motion (no custom cursor)
- Settings via env vars, see `.env.example` and `README.md`
