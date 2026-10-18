/** Run each workload in a separate process so Box and Dop8 call sites do not mix. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const [baseline, candidate, kind, output] = process.argv.slice(2);
if (!baseline || !candidate || !output || !['box-plain', 'box-dop8', 'sweep'].includes(kind ?? '')) {
  throw new Error('Expected BASELINE_SOURCE CANDIDATE_SOURCE box-plain|box-dop8|sweep OUTPUT_JSON');
}
if (existsSync(output)) throw new Error('Output already exists; use a new path');
const load = (root: string, file: string) => import(pathToFileURL(resolve(root, file)).href);
const { createLattice: before } = await load(baseline, 'src/lattice/grid.ts');
const { createLattice: after } = await load(candidate, 'src/lattice/grid.ts');
const { emptyLayout } = await load(baseline, 'src/layout/index.ts');
const { dop8OfPts } = await load(baseline, 'src/geom/index.ts');
const indexes = {
  before: before(emptyLayout('micro'), { cellSize: 1000 }),
  after: after(emptyLayout('micro'), { cellSize: 1000 }),
};
let state = 123;
const rnd = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
const slots = [];
for (let id = 0; id < 2000; id++) {
  const x = Math.floor(rnd() * 100000), y = Math.floor(rnd() * 100000), r = id % 10 === 0 ? 5000 : 500;
  const d = dop8OfPts([{ x, y }, { x: x + r, y: y + r }]);
  slots.push({ id, bounds: d });
  for (const lattice of Object.values(indexes)) lattice.insert({ id }, 0, d);
}
const queries = Array.from({ length: 10000 }, () => {
  const x = Math.floor(rnd() * 100000), y = Math.floor(rnd() * 100000);
  const d = dop8OfPts([{ x, y }, { x: x + 1000, y: y + 1000 }]);
  return kind === 'box-plain' ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : d;
});
const hits = (lattice: any, query: any) => kind === 'sweep' ? lattice.sweepHits(0, query) : lattice.hits(0, query);
const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
// Compare every ordered ref array, outside timing. Sum-of-ids checksums alone miss wrong hits.
const exact = createHash('sha256');
for (const q of queries) {
  const b = hits(indexes.before, q), a = hits(indexes.after, q);
  if (!isDeepStrictEqual(b, a)) throw new Error('Ordered query results differ');
  exact.update(JSON.stringify(b) + '\n');
}
const rows: Array<{ repeat: number; version: keyof typeof indexes; seconds: number; checksum: number }> = [];
const report = {
  schema: 1, kind, host: 'hyper-ms-lin', bun: Bun.version,
  allowedCpus: readFileSync('/proc/self/status', 'utf8').match(/^Cpus_allowed_list:\s*(.*)$/m)?.[1],
  sources: Object.fromEntries(Object.entries({ before: baseline, after: candidate }).map(([v, root]) => [v, {
    path: resolve(root), gridSha256: hash(readFileSync(resolve(root, 'src/lattice/grid.ts'))),
  }])),
  slots: slots.length, queries: queries.length, callsPerRow: 10000000,
  inputSha256: hash(JSON.stringify({ slots, queries })),
  slotSha256: hash(JSON.stringify(slots)),
  boxQueriesSha256: hash(JSON.stringify(queries.map(q => [q.x0, q.y0, q.x1, q.y1]))),
  orderedResultsSha256: exact.digest('hex'),
  warmupRepeats: [0], utcStart: new Date().toISOString(), rows,
};
for (let repeat = 0; repeat < 7; repeat++) {
  for (const version of (repeat % 2 ? ['after', 'before'] : ['before', 'after']) as Array<keyof typeof indexes>) {
    const lattice = indexes[version];
    let checksum = 0;
    const start = performance.now();
    for (let j = 0; j < 1000; j++) for (const q of queries) {
      for (const r of hits(lattice, q)) checksum = (checksum + r.id) >>> 0;
    }
    const row = { repeat, version, seconds: (performance.now() - start) / 1000, checksum };
    rows.push(row);
    console.log(row);
  }
}
if (new Set(rows.map(r => r.checksum)).size !== 1) throw new Error('Timed checksums differ');
writeFileSync(output, JSON.stringify({ ...report, utcEnd: new Date().toISOString() }, null, 2) + '\n');
