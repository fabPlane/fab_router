/** Optional, read-only native acceptance boundary for an already applied candidate board.
 * This is separate from the text router's geometric checker. It does not certify design
 * fidelity, repair routes, or apply them to a live board. See docs/NATIVE-DRC-GATE.md.
 */
import { execFile } from "node:child_process";
import { link, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { assertSourcePads, assertBoardZones, assertBoardNets, assertEmbeddedBoardRules, assertSourceCopper } from "./kicad-board-rules.ts";
const execute = promisify(execFile);

type Finding = { type: string; severity: string; description: string; items: Array<{ description: string; pos: { x: number; y: number }; uuid?: string }> };
type Report = { coordinate_units: string; kicad_version: string; included_severities: string[]; violations: Finding[]; unconnected_items: unknown[]; ignored_checks: unknown[] };
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function parseReport(value: unknown): Report {
  if (!object(value) || !Array.isArray(value.violations) || !Array.isArray(value.unconnected_items) || !Array.isArray(value.ignored_checks)) throw new Error("Malformed native DRC report");
  if (value.coordinate_units !== "mm" || typeof value.kicad_version !== "string" || !value.kicad_version || !Array.isArray(value.included_severities) || !value.included_severities.includes("error")) throw new Error("Native DRC must include errors in millimetres with a native version");
  for (const v of value.violations) {
    if (!object(v) || typeof v.type !== "string" || !v.type || typeof v.description !== "string" || !["error", "warning", "exclusion", "ignore"].includes(String(v.severity)) || !Array.isArray(v.items)) throw new Error("Malformed native DRC finding");
    for (const i of v.items) {
      if (!object(i) || typeof i.description !== "string" || !object(i.pos) || typeof i.pos.x !== "number" || !Number.isFinite(i.pos.x) || typeof i.pos.y !== "number" || !Number.isFinite(i.pos.y)) throw new Error("Malformed native DRC item");
    }
  }
  for (const connection of value.unconnected_items) {
    if (!object(connection) || connection.type !== "unconnected_items" || connection.severity !== "error" || typeof connection.description !== "string" || !Array.isArray(connection.items) || connection.items.length < 2) throw new Error("Malformed native connectivity finding");
    for (const item of connection.items) {
      if (!object(item) || typeof item.description !== "string" || !object(item.pos) || typeof item.pos.x !== "number" || !Number.isFinite(item.pos.x) || typeof item.pos.y !== "number" || !Number.isFinite(item.pos.y)) throw new Error("Malformed native connectivity item");
    }
  }
  return value as Report;
}
// Same physical signature as the benchmark: imported UUIDs can change. Count duplicate
// findings so one inherited error cannot exempt two candidate errors at the same location.
function signature(v: Finding): string {
  return JSON.stringify([v.type, v.severity, v.items.map(i => [i.pos.x, i.pos.y, i.description]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function compareNativeReports(input: unknown, candidate: unknown) {
  const before = parseReport(input), after = parseReport(candidate);
  if (before.kicad_version !== after.kicad_version || stable([...before.included_severities].sort()) !== stable([...after.included_severities].sort())) throw new Error("Native version or severity policy changed");
  const policy = (r: Report) => r.ignored_checks.map(stable).sort();
  if (JSON.stringify(policy(before)) !== JSON.stringify(policy(after))) throw new Error("Native ignored-check policy changed");
  const inherited = new Map<string, number>();
  for (const v of before.violations.filter(v => v.severity === "error")) {
    const key = signature(v); inherited.set(key, (inherited.get(key) ?? 0) + 1);
  }
  const newErrors: Finding[] = [];
  for (const v of after.violations.filter(v => v.severity === "error")) {
    const key = signature(v), count = inherited.get(key) ?? 0;
    if (count) inherited.set(key, count - 1); else newErrors.push(v);
  }
  const opensBefore = before.unconnected_items.length, opensAfter = after.unconnected_items.length;
  return { accepted: newErrors.length === 0 && opensAfter <= opensBefore, newErrors, opensBefore, opensAfter };
}

async function optionalFile(path: string): Promise<Buffer | undefined> {
  try { return await readFile(path); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw e; }
}
async function snapshot(board: string, directory: string) {
  if (!board.endsWith(".kicad_pcb")) throw new Error("Expected a .kicad_pcb board");
  await mkdir(directory);
  const stem = board.slice(0, -".kicad_pcb".length), name = basename(stem);
  // Require explicit project rules: silently checking against default rules is unsafe.
  const project = await readFile(`${stem}.kicad_pro`), rules = await optionalFile(`${stem}.kicad_dru`);
  const bytes = await readFile(board);
  const target = join(directory, `${name}.kicad_pcb`);
  await writeFile(target, bytes);
  await writeFile(join(directory, `${name}.kicad_pro`), project);
  if (rules) await writeFile(join(directory, `${name}.kicad_dru`), rules);
  return { target, bytes, project, rules };
}
async function inspectNativeBoards(input: string, candidate: string, timeoutMs: number) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid native check timeout");
  const directory = await mkdtemp(join(tmpdir(), "fab-router-native-gate-"));
  try {
    const before = await snapshot(resolve(input), join(directory, "before"));
    const after = await snapshot(resolve(candidate), join(directory, "after"));
    if (!before.project.equals(after.project) || !((!before.rules && !after.rules) || (before.rules && after.rules && before.rules.equals(after.rules)))) throw new Error("Candidate project rules differ from input");
    assertEmbeddedBoardRules(before.bytes.toString("utf8"), after.bytes.toString("utf8"));
    assertBoardNets(before.bytes.toString("utf8"), after.bytes.toString("utf8"));
    assertSourceCopper(before.bytes.toString("utf8"), after.bytes.toString("utf8"));
    assertSourcePads(before.bytes.toString("utf8"), after.bytes.toString("utf8"));
    assertBoardZones(before.bytes.toString("utf8"), after.bytes.toString("utf8"));
    const reports: unknown[] = [];
    for (const [index, board] of [before, after].entries()) {
      const report = join(directory, `${index}.json`);
      // No --save-board: all native writes stay inside this disposable directory.
      await execute("kicad-cli", ["pcb", "drc", "--severity-all", "--format", "json", "--units", "mm", "--refill-zones", "--output", report, board.target], { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 });
      reports.push(JSON.parse(await readFile(report, "utf8")));
    }
    const result = compareNativeReports(reports[0], reports[1]);
    const hash = (data: Buffer) => new Bun.CryptoHasher("sha256").update(data).digest("hex");
    const validation = { ...result, inputSha256: hash(before.bytes), candidateSha256: hash(after.bytes), inputReport: reports[0], candidateReport: reports[1] };
    const files = (snapshot: typeof before) => [
      { name: "board.kicad_pcb", bytes: snapshot.bytes },
      { name: "board.kicad_pro", bytes: snapshot.project },
      ...(snapshot.rules === undefined ? [] : [{ name: "board.kicad_dru", bytes: snapshot.rules }]),
    ].map(({ name, bytes }) => ({ name, sha256: hash(bytes), base64: bytes.toString("base64") }));
    // Capture the already checked buffers, never reopen mutable caller paths.
    return { validation, input: files(before), candidate: files(after) };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export async function checkNativeBoards(input: string, candidate: string, timeoutMs = 120_000) {
  return (await inspectNativeBoards(input, candidate, timeoutMs)).validation;
}

/** Publish a self-contained accepted snapshot. The complete file becomes visible in
 * one exclusive hard-link operation on the destination filesystem. Source files and
 * pre-existing destinations (including symlinks) are never overwritten. This is an
 * offline artifact, not an editor transaction or a durability guarantee across power loss.
 */
export async function publishNativeCandidate(input: string, candidate: string, output: string, timeoutMs = 120_000) {
  // Resolve existing parent directories as well, so a directory symlink cannot
  // redirect an absent output onto an absent source rule sidecar.
  const canonical = async (path: string) => join(await realpath(dirname(resolve(path))), basename(path));
  const destination = await canonical(output);
  const protectedPaths = await Promise.all([input, candidate].flatMap(board =>
    [".kicad_pcb", ".kicad_pro", ".kicad_dru"].map(ext => canonical(board.replace(/\.kicad_pcb$/, ext)))));
  if (protectedPaths.includes(destination)) throw new Error("Bundle output overlaps a source board or rules file");
  const inspected = await inspectNativeBoards(input, candidate, timeoutMs);
  if (!inspected.validation.accepted) return { ...inspected.validation, published: false };
  const staging = await mkdtemp(join(dirname(destination), ".native-candidate-"));
  try {
    const temporary = join(staging, "candidate.json");
    await writeFile(temporary, `${JSON.stringify({ format: "fab-router-native-candidate-v1", ...inspected }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    // Same filesystem; link fails with EEXIST for every existing destination.
    await link(temporary, destination);
  } finally { await rm(staging, { recursive: true, force: true }); }
  return { ...inspected.validation, published: true };
}

if (import.meta.main) {
  const [input, candidate, output] = process.argv.slice(2);
  if (!input || !candidate || process.argv.length > 5) {
    console.error("Usage: bun tools/native-drc-gate.ts input.kicad_pcb candidate.kicad_pcb [report.json]");
    process.exitCode = 2;
  } else {
    try {
      if (output && [resolve(input), resolve(candidate), ...[input, candidate].flatMap(p => [".kicad_pro", ".kicad_dru"].map(ext => resolve(p.replace(/\.kicad_pcb$/, ext))))].includes(resolve(output))) throw new Error("Report output overlaps a source board or rules file");
      const result = await checkNativeBoards(input, candidate);
      const text = `${JSON.stringify(result, null, 2)}\n`;
      // Exclusive creation protects existing artifacts, including aliases to source files.
      if (output) await writeFile(output, text, { flag: "wx" }); else process.stdout.write(text);
      process.exitCode = result.accepted ? 0 : 1;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2;
    }
  }
}
