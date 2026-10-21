#!/usr/bin/env node
// Strict check for data/cards.json. Run it before committing card edits (or in CI):
//   npm run validate
// Exits with code 1 if any card is invalid. The website build itself never crashes on bad
// data: lib/cards.ts skips invalid cards and logs a warning instead.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateCards } from '../lib/card-schema.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'data', 'cards.json');

let raw;
try {
  raw = JSON.parse(readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`✖ Could not read data/cards.json: ${err.message}`);
  process.exit(1);
}

const { valid, errors } = validateCards(raw);
const today = new Date();
const stale = valid.filter((c) => (today - new Date(c.lastChecked)) / 86400000 > 90);

if (errors.length) {
  console.error(`✖ ${errors.length} invalid card(s):`);
  for (const e of errors) {
    console.error(`  • ${e.card}`);
    for (const issue of e.issues) console.error(`      - ${issue}`);
  }
}
if (stale.length) {
  console.warn(`! ${stale.length} card(s) not re-checked in 90+ days: ${stale.map((c) => c.slug).join(', ')}`);
}
console.log(`${errors.length ? '✖' : '✔'} ${valid.length} valid card(s) in data/cards.json`);
process.exit(errors.length ? 1 : 0);
