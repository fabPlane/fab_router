/** bun --cpu-prof profile-route.ts SOURCE_CHECKOUT NATIVE_WORK_DIRECTORY [REPEATS] */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const [source, work, repeats = "3"] = process.argv.slice(2);
if (!source || !work) throw new Error("Expected SOURCE_CHECKOUT NATIVE_WORK_DIRECTORY [REPEATS]");
const { routeDsn } = await import(pathToFileURL(resolve(source, "src/api.ts")).href);
const text = readFileSync(resolve(work, "board.dsn"), "utf8");
const manifest = JSON.parse(readFileSync(resolve(work, "dsn-manifest.json"), "utf8"));
const candidate = JSON.parse(readFileSync(resolve(work, "candidate-settings.json"), "utf8"));
const settings = {
  timeBudgetMs: 3600000, maxPasses: 100, seed: 2,
  copperToEdgeClearanceUm: manifest.native_rules.min_copper_edge_clearance * 1000,
  holeClearanceUm: manifest.native_rules.min_hole_clearance * 1000,
  strictDrc: true, neckWidthUm: 0, fanoutEnabled: false,
  ignoreNetGroups: manifest.ignore_classes, ...candidate.settings,
};
for (let i = 0; i < Number(repeats); i++) {
  const started_utc=new Date().toISOString();
  const start = performance.now();
  const logs: string[] = [];
  const result = routeDsn(text, settings, {onLog: (_: unknown, s: string) => logs.push(s)});
  const seconds = (performance.now() - start) / 1000;
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  console.log(JSON.stringify({ started_utc,finished_utc:new Date().toISOString(),settings,input_sha256:createHash("sha256").update(text).digest("hex"),grid_sha256:createHash("sha256").update(readFileSync(resolve(source,"src/lattice/grid.ts"))).digest("hex"),bounds_sha256:createHash("sha256").update(readFileSync(resolve(source,"src/geom/bounds.ts"))).digest("hex"),clear_sha256:createHash("sha256").update(readFileSync(resolve(source,"src/route/clear.ts"))).digest("hex"),distance_sha256:createHash("sha256").update(readFileSync(resolve(source,"src/geom/distance.ts"))).digest("hex"),seconds, logs, report: result.report, statsBefore: result.statsBefore, statsAfter: result.statsAfter, ses_sha256: createHash("sha256").update(result.ses).digest("hex") }));
}

if ((globalThis as any).__latticeCensus) console.log(JSON.stringify({census:(globalThis as any).__latticeCensus}));
