/** Diagnostic only: ARCHIVE NATIVE_WORK OUTPUT. Instrumented time is not a performance result. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const [source, work, output] = process.argv.slice(2);
if (!source || !work || !output) throw new Error("Expected ARCHIVE NATIVE_WORK OUTPUT");
if (existsSync(output)) throw new Error("Output already exists");
const counts = { total: 0, fast: 0, fallback: {} as Record<string, number> };
(globalThis as typeof globalThis & { __capsuleTrace: typeof counts }).__capsuleTrace = counts;
const provenance = JSON.parse(readFileSync(resolve(source, "capsule-instrumentation.json"), "utf8"));
const sha = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
if (sha(readFileSync(resolve(source, "src/route/clear.ts"))) !== provenance.instrumented_clear_sha256) throw new Error("Instrumented source changed");
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
if (result.report.timedOut || result.report.aborted) throw new Error("Trace truncated");
if (counts.total !== counts.fast + Object.values(counts.fallback).reduce((a, b) => a + b, 0)) throw new Error("Bad counter totals");
writeFileSync(output, JSON.stringify({ started_utc, finished_utc: new Date().toISOString(), diagnostic_seconds: (performance.now() - start) / 1000, provenance, input_sha256: sha(text), settings, counts, report: result.report, ses_sha256: sha(result.ses) }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(counts));
