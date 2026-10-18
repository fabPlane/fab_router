/** bun audit.ts SOURCE_DIR OUTPUT_JSON EXPECT: cleanup | ignored | composed */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { ignoredOptimisationBoard } from "../../../../test/helpers/ignored-optimisation.ts";
const root = resolve(Bun.argv[2]!);
const { route, checkDrc } = await import(pathToFileURL(resolve(root, "src/api.ts")).href);
const mode = Bun.argv[4]!;
assert(["cleanup", "ignored", "composed"].includes(mode));
const runs = [];
for (let repeat = 1; repeat <= 3; repeat++) {
  const layout = ignoredOptimisationBoard();
  // Detached copper on an ignored net must survive. An identical active-net
  // island must be removed by cleanup. Neither island touches a terminal.
  layout.nets.push({ id: 1, name: "ACTIVE", group: 1, pads: [] });
  layout.netGroups.push({ ...layout.netGroups[0]!, id: 1, name: "active", nets: [1] });
  for (const [id, net, y] of [[30, 0, -30000], [31, 1, 30000]]) {
    layout.tracks.push({ id: id!, net: net!, sheet: 0,
      pts: [{ x: -10000, y: y! }, { x: 10000, y: y! }], width: 2000,
      kind: 1, hold: "free", origin: "router" });
  }
  const before = structuredClone({ tracks: layout.tracks, barrels: layout.barrels });
  assert.equal(checkDrc(layout).counts.incompletes, 0);
  const report = route(layout, { ignoreNetGroups: ["preserve"], fanoutEnabled: false, maxPasses: 1 });
  const after = { tracks: layout.tracks, barrels: layout.barrels };
  const preserved = JSON.stringify(after.tracks.filter(t => t.net === 0)) === JSON.stringify(before.tracks.filter(t => t.net === 0))
    && JSON.stringify(after.barrels) === JSON.stringify(before.barrels);
  const activeIslandRemoved = !after.tracks.some(t => t.id === 31);
  assert.equal(preserved, mode !== "cleanup");
  assert.equal(activeIslandRemoved, mode !== "ignored");
  assert.deepEqual(after.tracks.find(t => t.id === 30), before.tracks.find(t => t.id === 30));
  assert.equal(checkDrc(layout).counts.incompletes, mode === "cleanup" ? 1 : 0);
  assert.equal(report.violationsAdded, 0);
  runs.push({ repeat, before, after, preserved, activeIslandRemoved, report,
    drc: checkDrc(layout).counts });
}
await Bun.write(Bun.argv[3]!, JSON.stringify({ mode, runs }, null, 2) + "\n");
console.log({ mode, repeats: runs.length, preserved: runs[0]!.preserved, activeIslandRemoved: runs[0]!.activeIslandRemoved });
