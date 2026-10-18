import { resolve } from "node:path";
import { fanoutBoard } from "../../../test/helpers/fanout-budget.ts";
const root = resolve(process.argv[2] ?? ".");
const { route, checkDrc } = await import(`${root}/src/api.ts`);
const results = [];
for (let repeat = 1; repeat <= 3; repeat++) for (const cap of [0, 1, 2, 3, 4]) {
  const L = fanoutBoard();
  const report = route(L, { fanoutEnabled: true, routerEnabled: false, optimizerEnabled: false, fanoutMaxItems: cap });
  results.push({ repeat, cap, added: report.added, violations: checkDrc(L).counts.violations,
    tracks: L.tracks, barrels: L.barrels, withinBudget: L.tracks.length + L.barrels.length <= cap });
}
console.log(JSON.stringify(results, null, 2));
