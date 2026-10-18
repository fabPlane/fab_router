import { resolve } from "node:path";
import { fanoutBoard, mixedFanoutBoard } from "../../../test/helpers/fanout-budget.ts";
const root = resolve(process.argv[2] ?? ".");
const { route, checkDrc } = await import(`${root}/src/api.ts`);
const { buildLattice } = await import(`${root}/src/lattice/index.ts`);
const { createJournal } = await import(`${root}/src/route/journal.ts`);
const { runFanout } = await import(`${root}/src/route/fanout.ts`);
const { resolveSettings } = await import(`${root}/src/pipeline/index.ts`);
const results = [];
for (let repeat = 1; repeat <= 3; repeat++) {
  const mixed = mixedFanoutBoard();
  const report = route(mixed, { fanoutEnabled: true, routerEnabled: false, optimizerEnabled: false, fanoutMaxItems: 1 });
  const L = fanoutBoard();
  const lattice = buildLattice(L), journal = createJournal(L, lattice);
  const initial = lattice.stats();
  const settings = resolveSettings({ fanoutEnabled: true, fanoutMaxItems: 1 }, undefined, L.angleMode);
  const rejected = runFanout(L, lattice, journal, settings, new Set());
  const afterRejection = { stats: journal.stats(), index: lattice.stats(), tracks: [...L.tracks], barrels: [...L.barrels] };
  const resumed = runFanout(L, lattice, journal, { ...settings, fanoutMaxItems: 4 }, new Set());
  results.push({ repeat, mixed: { report, tracks: mixed.tracks, barrels: mixed.barrels, violations: checkDrc(mixed).counts.violations },
    retry: { initial, rejected, afterRejection, resumed, tracks: L.tracks, barrels: L.barrels, violations: checkDrc(L).counts.violations } });
}
console.log(JSON.stringify(results, null, 2));
