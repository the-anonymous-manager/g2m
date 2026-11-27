# Translating new sheet text (helper scripts)

Used after a sheet edit adds English text that the eight languages need (see CLAUDE.md, Map, "Other languages").
The work folder `.i18n-work/` is git-ignored.

1. `npm run i18n:missing -- --json` writes `data/i18n/missing.json` (every missing English line, per language).
2. `node -e 'const m=require("./data/i18n/missing.json"); require("fs").mkdirSync(".i18n-work",{recursive:true}); require("fs").writeFileSync(".i18n-work/missing-en.txt", m.de.join("\n"))'`
3. Write `.i18n-work/tr-new.mjs`, one entry per line of `missing-en.txt`, in the same order:
   ```js
   const L = (de, fr, es, pl, tr, ru, ar, zh) => ({ de, fr, es, pl, tr, ru, ar, 'zh-hk': zh });
   export default [ L('…de…', '…fr…', '…es…', '…pl…', '…tr…', '…ru…', '…ar…', '…zh-hk…') ];
   ```
   Keep every number as in the English; amounts stay English-style (`$2,000`). Use digits in Arabic.
4. `node scripts/i18n-tools/numcheck.mjs .i18n-work` lists lines whose numbers differ from the English.
   Chinese month numbers (11月) are the usual harmless difference; fix anything else.
5. `node scripts/i18n-tools/merge.mjs .i18n-work` writes the translations into `data/i18n/<code>.json`.
6. `rm data/i18n/missing.json && npm run i18n:missing` should say "Everything is translated."

Score check after a data change: `npx tsx scripts/rank-check.ts` prints every card whose score or rank differs from the
last commit (and new cards). Nothing printed = no change.
