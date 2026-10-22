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

- Edit `data/cards.json` only. Never hard-code card facts in pages or components.
- Use `null` for anything the issuer does not publish. Never guess a fee, rate or country.
- Every change needs a source: add or update an entry in that card's `sources` (label, url, verified date)
  and set `lastChecked` to today (YYYY-MM-DD).
- `coverage.markets` values are only `yes`, `no` or `unknown` for IN, AE, US, GB, EU.
- Referral links go in `links.affiliate`; all "Get the card" buttons use `/go/<slug>`, which picks it up.
- Scores and ranks are computed (`lib/score.ts`). Never edit a rank or score by hand, and never change
  a card's position because of a referral deal.
- Run `npm run validate` and fix every error before committing.
- Sponsored spot: book it in `data/sponsor.json` (`slug`, `start`, `end` as YYYY-MM-DD; `slug: null` = none).
  It is always labelled Sponsored and never changes a score or rank.

## Brand

- Rose gold metal on pearl (light) or obsidian (dark). Tokens at the top of `app/globals.css`.
- Fonts: Inter Tight (UI), Roboto Mono (labels and data).
- Logo: "Coin x Card" mark in `components/Logo.tsx`; files in `public/brand/`.
- Copy style: plain, short sentences, no hype, no "#1" claims.

## Map

- `app/` pages: home, `/cards`, `/cards/[slug]`, `/compare`, `/finder`, `/calculator`, `/methodology`, `/submit`
- `app/go/[slug]` outbound redirect with UTM tags
- `components/` UI, `lib/` logic (score, table engine, calculator, finder, regions), `middleware.ts` geo cookie
- Settings via env vars, see `.env.example` and `README.md`
