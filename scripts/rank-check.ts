import { execSync } from 'node:child_process';
import raw from '@/data/cards.json';
import { validateCards } from '@/lib/card-schema.mjs';
import { scoreCard } from '@/lib/score';
const before = JSON.parse(execSync('git show HEAD:data/cards.json').toString());
const rank = (list: any[]) => (validateCards(list).valid as any[]).map((c) => ({ slug: c.slug, s: scoreCard(c).total })).sort((a, b) => b.s - a.s).map((c, i) => ({ ...c, r: i + 1 }));
const a = rank(before), b = rank(raw as any);
for (const x of b) { const o = a.find((y) => y.slug === x.slug); if (!o) { console.log('new', x.slug, `score ${x.s}`, `rank ${x.r}`); continue; } if (o.s !== x.s || o.r !== x.r) console.log(x.slug, `score ${o.s} -> ${x.s}`, `rank ${o.r} -> ${x.r}`); }
