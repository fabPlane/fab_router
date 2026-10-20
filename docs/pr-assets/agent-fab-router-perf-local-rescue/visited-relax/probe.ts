import { readFileSync, writeFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
const root = import.meta.dir;
for (const variant of ['control', 'candidate']) {
  const s = readFileSync(`${root}/${variant}/src/route/search.ts`, 'utf8');
  const start = s.indexOf('const NONE = -1;');
  const end = s.indexOf('// One pooled frontier/visited pair;');
  assert(start >= 0 && end > start);
  writeFileSync(`${root}/${variant}-store.ts`, s.slice(start, end).replace('class VisitedStore', 'export class VisitedStore'));
}
const { VisitedStore: Old } = await import(`${root}/control-store.ts`);
const { VisitedStore: New } = await import(`${root}/candidate-store.ts`);
const a = new Old(), b = new New();
let random = 5237, checks = 0;
const rand = () => (random = (Math.imul(random, 1664525) + 1013904223) >>> 0);
const eq = (x: unknown, y: unknown) => { assert.deepEqual(x, y); checks++; };
for (let generation = 0; generation < 8; generation++) {
  a.reset(); b.reset();
  const keys: number[] = [];
  for (let i = 0; i < 24000; i++) {
    const k = i % 3 === 0 && keys.length ? keys[rand() % keys.length]! : rand() * 9 + (i % 9);
    keys.push(k);
    const score = i % 113 === 0 ? NaN : i % 127 === 0 ? Infinity : i % 131 === 0 ? -Infinity : (rand() % 2000) / 7;
    const parent = keys[rand() % keys.length]!;
    const accepted = !a.leq(k, score);
    if (accepted) a.put(k, score, parent);
    eq(b.relax(k, score, parent), accepted);
    eq(b.gOr(k, Infinity), a.gOr(k, Infinity));
    eq(b.parentOf(k), a.parentOf(k));
    if (i % 7 === 0) { a.put(k, score, parent); b.put(k, score, parent); }
    const missing = k + 1e14;
    eq(b.gOr(missing, -19), a.gOr(missing, -19));
    eq(b.parentOf(missing), a.parentOf(missing));
  }
  for (const k of keys) { eq(b.gOr(k, Infinity), a.gOr(k, Infinity)); eq(b.parentOf(k), a.parentOf(k)); }
}
console.log(`PASS: ${checks} differential comparisons; growth, overwrites, resets, high keys, missing states, ties and nonfinite scores`);
