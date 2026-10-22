#!/usr/bin/env node
// Pulls card data from the G2M Google Sheet into data/cards.json and data/sponsor.json.
//   npm run sheet:sync            check the sheet, then write the files if everything is valid
//   npm run sheet:sync -- --check only report whether the sheet differs (needs no npm install)
// The sheet is set in data/sheet.json. It must be shared as "Anyone with the link can view".
// Nothing is written unless every card passes. Problems are printed in plain words and also saved to
// sheet-sync-report.md, which the GitHub workflow posts as an issue.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadImages, imagesMissing, pruneImages } from './card-images.mjs';
import { TABS, formatCards, formatSponsor, parseCsv, sheetMessage, tablesToCards } from './sheet-format.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = (...p) => join(root, ...p);
const checkOnly = process.argv.includes('--check');

function report(lines) {
  writeFileSync(path('sheet-sync-report.md'), lines.map((l) => `- ${l}`).join('\n') + '\n');
}
function fail(lines) {
  console.error('✖ The sheet was not copied to the site:');
  for (const l of lines) console.error(`  - ${l}`);
  report(lines);
  process.exit(1);
}
function output(key, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

const config = JSON.parse(readFileSync(path('data', 'sheet.json'), 'utf8'));
if (!config.id) {
  console.log('No Google Sheet set in data/sheet.json yet. Nothing to do.');
  output('changed', 'false');
  process.exit(0);
}

async function fetchTab(tab) {
  const gid = config.tabs?.[tab];
  if (gid == null) throw new Error(`data/sheet.json has no tab id for "${tab}".`);
  const url = `https://docs.google.com/spreadsheets/d/${config.id}/export?format=csv&gid=${gid}`;
  let res;
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(url, { redirect: 'follow' });
      if (res.status < 500 || attempt === 3) break;
    } catch (e) {
      if (attempt === 3) throw new Error(`Could not reach Google Sheets (${e.message}).`);
    }
    await new Promise((r) => setTimeout(r, attempt * 2000));
  }
  const type = res.headers.get('content-type') ?? '';
  if (res.status === 401 || res.status === 403 || type.includes('text/html')) {
    throw new Error('Google would not share the sheet. In the sheet, click Share and set General access to "Anyone with the link" (Viewer).');
  }
  if (res.status === 400 || res.status === 404) {
    throw new Error(`The "${tab}" tab could not be found. Was it deleted or re-created? Tell Claude so it can update data/sheet.json.`);
  }
  if (!res.ok) throw new Error(`Google Sheets answered ${res.status} for the "${tab}" tab. It usually works again on the next run.`);
  return parseCsv(await res.text());
}

let tables;
try {
  tables = Object.fromEntries(await Promise.all(TABS.map(async (t) => [t, await fetchTab(t)])));
} catch (e) {
  fail([e.message]);
}

const { cards, sponsor, errors } = tablesToCards(tables);
if (errors.length) fail(errors);

const nextCards = formatCards(cards);
const nextSponsor = formatSponsor(sponsor);
const changed =
  nextCards !== readFileSync(path('data', 'cards.json'), 'utf8') ||
  nextSponsor !== readFileSync(path('data', 'sponsor.json'), 'utf8') ||
  imagesMissing(cards, root);
output('changed', String(changed));

// Which cards changed, for the commit message.
const before = JSON.parse(readFileSync(path('data', 'cards.json'), 'utf8'));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const names = [
  ...cards.filter((c) => !same(c, before.find((b) => b.slug === c.slug))).map((c) => c.name),
  ...before.filter((b) => !cards.some((c) => c.slug === b.slug)).map((b) => `${b.name} (removed)`)
];
if (nextSponsor !== readFileSync(path('data', 'sponsor.json'), 'utf8')) names.push('Sponsored spot');
output('summary', names.length > 4 ? `${names.slice(0, 4).join(', ')} and ${names.length - 4} more` : names.join(', '));

if (!changed) {
  console.log(`✔ The sheet matches the site (${cards.length} cards). Nothing to update.`);
  process.exit(0);
}
if (checkOnly) {
  console.log(`The sheet has changes (${cards.length} cards).`);
  process.exit(0);
}

// Full check with the same rules as the site (needs npm install for zod).
const { SponsorSchema, validateCards } = await import('../lib/card-schema.mjs');
const problems = [];
for (const e of validateCards(cards).errors) {
  const card = cards.find((c) => c.slug === e.card) ?? { slug: e.card };
  for (const issue of e.issues) problems.push(sheetMessage(card, issue));
}
const booking = SponsorSchema.safeParse(sponsor);
if (!booking.success) problems.push(`Sponsor tab: ${booking.error.issues.map((i) => i.message).join('; ')}`);
if (problems.length) fail(problems);

// Card pictures: download new ones (needs sharp, installed with npm install) and drop unused ones.
const imageProblems = await downloadImages(cards, root);
if (imageProblems.length) fail(imageProblems);
pruneImages(cards, root);

writeFileSync(path('data', 'cards.json'), nextCards);
writeFileSync(path('data', 'sponsor.json'), nextSponsor);
console.log(`✔ Copied ${cards.length} cards from the sheet.`);
