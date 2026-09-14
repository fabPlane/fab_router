/**
 * Congestion-tuning sweep harness (task I12). Routes the dense target boards under a grid of
 * RouteSettings and prints, per (board × setting combo), the incomplete-after count,
 * `violationsAdded` (must stay 0 — R-1), passes run, stop reason and wall-clock. It is a local
 * experiment driver, NOT part of `bun run test`: run it explicitly, e.g.
 *
 *   bun run tools/acceptance/congestion-sweep.ts --boards bm07,green14 \
 *       --grid presentCongestionCost=0,50,100,200 --timeout 30
 *
 * A `--grid key=v1,v2,...` flag may be repeated; the harness routes the cartesian product of all
 * grid axes. Values parse as number / bool / string. `--timeout <s>` caps every board's own case
 * budget (so a sweep stays affordable); `--boards a,b` selects a subset. Determinism and R-1 are the
 * router's own guarantees; this file only measures. It writes nothing and mutates nothing.
 */
import { routeDsn, routeSrj } from "../../src/api.ts";
import type { RouteSettings } from "../../spec/types/settings.ts";
import type { SimpleRouteJson } from "../../spec/types/srj.ts";
import { readFileSync } from "node:fs";

const BOARDS_DIR = new URL("../../spec/acceptance/boards/", import.meta.url).pathname;

interface BoardDef {
  name: string;
  kind: "dsn" | "srj";
  file: string;
  settings: Record<string, unknown>;
}

// Each board's own case budget (spec/acceptance/cases/*). `timeoutSeconds` is mapped to
// `timeBudgetMs` by the router; the harness may cap it with --timeout for a cheaper sweep.
const BOARDS: BoardDef[] = [
  { name: "bm07", kind: "dsn", file: "Issue508-DAC2020_bm07.dsn", settings: { maxPasses: 100, timeoutSeconds: 60 } },
  { name: "cm5", kind: "dsn", file: "cm5-carrier.dsn", settings: { maxPasses: 20, maxStagnantPasses: 5, timeoutSeconds: 600 } },
  { name: "green14", kind: "dsn", file: "Issue034-Green14SegLED.dsn", settings: { maxPasses: 100, timeoutSeconds: 60 } },
  { name: "bm01p1", kind: "dsn", file: "Issue508-DAC2020_bm01.dsn", settings: { maxPasses: 1, timeoutSeconds: 270 } },
  { name: "bm01p2", kind: "dsn", file: "Issue508-DAC2020_bm01.dsn", settings: { maxPasses: 2, timeoutSeconds: 300 } },
  // srj default profile turns the tile detailed router on (Q-I10-72); mirror that here.
  { name: "j802", kind: "srj", file: "b223-j802.srj.json", settings: { maxPasses: 100, timeoutSeconds: 60, detailedRouter: "tiles" } },
];

function parseVal(s: string): unknown {
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "undefined") return undefined;
  if (s !== "" && !Number.isNaN(Number(s))) return Number(s);
  return s;
}

interface Axis { key: string; values: unknown[] }

function parseArgs(argv: string[]): { boards: string[]; axes: Axis[]; timeout?: number } {
  let boards: string[] = BOARDS.map((b) => b.name);
  const axes: Axis[] = [];
  let timeout: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--boards") boards = argv[++i]!.split(",").map((s) => s.trim());
    else if (a === "--grid") {
      const [key, vals] = argv[++i]!.split("=");
      axes.push({ key: key!, values: vals!.split(",").map(parseVal) });
    } else if (a === "--timeout") timeout = Number(argv[++i]);
  }
  return { boards, axes, ...(timeout !== undefined ? { timeout } : {}) };
}

/** Cartesian product of the grid axes -> list of override objects. */
function combos(axes: Axis[]): Array<Record<string, unknown>> {
  let out: Array<Record<string, unknown>> = [{}];
  for (const ax of axes) {
    const next: Array<Record<string, unknown>> = [];
    for (const base of out) for (const v of ax.values) next.push({ ...base, [ax.key]: v });
    out = next;
  }
  return out;
}

function comboLabel(c: Record<string, unknown>): string {
  const keys = Object.keys(c);
  if (keys.length === 0) return "(defaults)";
  return keys.map((k) => `${k}=${String(c[k])}`).join(" ");
}

/**
 * Resolve the run's settings the way an acceptance case would: `timeoutSeconds` is the case field,
 * but `route()` reads only `timeBudgetMs` (settings.md: the runner does `timeoutSeconds × 1000 →
 * timeBudgetMs`, not the router). Map it here so a sweep gets a real wall-clock cap; otherwise a
 * budget-limited board (cm5, bm01) would run to stagnation with no cap and take many minutes.
 */
function resolveSweepSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const out = { ...settings };
  if (typeof out.timeoutSeconds === "number") {
    out.timeBudgetMs = out.timeoutSeconds * 1000;
    delete out.timeoutSeconds;
  }
  return out;
}

function routeBoard(b: BoardDef, rawSettings: Record<string, unknown>): { incomplete: number; violAdded: number; passes: number; stoppedBy: string; ms: number } {
  const settings = resolveSweepSettings(rawSettings);
  if (b.kind === "dsn") {
    const text = readFileSync(BOARDS_DIR + b.file, "utf8");
    const r = routeDsn(text, settings as Partial<RouteSettings>);
    if (!r.ok) throw new Error(`route failed for ${b.file}`);
    return { incomplete: r.report.incompleteAfter, violAdded: r.report.violationsAdded, passes: r.report.passes, stoppedBy: r.report.stoppedBy, ms: Math.round(r.report.wallClockMs) };
  }
  const srj = JSON.parse(readFileSync(BOARDS_DIR + b.file, "utf8")) as SimpleRouteJson;
  const r = routeSrj(srj, settings as Partial<RouteSettings>);
  return { incomplete: r.report.incompleteAfter, violAdded: r.violationsAdded, passes: r.report.passes, stoppedBy: r.report.stoppedBy, ms: Math.round(r.report.wallClockMs) };
}

function main(): void {
  const { boards, axes, timeout } = parseArgs(process.argv.slice(2));
  const cs = combos(axes);
  const selected = BOARDS.filter((b) => boards.includes(b.name));
  console.log(`# congestion sweep — ${selected.map((b) => b.name).join(", ")} × ${cs.length} combo(s)`);
  console.log(`board      | setting                                   | incomplete | violAdded | passes | stoppedBy  | ms`);
  console.log(`-----------|-------------------------------------------|------------|-----------|--------|------------|-------`);
  for (const b of selected) {
    for (const c of cs) {
      const settings: Record<string, unknown> = { ...b.settings, ...c };
      if (timeout !== undefined) settings.timeoutSeconds = timeout;
      const t0 = Date.now();
      let res;
      try { res = routeBoard(b, settings); }
      catch (e) { console.log(`${b.name.padEnd(10)} | ${comboLabel(c).padEnd(41)} | ERROR: ${String(e)}`); continue; }
      const flag = res.violAdded > 0 ? "  <-- R-1 BREACH" : "";
      console.log(
        `${b.name.padEnd(10)} | ${comboLabel(c).padEnd(41)} | ${String(res.incomplete).padStart(10)} | ${String(res.violAdded).padStart(9)} | ${String(res.passes).padStart(6)} | ${res.stoppedBy.padEnd(10)} | ${String(Date.now() - t0).padStart(6)}${flag}`,
      );
    }
  }
}

main();
