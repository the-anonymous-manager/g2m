// Lists the English text that has no translation yet in data/i18n/<language>.json: card summaries, pros, cons and
// sign-up bonuses from data/cards.json, the home page picks' notes (data/picks.json) and the topic guide text in
// lib/guides.ts. Translated pages show missing text in English (marked as English) until it is added, so this only
// reports, it never fails the build.
//
//   npm run i18n:missing            counts per language, and the missing lines
//   npm run i18n:missing -- --json  writes data/i18n/missing.json ({ "de": ["English text", ...], ... }) to hand out
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

const cards = JSON.parse(read('data/cards.json'));
const list = Array.isArray(cards) ? cards : cards.cards;
const sheet = list.flatMap((c) => [c.summary, ...(c.pros ?? []), ...(c.cons ?? []), c.signupBonus].filter(Boolean));
// The "why" line of each home page pick (the sheet's Picks tab).
const picks = JSON.parse(read('data/picks.json')).map((p) => p.note).filter(Boolean);

// The guide text: the title, description, intro and tips of every topic between TOPICS and FEES_GUIDE.
const src = read('lib/guides.ts');
const block = src.slice(src.indexOf('export const TOPICS'), src.indexOf('export const FEES_GUIDE'));
const str = /'((?:\\.|[^'\\])*)'/g;
const unq = (s) => s.replace(/\\(.)/g, '$1');
const guides = [];
for (const m of block.matchAll(/(title|description|intro|tips):\s*(\[[\s\S]*?\]|'(?:\\.|[^'\\])*')/g)) {
  for (const s of m[2].matchAll(str)) guides.push(unq(s[1]));
}

const wanted = [...new Set([...guides, ...sheet, ...picks])];
const langs = readdirSync(new URL('data/i18n/', root))
  .filter((f) => f.endsWith('.json') && f !== 'missing.json')
  .map((f) => f.replace(/\.json$/, ''));

const out = {};
let total = 0;
for (const code of langs) {
  const have = JSON.parse(read(`data/i18n/${code}.json`));
  const missing = wanted.filter((s) => !have[s]);
  const unused = Object.keys(have).filter((k) => !wanted.includes(k)).length;
  out[code] = missing;
  total += missing.length;
  console.log(`${code}: ${wanted.length - missing.length} of ${wanted.length} translated${missing.length ? `, ${missing.length} missing` : ''}${unused ? ` (${unused} old lines no longer used)` : ''}`);
  if (!process.argv.includes('--json')) for (const s of missing) console.log(`  - ${s}`);
}
if (process.argv.includes('--json')) {
  writeFileSync(new URL('data/i18n/missing.json', root), JSON.stringify(out, null, 2) + '\n');
  console.log('Wrote data/i18n/missing.json');
}
if (!total) console.log('Everything is translated.');
