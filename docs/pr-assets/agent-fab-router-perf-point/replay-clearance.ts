/** BASELINE CANDIDATE CAPTURE OUTPUT [CALLS]. Separate worker process per version/group/repeat. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import type { ConvexShape } from "../../../src/geom/index.ts";

type Tuple = { a: ConvexShape; b: ConvexShape; required: number; touching: boolean };
type Group = { seen: number; samples: Tuple[] };
const sha = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const load = async (source: string) => import(pathToFileURL(resolve(source, "src/route/clear.ts")).href);
const evaluate = (api: Awaited<ReturnType<typeof load>>, t: Tuple): boolean => t.touching ? api.overlaps(t.a, t.b) : api.closerThan(t.a, t.b, t.required);
if (process.argv[2] === "--worker") {
  const [source, file, key, count] = process.argv.slice(3);
  if (!source || !file || !key || !count) throw new Error("Missing worker arguments");
  const api = await load(source);
  const tuples: Tuple[] = JSON.parse(readFileSync(file, "utf8")).groups[key].samples;
  const calls = Number(count);
  if (!Number.isSafeInteger(calls) || calls < tuples.length) throw new Error("Bad calls");
  // Warm this process before timing; the excluded warmup repeat also runs in a fresh process.
  let checksum = 0;
  for (let i = 0; i < 100000; i++) checksum += Number(evaluate(api, tuples[i % tuples.length]!));
  checksum = 0;
  const start = performance.now();
  for (let i = 0; i < calls; i++) checksum += Number(evaluate(api, tuples[i % tuples.length]!));
  console.log(JSON.stringify({ seconds: (performance.now() - start) / 1000, checksum }));
} else {
  const [baseline, candidate, file, output, callText = "5000000"] = process.argv.slice(2);
  if (!baseline || !candidate || !file || !output) throw new Error("Expected BASELINE CANDIDATE CAPTURE OUTPUT [CALLS]");
  if (existsSync(output)) throw new Error("Output already exists");
  const calls = Number(callText);
  if (!Number.isSafeInteger(calls) || calls < 1024) throw new Error("Bad calls");
  const captureBytes = readFileSync(file);
  const data = JSON.parse(captureBytes.toString());
  const groups = data.groups as Record<string, Group>;
  const before = await load(baseline), after = await load(candidate);
  const geom = await import(pathToFileURL(resolve(baseline, "src/geom/index.ts")).href);
  const checked: Record<string, { seen: number; samples: number; true_count: number; touching_count: number }> = {};
  for (const [key, group] of Object.entries(groups)) {
    let trueCount = 0;
    if (!group.samples.length || group.samples.length !== Math.min(group.seen, data.sampler.capacity_per_group)) throw new Error("Bad sample count");
    for (const t of group.samples) {
      if (!(t.touching ? t.required === 0 : t.required > 0)) throw new Error("Invalid tuple");
      const a = geom.coreOf(t.a), b = geom.coreOf(t.b);
      const need = t.required + a.r + b.r;
      const d2 = geom.dist2Pts(a.pts, b.pts);
      const expected = t.touching ? d2 <= need * need : d2 < need * need;
      if (evaluate(before, t) !== expected || evaluate(after, t) !== expected) throw new Error(`Preflight mismatch: ${key}`);
      trueCount += Number(expected);
    }
    checked[key] = { seen: group.seen, samples: group.samples.length, true_count: trueCount, touching_count: group.samples.filter(t => t.touching).length };
  }
  // Measure only the four dominant groups; equality is checked for every captured group.
  const selected = ["fast-capsule", "capsule/disk", "disk/disk", "disk/capsule"];
  for (const key of selected) if (!groups[key]) throw new Error(`Missing workload ${key}`);
  const sources = { before: baseline, after: candidate };
  const identity = (source: string) => {
    execFileSync("git", ["-C", source, "diff", "--exit-code", "HEAD", "--", "src", "spec"], { stdio: "pipe" });
    const files = execFileSync("git", ["-C", source, "ls-files", "-z", "src", "spec"], { encoding: "utf8" }).split("\0").filter(Boolean);
    return {
      commit: execFileSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      sha256: Object.fromEntries(files.map(file => [file, sha(readFileSync(resolve(source, file)))])),
    };
  };
  const identities = { before: identity(baseline), after: identity(candidate) };
  const started_utc = new Date().toISOString();
  const rows = [];
  for (const group of selected) for (let repeat = 0; repeat <= 6; repeat++) {
    const checksums = [];
    for (const version of repeat % 2 === 0 ? ["before", "after"] as const : ["after", "before"] as const) {
      const start = new Date().toISOString();
      const result = JSON.parse(execFileSync(process.execPath, [import.meta.path, "--worker", sources[version], file, group, String(calls)], { encoding: "utf8", timeout: 120000 }));
      checksums.push(result.checksum);
      rows.push({ group, version, repeat, warmup: repeat === 0, calls, started_utc: start, finished_utc: new Date().toISOString(), ...result });
    }
    if (checksums[0] !== checksums[1]) throw new Error("Timed checksum mismatch");
  }
  if (JSON.stringify(identities) !== JSON.stringify({ before: identity(baseline), after: identity(candidate) })) throw new Error("Sources changed");
  if (sha(captureBytes) !== sha(readFileSync(file))) throw new Error("Capture changed");
  writeFileSync(output, JSON.stringify({
    started_utc, finished_utc: new Date().toISOString(), bun: Bun.version,
    cpu_allowed_list: readFileSync("/proc/self/status", "utf8").match(/^Cpus_allowed_list:\s*(.+)$/m)?.[1],
    harness_sha256: sha(readFileSync(import.meta.path)), capture_sha256: sha(captureBytes),
    identities, checked, rows,
  }, null, 2) + "\n", { flag: "wx" });
  console.log(`Checked ${Object.keys(checked).length} groups; completed ${rows.length} worker runs`);
}
