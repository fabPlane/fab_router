import { resolve } from "node:path";
import { prewiredFanoutBoard } from "../../../test/helpers/fanout-budget.ts";
const root = resolve(process.argv[2] ?? ".");
const { route, checkDrc } = await import(`${root}/src/api.ts`);
const { buildLattice } = await import(`${root}/src/lattice/index.ts`);
const { createJournal } = await import(`${root}/src/route/journal.ts`);
const { runFanout } = await import(`${root}/src/route/fanout.ts`);
const { resolveSettings } = await import(`${root}/src/pipeline/index.ts`);
const results = [];
for (let repeat = 1; repeat <= 3; repeat++) {
  const caps = [1, 2].map(cap => {
    const L = prewiredFanoutBoard();
    const report = route(L, { fanoutEnabled: true, routerEnabled: false, optimizerEnabled: false, fanoutMaxItems: cap });
    return { cap, report, tracks: L.tracks, barrels: L.barrels, violations: checkDrc(L).counts.violations };
  });
  const L = prewiredFanoutBoard(), lattice = buildLattice(L), journal = createJournal(L, lattice);
  const prior = journal.addTrack({ net: 1, sheet: 0, pts: [{ x: -100000, y: 150000 }, { x: 100000, y: 150000 }],
    width: 4000, kind: 1, hold: "free" });
  journal.remove(20);
  const mark = journal.mark();
  const settings = resolveSettings({ fanoutEnabled: true, fanoutMaxItems: 3 }, undefined, L.angleMode);
  const outcome = runFanout(L, lattice, journal, settings, new Set());
  const accepted = structuredClone({ outcome, stats: journal.stats(), inserted: journal.insertedSince(0),
    tracks: L.tracks, barrels: L.barrels, violations: checkDrc(L).counts.violations });
  journal.rewind(mark);
  const stageRewind = structuredClone({ stats: journal.stats(), tracks: L.tracks, barrels: L.barrels });
  journal.rewind(0);
  results.push({ repeat, caps, prior, accepted, stageRewind,
    completeRewind: { stats: journal.stats(), tracks: L.tracks, barrels: L.barrels } });
}
console.log(JSON.stringify(results, null, 2));
