#!/usr/bin/env node
// Writes the current card data as sheet tabs, to fill (or refill) the G2M Google Sheet:
//   npm run sheet:export -- <folder>
// Creates one CSV per tab plus tables.json, after checking the data survives a round trip unchanged.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardsToTables, formatCards, formatPicks, formatSponsor, parseCsv, tablesToCards, toCsv } from './sheet-format.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? join(root, 'sheet-export');
const cardsText = readFileSync(join(root, 'data', 'cards.json'), 'utf8');
const sponsorText = readFileSync(join(root, 'data', 'sponsor.json'), 'utf8');
const picksText = readFileSync(join(root, 'data', 'picks.json'), 'utf8');
const tables = cardsToTables(JSON.parse(cardsText), JSON.parse(sponsorText), JSON.parse(picksText));

const back = tablesToCards(Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, parseCsv(toCsv(v))])));
if (back.errors.length || formatCards(back.cards) !== cardsText || formatSponsor(back.sponsor) !== sponsorText || formatPicks(back.picks) !== picksText) {
  console.error('✖ The data does not survive a trip through the sheet unchanged:', back.errors.join('; ') || 'output differs');
  process.exit(1);
}

mkdirSync(out, { recursive: true });
for (const [tab, rows] of Object.entries(tables)) writeFileSync(join(out, `${tab}.csv`), toCsv(rows));
writeFileSync(join(out, 'tables.json'), JSON.stringify(tables));
console.log(`✔ Wrote ${Object.keys(tables).length} tabs to ${out}`);
