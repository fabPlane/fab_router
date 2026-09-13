/**
 * Execute one acceptance case against the public API (src/api.ts) and evaluate its expectations
 * (spec/acceptance/README.md: kinds, metrics, operators).
 *
 * Outcomes: `pass`, `fail`, or `stub`. A case is `stub` when the API answered with the
 * `not-implemented` diagnostic (src/pipeline) or when a corpus resource the case needs is not in
 * the checkout. Stubs count as failures unless the environment variable FAB_ROUTER_ACCEPT_STUBS=1
 * is set, in which case they are reported as passing with `stub: true` — never as skipped.
 *
 * Public surface: CaseResult, runCase, acceptStubs.
 */
import type { AcceptCase, Expectation } from "./cases.ts";
import { DIRS, caseSettings, readExpectedFile, readResource } from "./cases.ts";
import { deepEqual, firstDifference } from "./schema.ts";
import { normaliseSession } from "./sexp.ts";
import * as api from "../../src/api.ts";
import { parseSummary } from "../../src/dsn/index.ts";
import { isNotImplemented } from "../../src/pipeline/index.ts";
import type { Layout } from "../../spec/types/layout.ts";
import type { LayoutStats, RouteReport } from "../../spec/types/results.ts";

export interface CaseResult {
  id: string;
  kind: AcceptCase["kind"];
  tier: AcceptCase["tier"];
  board?: string;
  pass: boolean;
  /** True when the outcome was decided by FAB_ROUTER_ACCEPT_STUBS rather than a measurement. */
  stub: boolean;
  reason?: string;
  measured: Record<string, unknown>;
  expected: Record<string, Expectation>;
  mismatches: string[];
  advisoryMismatches: string[];
  ms: number;
}

export function acceptStubs(): boolean {
  return process.env.FAB_ROUTER_ACCEPT_STUBS === "1";
}

class Stub extends Error { constructor(reason: string) { super(reason); this.name = "Stub"; } }
class Fail extends Error { constructor(reason: string) { super(reason); this.name = "Fail"; } }

type Measured = Record<string, unknown>;

/** Run a case; never throws. */
export function runCase(c: AcceptCase): CaseResult {
  const t0 = performance.now();
  const base = { id: c.id, kind: c.kind, tier: c.tier, expected: c.expect } as const;
  const measured: Measured = {};
  try {
    measure(c, measured);
    const { mismatches, advisory } = evaluate(c, measured);
    return { ...base, ...(c.board !== undefined ? { board: c.board } : {}), pass: mismatches.length === 0, stub: false, measured, mismatches, advisoryMismatches: advisory, ms: performance.now() - t0 };
  } catch (e) {
    const err = e as Error;
    const stub = err instanceof Stub;
    const reason = `${stub ? "stub" : "error"}: ${err.message}`;
    return {
      ...base, ...(c.board !== undefined ? { board: c.board } : {}),
      pass: stub && acceptStubs(), stub, reason, measured, mismatches: stub && acceptStubs() ? [] : [reason], advisoryMismatches: [],
      ms: performance.now() - t0,
    };
  }
}

// ---- measurement per kind ------------------------------------------------------------------

function boardText(c: AcceptCase): { name: string; text: string } {
  if (!c.board) throw new Fail("case names no board");
  const r = readResource(DIRS.boards, c.board);
  if (r.text === undefined) {
    // Name the real blocker: a stubbed reader first, an absent corpus second.
    const probe = api.readDsn("", { name: c.board });
    const readerStub = !probe.ok && isNotImplemented(probe.diagnostics);
    throw new Stub(`${readerStub ? "readDsn not implemented; " : ""}board corpus file missing: spec/acceptance/boards/${c.board}`);
  }
  return { name: c.board, text: r.text };
}

function readLayout(c: AcceptCase): { layout: Layout; document: import("../../spec/types/dsn.ts").DsnDocument } {
  const b = boardText(c);
  const read = api.readDsn(b.text, { name: b.name });
  if (!read.ok) {
    if (isNotImplemented(read.diagnostics)) throw new Stub("readDsn not implemented");
    throw new Fail(`readDsn failed: ${read.error.message} (line ${read.error.line}, column ${read.error.column})`);
  }
  return { layout: read.layout, document: read.document };
}

