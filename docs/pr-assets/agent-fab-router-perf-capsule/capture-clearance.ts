/** ARCHIVE NATIVE_WORK OUTPUT. Diagnostic capture only; never time this as baseline. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ConvexShape } from "../../../src/geom/index.ts";

const [source, work, output] = process.argv.slice(2);
if (!source || !work || !output) throw new Error("Expected ARCHIVE NATIVE_WORK OUTPUT");
if (existsSync(output)) throw new Error("Output already exists");
const sha = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const provenance = JSON.parse(readFileSync(resolve(source, "clearance-capture.json"), "utf8"));
if (sha(readFileSync(resolve(source, "src/route/clear.ts"))) !== provenance.instrumented_clear_sha256) throw new Error("Source changed");
type Tuple = { a: ConvexShape; b: ConvexShape; required: number; touching: boolean };
const groups: Record<string, { seen: number; samples: Tuple[] }> = {};
const capacity = 1024;
let state = 412731;
const next = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0; };
function capture(a: ConvexShape, b: ConvexShape, required: number, touching: boolean) {
  if (!(touching ? required === 0 : required > 0)) throw new Error("Unsupported public replay arguments");
  const fast = a.kind === "capsule" && b.kind === "capsule" &&
    (a.a.x !== a.b.x || a.a.y !== a.b.y) && (b.a.x !== b.b.x || b.a.y !== b.b.y);
  const key = fast ? "fast-capsule" : `${a.kind}/${b.kind}`;
  const group = groups[key] ??= { seen: 0, samples: [] };
  group.seen++;
  const slot = group.seen <= capacity ? group.seen - 1 : Math.floor(next() / 4294967296 * group.seen);
  if (slot < capacity) group.samples[slot] = structuredClone({ a, b, required, touching });
}
(globalThis as typeof globalThis & { __captureClearance: typeof capture }).__captureClearance = capture;
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
const started_utc = new Date().toISOString();
const start = performance.now();
const result = routeDsn(text, settings);
if (!result.ok) throw new Error(JSON.stringify(result.error));
if (result.report.timedOut || result.report.aborted) throw new Error("Truncated capture");
writeFileSync(output, JSON.stringify({
  started_utc, finished_utc: new Date().toISOString(), diagnostic_seconds: (performance.now() - start) / 1000,
  capture_harness_sha256: sha(readFileSync(import.meta.path)), bun: Bun.version,
  cpu_allowed_list: readFileSync("/proc/self/status", "utf8").match(/^Cpus_allowed_list:\s*(.+)$/m)?.[1],
  provenance, input_sha256: sha(text), settings, ses_sha256: sha(result.ses), report: result.report,
  sampler: { capacity_per_group: capacity, seed: 412731, method: "Algorithm R, xorshift32 finite random source; grouped by branch and ordered shape kinds" },
  groups,
}) + "\n", { flag: "wx" });
console.log(JSON.stringify(Object.fromEntries(Object.entries(groups).map(([key, g]) => [key, { seen: g.seen, sampled: g.samples.length }]))));
