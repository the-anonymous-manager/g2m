// Tells Bing (and the other IndexNow search engines: Yandex, Seznam, Naver) which pages changed in a deploy, so they
// fetch them again within hours instead of waiting for their next visit. Google does not use IndexNow; it reads the
// sitemap.
//
//   node scripts/indexnow.mjs <sitemap before deploy> <sitemap after deploy>   only new pages and pages with a new date
//   node scripts/indexnow.mjs --all <sitemap>                                  every page (first run, or after big changes)
//   add --dry-run to print the list without sending it
//
// The key is not a secret: IndexNow checks it by reading https://g2m.life/<key>.txt, which holds the same text.
// Run by .github/workflows/cf-deploy.yml after each deploy. It never fails the deploy.
import { readFileSync, existsSync } from 'node:fs';

const KEY = '00504a6a775f25b104f2649439b337d7';
const HOST = 'g2m.life';
const KEY_URL = `https://${HOST}/${KEY}.txt`;
const LIMIT = 10000; // IndexNow takes at most 10,000 addresses per request

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const all = args.includes('--all');
const files = args.filter((a) => !a.startsWith('--'));

/** Address → lastmod, read from a sitemap file. An empty map when the file is missing or not a sitemap. */
function read(file) {
  const map = new Map();
  if (!file || !existsSync(file)) return map;
  const xml = readFileSync(file, 'utf8');
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1].match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim();
    const mod = m[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim() ?? '';
    if (loc) map.set(loc.replace(/&amp;/g, '&'), mod);
  }
  return map;
}

const after = read(all ? files[0] : files[1]);
if (!after.size) {
  console.log('IndexNow: no sitemap to read, nothing sent.');
  process.exit(0);
}
let urls;
if (all) {
  urls = [...after.keys()];
} else {
  const before = read(files[0]);
  if (!before.size) {
    // Without the old list there is no way to tell what changed; sending all 4,000+ pages on every deploy would be
    // ignored as spam, so send nothing (a manual run with "Send every page" covers this).
    console.log('IndexNow: could not read the sitemap from before the deploy, nothing sent.');
    process.exit(0);
  }
  urls = [...after].filter(([u, mod]) => before.get(u) !== mod).map(([u]) => u);
}
urls = urls.filter((u) => new URL(u).host === HOST);
if (!urls.length) {
  console.log('IndexNow: no new or changed pages in this deploy, nothing sent.');
  process.exit(0);
}
console.log(`IndexNow: ${urls.length} page(s) to send${dry ? ' (dry run)' : ''}.`);
for (const u of urls.slice(0, 20)) console.log(`  ${u}`);
if (urls.length > 20) console.log(`  ... and ${urls.length - 20} more`);
if (dry) process.exit(0);

// The search engines read the key file before they accept the list, so wait until the new deploy serves it.
let live = false;
for (let i = 0; i < 6 && !live; i++) {
  if (i) await new Promise((r) => setTimeout(r, 10000));
  try {
    const res = await fetch(`${KEY_URL}?t=${Date.now()}`);
    live = res.ok && (await res.text()).trim() === KEY;
  } catch {}
}
if (!live) {
  console.log(`IndexNow: ${KEY_URL} is not live yet, nothing sent.`);
  process.exit(0);
}

for (let i = 0; i < urls.length; i += LIMIT) {
  const urlList = urls.slice(i, i + LIMIT);
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_URL, urlList })
    });
    // 200 = received, 202 = received and the key is still being checked. Anything else is logged, not fatal.
    console.log(
      `IndexNow: sent ${urlList.length}, answer ${res.status} ${res.statusText}${res.ok ? '' : `: ${(await res.text()).slice(0, 300)}`}`
    );
  } catch (e) {
    console.log(`IndexNow: could not send (${e.message}).`);
  }
}
