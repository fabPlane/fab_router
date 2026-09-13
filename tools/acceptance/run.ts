/**
 * Acceptance runner CLI (spec/acceptance/README.md "Reports"):
 *
 *   bun run tools/acceptance/run.ts --tier <fast|slow|all> [--case <glob>] [--report <file>]
 *
 * Runs every matching case through src/api.ts, prints one line per case, writes the JSON report
 * `{ taken, head, cases: [{ id, kind, tier, pass, stub, measured, expected, mismatches,
 * advisoryMismatches }], summary: { passed, failed, advisory, stubbed } }` when `--report` is
 * given (`/dev/stdout` works), and a one-line-per-board CSV to spec/acceptance/out/ (git-ignored;
 * silently skipped when that directory cannot be written). Exit 1 when any case fails.
 *
 * Set FAB_ROUTER_ACCEPT_STUBS=1 to let cases the API cannot serve yet pass as `stub`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DIRS, ROOT, loadCases, matchGlob, type AcceptCase } from "./cases.ts";
import { runCase, type CaseResult } from "./run-case.ts";

export interface RunOptions { tier: "fast" | "slow" | "all"; caseGlob?: string | undefined; report?: string | undefined; quiet?: boolean }

export interface Report {
  taken: string;
  head: string;
  acceptStubs: boolean;
  invalidCases: Array<{ file: string; problems: string[] }>;
  cases: CaseResult[];
  summary: { total: number; passed: number; failed: number; advisory: number; stubbed: number };
}

function gitHead(): string {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

export function selectCases(cases: AcceptCase[], opts: RunOptions): AcceptCase[] {
  return cases.filter((c) => (opts.tier === "all" || c.tier === opts.tier) && (!opts.caseGlob || matchGlob(opts.caseGlob, c.id) || matchGlob(opts.caseGlob, c.file)));
}

export function runAll(opts: RunOptions): Report {
  const loaded = loadCases();
  const selected = selectCases(loaded.cases, opts);
  const results: CaseResult[] = [];
  for (const c of selected) {
    const r = runCase(c);
    results.push(r);
    if (!opts.quiet) {
      const tag = r.stub ? (r.pass ? "STUB" : "FAIL") : r.pass ? "PASS" : "FAIL";
      const detail = r.reason ?? r.mismatches[0] ?? (r.advisoryMismatches.length ? `advisory: ${r.advisoryMismatches[0]}` : "");
      console.log(`${tag}  ${r.kind.padEnd(13)} ${r.id}${detail ? `  — ${detail}` : ""}`);
    }
  }
  const summary = {
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    advisory: results.filter((r) => r.advisoryMismatches.length > 0).length,
    stubbed: results.filter((r) => r.stub).length,
  };
  const report: Report = { taken: new Date().toISOString(), head: gitHead(), acceptStubs: process.env.FAB_ROUTER_ACCEPT_STUBS === "1", invalidCases: loaded.invalid, cases: results, summary };
  if (opts.report) writeFileSync(opts.report, JSON.stringify(report, null, 2) + "\n");
  writeCsv(report);
  return report;
}

function writeCsv(report: Report): void {
  try {
    mkdirSync(DIRS.out, { recursive: true });
    const rows = ["id,kind,tier,board,pass,stub,ms,detail"];
    for (const r of report.cases) {
      const detail = (r.reason ?? r.mismatches[0] ?? "").replace(/[",\n]/g, " ");
      rows.push([r.id, r.kind, r.tier, r.board ?? "", r.pass, r.stub, Math.round(r.ms), detail].join(","));
    }
    writeFileSync(join(DIRS.out, `acceptance-${report.taken.replace(/[:.]/g, "-")}.csv`), rows.join("\n") + "\n");
  } catch {
    // The out directory is optional (spec/ is read-only for implementers); ignore.
  }
}

function parseArgs(argv: string[]): RunOptions {
  const o: RunOptions = { tier: "fast" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--tier") { const t = argv[++i]; if (t === "fast" || t === "slow" || t === "all") o.tier = t; else throw new Error(`bad --tier ${t}`); }
    else if (a === "--case") o.caseGlob = argv[++i];
    else if (a === "--report") o.report = argv[++i];
    else if (a === "--quiet") o.quiet = true;
    else if (a === "--") continue;
    else throw new Error(`unknown argument ${a}`);
  }
  return o;
}

if (import.meta.main) {
  const opts = parseArgs(process.argv.slice(2));
  const report = runAll(opts);
  const s = report.summary;
  console.error(`acceptance: ${s.total} case(s), ${s.passed} passed, ${s.failed} failed, ${s.stubbed} stubbed, ${s.advisory} with advisory mismatches; ${report.invalidCases.length} invalid case file(s)`);
  for (const inv of report.invalidCases) console.error(`  invalid ${inv.file}: ${inv.problems.join("; ")}`);
  process.exit(s.failed > 0 || report.invalidCases.length > 0 ? 1 : 0);
}
