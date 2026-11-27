import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const S = resolve(process.argv[2] ?? ".i18n-work");
const en = readFileSync(`${S}/missing-en.txt`, 'utf8').split('\n').filter(Boolean);
const tr = (await import(pathToFileURL(`${S}/tr-new.mjs`).href)).default;
if (en.length !== tr.length) { console.log(`lines ${en.length} vs translations ${tr.length}`); process.exit(1); }
const nums = (s) => (s.match(/\d+/g) ?? []).sort().join(' ');
let bad = 0;
en.forEach((e, i) => {
  for (const [lang, t] of Object.entries(tr[i])) {
    if (nums(e) !== nums(t)) { bad++; console.log(i, lang, '| en:', nums(e), '| tr:', nums(t)); }
  }
});
console.log('mismatches', bad);
