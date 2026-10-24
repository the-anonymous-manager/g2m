# Research rules for G2M (crypto card directory) — read before starting

G2M ranks crypto cards on a public site. Wrong data misleads real people, so:

- **Only issuer sources count**: the issuer's own site, help center, docs, fee schedule, card terms / cardholder
  agreement PDFs, or the issuer's official X account. Aggregators (DefiLlama, Card Map, cryptocards.so, review
  blogs) are leads only, never the source. Card Map data is saved locally at
  /tmp/claude-0/-home-user-g2m/6a48bc36-5acc-5521-b55f-37a20a1f7612/scratchpad/cardmap/ (data.js, data-providers.js
  with a SRC object of issuer URLs, data-official.js with issuer country-list URLs) — use it to find issuer pages fast.
- **Never guess.** If the issuer does not say, return null and say why. "Probably" is null.
- WebFetch may fail with DNS errors in this environment; if it does, use `curl -sSL -A "Mozilla/5.0" --max-time 25 URL`
  via Bash and strip HTML with python. Put downloads in your own new folder under
  /tmp/claude-0/-home-user-g2m/6a48bc36-5acc-5521-b55f-37a20a1f7612/scratchpad/research/ and read them with `python3 -I`.
- For every value give: the issuer URL, a short exact quote from that page that supports it, and today's date
  (2026-10-24) as the verified date. Match quotes against the downloaded page text.
- Don't sink more than ~10 minutes into one card; mark it null with the reason and move on.
- Current card data (what the site shows now, with existing source URLs) is in
  /tmp/claude-0/-home-user-g2m/6a48bc36-5acc-5521-b55f-37a20a1f7612/scratchpad/research/cards-brief.json
- Do NOT edit any file in /home/user/g2m. Write only your output JSON (path given in your task) and scratch files.
