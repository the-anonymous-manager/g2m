import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const S = resolve(process.argv[2] ?? ".i18n-work");
const en = readFileSync(`${S}/missing-en.txt`, 'utf8').split('\n').filter(Boolean);
const tr = (await import(pathToFileURL(`${S}/tr-new.mjs`).href)).default;
if (en.length !== tr.length) throw new Error(`lines ${en.length} vs translations ${tr.length}`);
for (const lang of ['de', 'fr', 'es', 'pl', 'tr', 'ru', 'ar', 'zh-hk']) {
  const f = resolve(`data/i18n/${lang}.json`);
  const d = JSON.parse(readFileSync(f, 'utf8'));
  en.forEach((e, i) => {
    if (!tr[i][lang]) throw new Error(`${lang} ${i}`);
    d[e] = tr[i][lang];
  });
  const keys = Object.keys(d).sort();
  writeFileSync(f, '{\n' + keys.map((k) => JSON.stringify(k) + ': ' + JSON.stringify(d[k])).join(',\n') + '\n}');
}
console.log('merged', en.length);