function withRules(c: AcceptCase, layout: Layout, measured: Measured): Layout {
  if (!c.rules) return layout;
  const r = readResource(DIRS.boards, c.rules);
  if (r.text === undefined) throw new Stub(`rules file missing: ${r.path}`);
  const rr = api.readRules(r.text);
  measured.accepted = rr.ok;
  if (!rr.ok) {
    if (isNotImplemented(rr.diagnostics)) throw new Stub("readRules not implemented");
    return layout;
  }
  return api.applyRules(layout, rr.rules);
}

function statsOf(layout: Layout, c: AcceptCase): LayoutStats {
  const ignore = (c.settings?.ignoreNetGroups as string[] | undefined) ?? [];
  return api.layoutStats(layout, ignore.length ? { ignoreNetGroups: ignore } : undefined);
}

function um(layout: Layout, lu: number): number {
  return lu / layout.frame.luPerUm;
}

function measure(c: AcceptCase, m: Measured): void {
  switch (c.kind) {
    case "parse": return measureParse(c, m);
    case "ses-roundtrip": return measureSesRoundtrip(c, m);
    case "ses-apply": return measureSesApply(c, m);
    case "rules": return measureRules(c, m);
    case "drc-load": return measureDrcLoad(c, m);
    case "settings": return measureSettings(c, m);
    case "routing": return measureRouting(c, m);
    case "srj": return measureSrj(c, m);
  }
}

function measureParse(c: AcceptCase, m: Measured): void {
  const b = boardText(c);
  const read = api.readDsn(b.text, { name: b.name });
  if (!read.ok && isNotImplemented(read.diagnostics)) throw new Stub("readDsn not implemented");
  m.status = read.ok ? "ok" : "error";
  if (!read.ok) return;
  const L = read.layout;
  m.layers = L.stack.length;
  m.components = L.parts.length;
  m.pads = L.pads.length;
  m.nets = L.nets.length;
  m.padstacks = L.padForms.length;
  m.tracks = L.tracks.length;
  m.vias = L.barrels.length;
  m.pours = L.pours.length;
  m.fences = L.fences.length;
  if (c.expect.summaryEquals) {
    const s = parseSummary(L, read.document, b.name);
    if (!s.ok) {
      if (isNotImplemented(s.diagnostics)) throw new Stub("parseSummary not implemented");
      throw new Fail("parseSummary failed");
    }
    m.summaryEquals = s.summary;
  }
}

function measureSesRoundtrip(c: AcceptCase, m: Measured): void {
  const { layout } = readLayout(c);
  const ses = api.writeSes(layout);
  // Q-I0-13: writeSes returns a string with no envelope; empty text is the stub's answer.
  if (ses.length === 0) throw new Stub("writeSes not implemented (empty text)");
  const tree = normaliseSession(ses);
  if (!tree) throw new Fail("writeSes output has no session head");
  m.treeEquals = tree;
}

function measureSesApply(c: AcceptCase, m: Measured): void {
  const { layout } = readLayout(c);
  if (!c.ses) throw new Fail("ses-apply case names no session file");
  const r = readResource(DIRS.boards, c.ses);
  if (r.text === undefined) throw new Stub(`session file missing: ${r.path}`);
  const applied = api.applySes(layout, r.text);
  if (!applied.ok) {
    if (isNotImplemented(applied.diagnostics)) throw new Stub("applySes not implemented");
    throw new Fail(`applySes failed: ${applied.diagnostics.map((d) => d.message).join("; ")}`);
  }
  const stats = statsOf(layout, c);
  m.incomplete = stats.connections.incomplete;
  m.barrels = stats.items.barrels;
  m.vias = stats.items.barrels;
  m.violations = stats.violations.total;
  m.tracks = stats.items.tracks;
  m.appliedTracks = applied.applied.tracks;
  m.appliedBarrels = applied.applied.barrels;
}

