# G2M · Gwei 2 Merchant

**Spend your bags better.** From on-chain to checkout.

The crypto card directory for g2m.life: every crypto card ranked on rewards, fees and where it actually works,
with a card finder, a rewards calculator and side-by-side compare. Light and dark mode, rose gold brand.

Built with Next.js 15 (App Router), React 19, TypeScript and Zod. No database: all card data lives in one file,
`data/cards.json`.

---

## Run it on your computer

You need Node.js 18.18 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
```

Production build:

```bash
npm run build      # checks cards.json first, then builds
npm start
```

## Put it live on g2m.life (Vercel)

Vercel's free Hobby plan handles the traffic, but its terms limit it to non-commercial sites. Launch on Hobby, then
move to the Pro plan (see vercel.com/pricing) before adding the first referral link in `links.affiliate`, since
referral fees make the site commercial. No other hosting or database is needed.

1. Push this folder to a GitHub repo (private is fine).
2. On vercel.com: **Add New → Project → Import** the repo. Framework is detected as Next.js. Click **Deploy**.
3. In the project: **Settings → Environment Variables**, add the ones you need (see below), then redeploy.
4. **Settings → Domains → Add** `g2m.life` (and `www.g2m.life`). Vercel shows the DNS records to add at your domain
   registrar. HTTPS is automatic.

Every push to the main branch redeploys the site.

> Other hosts (Netlify, Cloudflare, a VPS) also work. Region detection reads `x-vercel-ip-country`,
> `cf-ipcountry` or `x-country`; without any of them the site falls back to the visitor's timezone.

## Settings (environment variables)

Copy `.env.example` to `.env.local` for local use, or add them in Vercel.

| Variable | What it does |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL, default `https://g2m.life` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Where "Submit a card" messages go, default `info@g2m.life` |
| `NEXT_PUBLIC_TWITTER_HANDLE` | Your X handle, default `@0akash0x`. Adds an X link and Twitter card tags |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Turns on Plausible analytics for that domain (no cookies) |

## Edit cards in the Google Sheet

Once the sheet is set up (its id and tab ids in `data/sheet.json`), the Google Sheet is the master copy of the card
data. A GitHub Action (`.github/workflows/sheet-sync.yml`) checks it every hour at :17, and on demand from
**Actions → Sync cards from Google Sheet → Run workflow**. When the sheet changed and every card passes the same
checks as the build, it rewrites `data/cards.json` and `data/sponsor.json`, builds, and pushes to `main`, which
deploys the site. If anything is wrong, nothing is published and an issue labelled `sheet-sync` says what to fix,
in sheet terms (tab, card, column). It closes itself when a later run succeeds.

- The sheet must be shared as "Anyone with the link can view" (the action reads it without signing in).
- Tabs: Cards (one row per card), Tiers, Country lists, Sources (rows point at a card by its Card ID), Sponsor.
- Empty cell = not published. Lists in one cell: one item per line; country codes, forms and assets with commas.
- Tier cashback that changes with spend: `2.5% up to $10000; 2%`.
- Cells are plain text, so `2026-10-22` and `1.5%` stay exactly as typed. Text starting with `+` or `=` still needs
  an apostrophe in front (`'+1% back`), or Google treats it as a formula; the sync rejects `#ERROR!` cells.
- Card pictures: paste a link in "Card image" (Cards tab). The sync downloads it once (Google Drive and Dropbox
  share links work), trims a plain border, and saves `public/card-images/<slug>-<hash>.webp` (1000 x 631),
  `-sm.webp` (184 x 116) and `.png` (for share images). Card-shaped pictures fill the card; upright ones are fitted
  inside. A link that is broken or not a picture stops the sync with a `sheet-sync` issue. No link = metal art.
- `npm run sheet:export -- <folder>` writes the current data as one CSV per tab (to refill the sheet);
  `npm run sheet:sync` pulls the sheet locally.

While the sheet is in use, edits made straight to `data/cards.json` are overwritten by the next sync: make them in
the sheet instead.

## Add or update a card by hand

Without a sheet, everything is in `data/cards.json`. Copy an existing card, change the values, then run:

```bash
npm run validate
```

It lists any mistakes (missing fields, wrong formats, duplicate slugs) and warns about cards not re-checked in
90 days. The live site never crashes on a bad edit: an invalid card is skipped and logged.

Key fields:

- `slug` lowercase id used in the URL (`/cards/kast`)
- `cashback.basePct` the rate most people get, `cashback.maxPct` the best tier. Use `null` when not published.
- `fees.annualUsd`, `fees.fxPct`, `fees.topUpPct`, `fees.txPct`, `fees.txFlatUsd`
- `tiers[]` each plan with its yearly cost, cashback (or `bands` when the rate changes with spend), caps and perks
- `coverage.markets` `yes`, `no` or `unknown` for `IN`, `AE`, `US`, `GB`, `EU`
- `links.official` the issuer's site. Add `links.affiliate` with your referral link and every "Get the card" button
  on the site uses it automatically (through `/go/<slug>`, with UTM tags).
- `sources[]` where each figure came from, and `lastChecked` (YYYY-MM-DD)
- `metal` the colour of the card art: `rose`, `gold`, `silver`, `black`, `champagne` or `gunmetal`

## How the score works

`lib/score.ts`. Rewards 40, fees 30, coverage 20, control 10. The same rules for every card; missing figures score
below known good values. Explained for visitors at `/methodology`.

## Project map

```
app/                 pages (home, /cards, /cards/[slug], /compare, /finder, /calculator, /methodology, /submit)
app/go/[slug]        outbound redirect with UTM tags and referral links
components/          UI pieces (rankings table, compare, finder, calculator, logo, card art)
lib/                 data loading, schema, score, table engine, calculator, finder, regions
data/cards.json      all card data (written by the sheet sync once the Google Sheet is set up)
data/sheet.json      which Google Sheet and tabs the hourly sync reads
scripts/             validator, Google Sheet sync and export
public/brand/        logo files (SVG, PNG, X avatar)
middleware.ts        stores the visitor's country for region defaults
```

Analytics events (Plausible or any tool listening to the `g2m:track` browser event): Outbound, Compare add,
Compare open, Share, Finder, Calculator, Region, Theme, Submit.

Not financial advice. Card terms change often; keep `lastChecked` current.
