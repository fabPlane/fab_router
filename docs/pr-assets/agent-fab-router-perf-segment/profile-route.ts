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
  timeBudgetMs: 120000, maxPasses: 100, seed: 2,
  copperToEdgeClearanceUm: manifest.native_rules.min_copper_edge_clearance * 1000,
  holeClearanceUm: manifest.native_rules.min_hole_clearance * 1000,
  strictDrc: true, neckWidthUm: 0, fanoutEnabled: false,
  ignoreNetGroups: manifest.ignore_classes, ...candidate.settings,
};
for (let i = 0; i < Number(repeats); i++) {
  const start = performance.now();
  const result = routeDsn(text, settings);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  console.log(JSON.stringify({ seconds: (performance.now() - start) / 1000, report: result.report, ses_sha256: createHash("sha256").update(result.ses).digest("hex") }));
}