function measureRules(c: AcceptCase, m: Measured): void {
  const { layout: L0 } = readLayout(c);
  const L = withRules(c, L0, m);
  m.angleMode = L.angleMode;
  const def = L.netGroups.find((g) => g.name === "default") ?? L.netGroups[0];
  if (def) m.defaultWidthUm = um(L, def.trackWidth);
  m.pinEdgeToTurnUm = um(L, L.pinEdgeToTurnLu);
  for (const metric of Object.keys(c.expect)) {
    const sp = /^spacingUm:([^:]+):(.+)$/.exec(metric);
    if (sp) {
      const a = L.spacing.kinds.indexOf(sp[1]!), b = L.spacing.kinds.indexOf(sp[2]!);
      m[metric] = a < 0 || b < 0 ? null : um(L, L.spacing.get(a, b, 0));
      continue;
    }
    const gw = /^groupWidthUm:(.+)$/.exec(metric);
    if (gw) {
      const g = L.netGroups.find((x) => x.name === gw[1]);
      m[metric] = g ? um(L, g.trackWidth) : null;
    }
  }
}

function measureDrcLoad(c: AcceptCase, m: Measured): void {
  const { layout: L0 } = readLayout(c);
  const L = withRules(c, L0, m);
  const s = caseSettings(c.settings);
  const opts: Record<string, unknown> = {};
  if (s.copperToEdgeClearanceUm !== undefined) opts.copperToEdgeClearanceUm = s.copperToEdgeClearanceUm;
  if (s.holeClearanceUm !== undefined) opts.holeClearanceUm = s.holeClearanceUm;
  if (s.ignoreNetGroups !== undefined) opts.ignoreNetGroups = s.ignoreNetGroups;
  const r = api.checkDrc(L, opts);
  m.violations = r.counts.violations;
  m.incomplete = r.counts.incompletes;
}

function measureSettings(c: AcceptCase, m: Measured): void {
  const { layout: L0 } = readLayout(c);
  const L = withRules(c, L0, m);
  const report = api.route(L, { ...caseSettings(c.settings), routerEnabled: false });
  const eff = report.effectiveSettings as unknown as Record<string, unknown>;
  for (const metric of Object.keys(c.expect)) {
    let cur: unknown = eff;
    for (const part of metric.split("/")) {
      cur = typeof cur === "object" && cur !== null ? (cur as Record<string, unknown>)[part] : undefined;
    }
    m[metric] = cur;
  }
}

function fillRoutingMeasures(m: Measured, before: LayoutStats, after: LayoutStats, report: RouteReport): void {
  m.incomplete = after.connections.incomplete;
  m.incompleteBefore = before.connections.incomplete;
  m.completed = report.completed;
  m.violations = after.violations.total;
  m.violationsBefore = before.violations.total;
  m.violationsAdded = report.violationsAdded;
  m.passes = report.passes;
  m.barrels = after.items.barrels;
  m.vias = after.items.barrels;
  m.traceLengthMm = after.tracks.totalLengthMm;
  m.addedTracks = report.added.tracks;
  m.addedBarrels = report.added.barrels;
  m.wallClockMs = report.wallClockMs;
  m.stoppedBy = report.stoppedBy;
  m.timedOut = report.timedOut;
  m.aborted = report.aborted;
}

function measureRouting(c: AcceptCase, m: Measured): void {
  const { layout: L0 } = readLayout(c);
  const L = withRules(c, L0, m);
  const before = statsOf(L, c);
  let stubbed = false;
  const report = api.route(L, caseSettings(c.settings), { onLog: (_level, message) => { if (/not implemented/.test(message)) stubbed = true; } });
  if (stubbed) throw new Stub("route not implemented");
  const after = statsOf(L, c);
  fillRoutingMeasures(m, before, after, report);
  // Invariants R-3 and R-5 are part of every routing case.
  m["invariant:R-3"] = report.added.tracks === after.items.tracks - before.items.tracks && report.added.barrels === after.items.barrels - before.items.barrels;
  const maxItems = c.settings?.maxItems as number | undefined;
  m["invariant:R-5"] = maxItems === undefined || report.added.tracks + report.added.barrels <= maxItems;
}

