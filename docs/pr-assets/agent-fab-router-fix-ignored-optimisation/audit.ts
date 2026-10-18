/** bun audit.ts SOURCE_DIR OUTPUT_JSON — three identical public-API route calls. */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ignoredOptimisationBoard } from "../../../test/helpers/ignored-optimisation.ts";
const source = resolve(Bun.argv[2]!);
const { route, checkDrc } = await import(pathToFileURL(resolve(source, "src/api.ts")).href);
const runs = [];
for (let repeat = 1; repeat <= 3; repeat++) {
  const layout = ignoredOptimisationBoard();
  const before = { tracks: structuredClone(layout.tracks), barrels: structuredClone(layout.barrels), incompletes: checkDrc(layout).counts.incompletes };
  const report = route(layout, { ignoreNetGroups: ["preserve"], fanoutEnabled: false, maxPasses: 1 });
  runs.push({ repeat, before, after: { tracks: layout.tracks, barrels: layout.barrels, incompletes: checkDrc(layout).counts.incompletes }, report });
}
await Bun.write(Bun.argv[3]!, JSON.stringify(runs, null, 2) + "\n");
console.log(runs.map(r => ({ repeat: r.repeat, beforeOpens: r.before.incompletes, afterOpens: r.after.incompletes, viasBefore: r.before.barrels.length, viasAfter: r.after.barrels.length, reportIncompleteAfter: r.report.incompleteAfter })));
