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
- Bank rails ("Banking rails", `bankRails`): `EUR_SEPA in+out (fee or note); SWIFT out ($25)`; `none` = none offered,
  empty = not confirmed. "Bank account for non-residents": yes/no/empty. Issuer sources only.
- ID rules for nomad mode ("KYC eligibility rule", `kycRule`: `residency_id` / `passport_strict` / `both` / empty;
  "Restricted passports", `restrictedPassports`: `US; IR`, `none` = nationality does not matter, empty = not published).
  Issuer sources only. `/cards` and `/finder` use them with "My passport" + "Where I live" (`lib/nomad.ts`).
- "No ID check" (`noIdCheck`, last column): what you can get with no identity verification at all, per the issuer:
  `yes` = the whole card, else the option's name (e.g. SolCard `Virtual card`); empty = ID needed or not stated.
  Shows a badge on the card page, a "No ID check" rankings filter and a compare row. Never changes the score.
- Per-purchase limits: "Max cashback per purchase $" (`cashback.maxPerTxUsd`, e.g. Kolo 1); "Small purchase limit
  included" (`fees.smallPurchase.inclusive`: yes = "$1.00 or less", empty = "under $1"); "Free small purchases a month"
  (`fees.smallPurchase.freePerMonth`). Scores, calculator and receipt all use them.
- Welcome rates ("Intro cashback %" and "Intro offer days", `cashback.intro`): only short published welcome offers on
  the entry tier; the calculator's Year 1 uses them, scores never do.
- Real card pictures: "Card image" link in the sheet (`image.source`); the sync stores the files in
  `public/card-images/`. Only use issuer press-kit images or ones an issuer sent; never copy from other sites.
- Referral links go in `links.affiliate`; all "Get the card" buttons use `/go/<slug>`, which picks it up.
- "Sign-up bonus" (`signupBonus`) and "Referral code" (`referralCode`), the last two Cards columns: what someone gets
  for joining through G2M's link, in the issuer's own published terms (amount, spend needed, time limit), with a
  source row; and the code to type in the app. Both need a referral link. Shown in a box on the card page, a line on
  the home page tiles, a "Sign-up bonus" rankings filter and a compare row. Never changes a score or rank. Bonuses
  only the referrer gets (e.g. "you get $5 when your friend spends $50") don't count.
- Scores and ranks are computed (`lib/score.ts`). Never edit a rank or score by hand, and never change
  a card's position because of a referral deal.
- Run `npm run validate` and fix every error before committing.
- Home page top spot: the sheet's Sponsor tab (Card ID, Start, End as YYYY-MM-DD, Type), synced to `data/sponsor.json`.
  Type "Featured" (or empty) = paid: needs both dates, shown with a visible "Sponsored" note (paid placements must
  always be disclosed). Type "Our pick" = Akash's own choice, nobody paid: no "Sponsored" note, dates optional
  (none = always). Never mark an unpaid card as Featured. Empty row = the top-ranked card. Never changes a score or rank.
- Our picks (home page, 3 slots): the sheet's Picks tab (Slot 1-3, Card ID, Type "Our pick"/"Featured", Why, Start,
  End; Featured = paid, needs both dates, shows "Sponsored"), synced to `data/picks.json` (`lib/picks.ts`).
  Unbooked slots show cards listed in the last 30 days as "New on G2M", then the automatic picks (top ranked, best no
  annual fee, best non-custodial). Never changes a score or rank.
- New cards: nothing to date. The sync sets `addedOn` to the day a Card ID first reaches the site and keeps it after
  (no sheet column). Without a sheet, set `addedOn` (YYYY-MM-DD) in `data/cards.json` when listing a card.

## Brand

- Rose gold metal on pearl (light) or obsidian (dark). Tokens at the top of `app/globals.css`.
- Fonts: Inter Tight (UI), Roboto Mono (labels and data).
- Logo: "Coin x Card" mark in `components/Logo.tsx`; files in `public/brand/`.
- Copy style: plain, short sentences, no hype, no "#1" claims.
- Say "non-custodial", never "self-custodial", to visitors (Akash's call, 4 Nov 2026). The sheet's Custody column still
  holds the internal value `self-custodial`; it is shown as "Non-custodial". Write "non-custodial" in summaries, pros and notes.

## Map

- `app/` pages: home, `/cards`, `/cards/[slug]`, `/cards/[slug]/alternatives` (`lib/alternatives.ts`), `/cards/[slug]/referral-code` (`lib/referral.ts`), `/compare`, `/compare/[pair]` ("a-vs-b" SEO pages, `lib/verdict.ts`), `/guides` (country and topic guides, `lib/guides.ts`), `/finder`, `/calculator`, `/methodology`, `/submit`
- Guides, "X vs Y", alternatives and referral-code pages are built ahead of time at each deploy (`generateStaticParams`,
  served from static files, see `open-next.config.ts`): they must not read cookies, headers or the time of the request.
- Other languages (`lib/i18n/`): German, French, Spanish, Polish, Turkish, Russian, Arabic (right to left) and
  Traditional Chinese (Hong Kong) at `/de`, `/fr`, `/es`, `/pl`, `/tr`, `/ru`, `/ar`, `/zh-hk`. Each has a home page
  (`app/[lang]`), a page per card (`/de/cards/kast`) and country pages (`/de/best-crypto-cards/germany`). Every word
  comes from that language's dictionary (`lib/i18n/dict/<code>.ts`, same keys as `en.ts`) and every value from the
  card data; numbers, money, dates and country names come from Intl. Text typed in the sheet (summary, notes, pros,
  cons, bonus) is English only and is not shown there: never put English sheet text on a translated page. A new
  label needs a line in all nine dictionary files. To add a language: `LOCALES` in `locales.ts`, a `chrome.ts`
  entry, a dictionary file, and its line in `dict/index.ts`.
- `app/go/[slug]` outbound redirect with UTM tags; `/stats` (private) counts only people: crawler hits are stored as
  `auto:<event>` (`isAutomated` in `lib/stats/server.ts`)
- `components/` UI, `lib/` logic (score, table engine, calculator, finder, regions), `middleware.ts` geo cookie
- `components/motion/` hero glyph field, scroll reveals, tilt; all off under reduced motion (no custom cursor)
- Settings via env vars, see `.env.example` and `README.md`