function measureSrj(c: AcceptCase, m: Measured): void {
  const b = boardText(c);
  const srj = JSON.parse(b.text);
  const r = api.routeSrj(srj, caseSettings(c.settings));
  if (!r.ok && isNotImplemented(r.diagnostics)) throw new Stub("routeSrj not implemented");
  m.ok = r.ok;
  m.incomplete = r.report.incompleteAfter;
  m.incompleteBefore = r.report.incompleteBefore;
  m.violations = r.report.violationsBefore + r.report.violationsAdded;
  m.violationsBefore = r.report.violationsBefore;
  m.passes = r.report.passes;
  m.wallClockMs = r.report.wallClockMs;
  for (const p of r.pairs ?? []) m[`skewMm:${p.p}:${p.n}`] = p.skewMm;
}

// ---- evaluation ----------------------------------------------------------------------------

function referenceValue(c: AcceptCase, metric: string): number | undefined {
  if (!c.reference) return undefined;
  const r = readResource(DIRS.reference, c.reference);
  if (r.text === undefined) throw new Stub(`reference file missing: ${r.path}`);
  const json = JSON.parse(r.text) as Record<string, Record<string, number>>;
  const side = c.referenceSide === "A" ? "refA" : "refB";
  const stats = json[side] ?? json[side === "refA" ? "refB" : "refA"];
  if (!stats) return undefined;
  const key: Record<string, string> = { incomplete: "incompleteAfter", violations: "violationsAfter", barrels: "vias", vias: "vias", traceLengthMm: "traceLengthMm", passes: "passes", wallClockMs: "wallClockMs" };
  return stats[key[metric] ?? metric];
}

function evaluate(c: AcceptCase, m: Measured): { mismatches: string[]; advisory: string[] } {
  const mismatches: string[] = [];
  const advisory: string[] = [];
  for (const [metric, e] of Object.entries(c.expect)) {
    const out = e.advisory ? advisory : mismatches;
    const got = m[metric];
    if (e.equalsFile !== undefined) {
      const f = readExpectedFile(e.equalsFile);
      if (f.json === undefined) throw new Stub(`expected file missing: ${f.path}`);
      const want = c.kind === "ses-roundtrip" ? (f.json as { tree: unknown }).tree : stripMeta(f.json);
      const have = c.kind === "ses-roundtrip" ? got : stripMeta(got);
      const diff = firstDifference(have, want);
      m[metric] = diff ? `differs at ${diff}` : "equal";
      if (diff) out.push(`${metric}: differs at ${diff}`);
      continue;
    }
    if (e.exact !== undefined && !deepEqual(got, e.exact)) out.push(`${metric}: expected exactly ${JSON.stringify(e.exact)}, got ${JSON.stringify(got)}`);
    if (e.max !== undefined && !(typeof got === "number" && got <= e.max)) out.push(`${metric}: expected ≤ ${e.max}, got ${JSON.stringify(got)}`);
    if (e.min !== undefined && !(typeof got === "number" && got >= e.min)) out.push(`${metric}: expected ≥ ${e.min}, got ${JSON.stringify(got)}`);
    if (e.maxAdded !== undefined) {
      const before = m[`${metric}Before`];
      const added = typeof got === "number" && typeof before === "number" ? got - before : NaN;
      if (!(added <= e.maxAdded)) out.push(`${metric}: expected added ≤ ${e.maxAdded}, got ${before} → ${got}`);
    }
    if (e.preExisting !== undefined) {
      const before = m[`${metric}Before`];
      if (before !== e.preExisting) out.push(`${metric}: expected ${e.preExisting} pre-existing, got ${JSON.stringify(before)}`);
    }
    if (e.maxRatioToReference !== undefined) {
      const ref = referenceValue(c, metric);
      if (ref === undefined) out.push(`${metric}: no reference value`);
      else if (typeof got !== "number") out.push(`${metric}: not measured`);
      else if (ref === 0 ? got > 0 : got / ref > e.maxRatioToReference) out.push(`${metric}: expected ≤ ${e.maxRatioToReference} × reference ${ref}, got ${got}`);
    }
  }
  for (const [k, v] of Object.entries(m)) if (k.startsWith("invariant:") && v === false) mismatches.push(`${k} violated`);
  return { mismatches, advisory };
}

/** Drop the `_generated` and `notes` fields before comparing summaries (parse/README.md). */
function stripMeta(x: unknown): unknown {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return x;
  const { _generated, notes, ...rest } = x as Record<string, unknown>;
  void _generated; void notes;
  return rest;
}
