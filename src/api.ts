/**
 * `src/api.ts` — the public surface fixed by spec/api/contract.md. Exactly these functions; the
 * acceptance runner (tools/acceptance) compiles against them. Expected failures are values
 * (`ok: false` plus diagnostics), never exceptions.
 *
 * Status: every body is a stub returning a well-typed "not implemented" result carrying the
 * diagnostic code `not-implemented` (src/pipeline). Later tasks replace bodies, not signatures:
 * I1 readDsn/writeDsn/readRules/applyRules, I2 writeSes/applySes/checkDrc/layoutStats/
 * requiredConnections, I4+ route/routeDsn, I6 routeSrj.
 */
import type { Layout } from "../spec/types/layout.ts";
import type { DsnDocument, RulesFile } from "../spec/types/dsn.ts";
import type {
  ApplyResult, Connection, DrcOptions, DrcResult, LayoutStats, ReadResult, RouteDsnResult, RouteHooks, RouteReport,
  SesWriteOptions, StatsOptions,
} from "../spec/types/results.ts";
import type { RouteSettings } from "../spec/types/settings.ts";
import type { SimpleRouteJson, SrjRouteResult } from "../spec/types/srj.ts";
import { emptyDrcResult, emptyStats } from "./drc/index.ts";
import { emptyReport } from "./route/index.ts";
import { notImplemented, resolveSettings } from "./pipeline/index.ts";
import type { RulesResult } from "./dsn/index.ts";

export type { RulesResult } from "./dsn/index.ts";

// ---- reading and writing --------------------------------------------------------------------

export function readDsn(text: string, opts?: { name?: string }): ReadResult {
  void text; void opts;
  return { ok: false, error: { line: 0, column: 0, message: "readDsn is not implemented yet" }, diagnostics: [notImplemented("readDsn")] };
}

export function writeDsn(document: DsnDocument): string {
  void document;
  return "";
}

export function writeSes(layout: Layout, opts?: SesWriteOptions): string {
  void layout; void opts;
  return "";
}

export function applySes(layout: Layout, sesText: string): ApplyResult {
  void layout; void sesText;
  return { ok: false, applied: { tracks: 0, barrels: 0 }, diagnostics: [notImplemented("applySes")] };
}

export function readRules(text: string): RulesResult {
  void text;
  return { ok: false, error: { line: 0, column: 0, message: "readRules is not implemented yet" }, diagnostics: [notImplemented("readRules")] };
}

export function applyRules(layout: Layout, rules: RulesFile): Layout {
  void rules;
  return layout;
}

// ---- checking and measuring -----------------------------------------------------------------

export function checkDrc(layout: Layout, opts?: DrcOptions): DrcResult {
  void layout; void opts;
  return emptyDrcResult();
}

export function layoutStats(layout: Layout, opts?: StatsOptions): LayoutStats {
  void layout; void opts;
  return emptyStats();
}

export function requiredConnections(layout: Layout): Connection[] {
  void layout;
  return [];
}

// ---- routing --------------------------------------------------------------------------------

export function route(layout: Layout, settings?: Partial<RouteSettings>, hooks?: RouteHooks): RouteReport {
  const effective = resolveSettings(settings, layout.settingsFromFile, layout.angleMode);
  hooks?.onLog?.("warn", "route is not implemented yet");
  return emptyReport(effective, "maxPasses");
}

export function routeDsn(dsnText: string, settings?: Partial<RouteSettings>, hooks?: RouteHooks): RouteDsnResult {
  const read = readDsn(dsnText);
  if (!read.ok) return { ok: false, error: read.error, diagnostics: read.diagnostics };
  const statsBefore = layoutStats(read.layout);
  const report = route(read.layout, settings, hooks);
  const statsAfter = layoutStats(read.layout);
  return { ok: true, ses: writeSes(read.layout), report, statsBefore, statsAfter, diagnostics: read.diagnostics };
}

export function routeSrj(srj: SimpleRouteJson, settings?: Partial<RouteSettings>, hooks?: RouteHooks): SrjRouteResult {
  const effective = resolveSettings(settings, undefined, undefined);
  hooks?.onLog?.("warn", "routeSrj is not implemented yet");
  return { ok: false, srj, report: emptyReport(effective, "maxPasses"), diagnostics: [notImplemented("routeSrj")] };
}
