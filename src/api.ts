/**
 * `src/api.ts` — the public surface fixed by spec/api/contract.md. Exactly these functions; the
 * acceptance runner (tools/acceptance) compiles against them. Expected failures are values
 * (`ok: false` plus diagnostics), never exceptions.
 *
 * Status: readDsn, writeDsn, readRules, applyRules and parseSummary are real (task I1, src/dsn and
 * src/layout); writeSes, applySes, checkDrc, layoutStats and requiredConnections are real (task I2,
 * src/ses and src/drc). route / routeDsn / routeSrj are stubs returning a well-typed "not
 * implemented" result (src/pipeline). Later tasks replace bodies, not signatures: I4+ route /
 * routeDsn, I6 routeSrj.
 */
import type { Layout } from "../spec/types/layout.ts";
import type { DsnDocument, RulesFile } from "../spec/types/dsn.ts";
import type {
  ApplyResult, Connection, DrcOptions, DrcResult, LayoutStats, ReadResult, RouteDsnResult, RouteHooks, RouteReport,
  SesWriteOptions, StatsOptions,
} from "../spec/types/results.ts";
import type { RouteSettings } from "../spec/types/settings.ts";
import type { SimpleRouteJson, SrjRouteResult } from "../spec/types/srj.ts";
import * as drc from "./drc/index.ts";
import { emptyReport } from "./route/index.ts";
import { resolveSettings, runRoute } from "./pipeline/index.ts";
import * as dsn from "./dsn/index.ts";
import * as ses from "./ses/index.ts";
import * as srj from "./srj/index.ts";
import type { RulesResult } from "./dsn/index.ts";

export type { RulesResult } from "./dsn/index.ts";

// ---- reading and writing --------------------------------------------------------------------

export function readDsn(text: string, opts?: { name?: string }): ReadResult {
  const r = dsn.readDsn(text, opts);
  // The session writer needs the design file's resolution, quote character and parser entries
  // (spec/formats/ses.md F-S20, F-S30, F-S31), which the public Layout does not carry: keep the
  // document on the Layout as a non-enumerable property (src/QUESTIONS.md, task I2).
  if (r.ok) ses.attachDocument(r.layout, r.document);
  return r;
}

export function writeDsn(document: DsnDocument): string {
  return dsn.writeDsn(document);
}

export function writeSes(layout: Layout, opts?: SesWriteOptions): string {
  return ses.writeSes(layout, opts);
}

export function applySes(layout: Layout, sesText: string): ApplyResult {
  return ses.applySes(layout, sesText);
}

export function readRules(text: string): RulesResult {
  return dsn.readRules(text);
}

export function applyRules(layout: Layout, rules: RulesFile): Layout {
  return dsn.applyRules(layout, rules);
}

/** The normalised parse summary of spec/acceptance/parse/README.md (contract ruling Q-I0-3). */
export type ParseSummary = Record<string, unknown>;

export function parseSummary(read: ReadResult & { ok: true }): ParseSummary {
  const board = (read.layout as { boardName?: string }).boardName ?? read.layout.name;
  const r = dsn.parseSummary(read.layout, read.document, board);
  return r.ok ? r.summary : { board, status: "parse-error" };
}

// ---- checking and measuring -----------------------------------------------------------------

export function checkDrc(layout: Layout, opts?: DrcOptions): DrcResult {
  return drc.checkDrc(layout, opts);
}

export function layoutStats(layout: Layout, opts?: StatsOptions): LayoutStats {
  return drc.layoutStats(layout, opts);
}

export function requiredConnections(layout: Layout): Connection[] {
  return drc.requiredConnections(layout);
}

// ---- routing --------------------------------------------------------------------------------

export function route(layout: Layout, settings?: Partial<RouteSettings>, hooks?: RouteHooks): RouteReport {
  const effective = resolveSettings(settings, layout.settingsFromFile, layout.angleMode);
  if (layout.nets.length === 0) return emptyReport(effective, "complete");
  return runRoute(layout, effective, hooks);
}

export function routeDsn(dsnText: string, settings?: Partial<RouteSettings>, hooks?: RouteHooks): RouteDsnResult {
  const read = readDsn(dsnText);
  if (!read.ok) return { ok: false, error: read.error, diagnostics: read.diagnostics };
  const statsBefore = layoutStats(read.layout);
  const report = route(read.layout, settings, hooks);
  const statsAfter = layoutStats(read.layout);
  return { ok: true, ses: writeSes(read.layout), report, statsBefore, statsAfter, diagnostics: read.diagnostics };
}

export function routeSrj(input: SimpleRouteJson, settings?: Partial<RouteSettings>, hooks?: RouteHooks): SrjRouteResult {
  const built = srj.buildSrjLayout(input);
  const { layout, netByConnection, connectionByNet, layerBySheet } = built;
  // Underlay the board's copper-to-edge clearance beneath the caller's settings (contract R-1;
  // spec/api/settings.md copperToEdgeClearanceUm).
  const merged: Partial<RouteSettings> = { ...(built.edgeClearanceUm !== undefined ? { copperToEdgeClearanceUm: built.edgeClearanceUm } : {}), ...settings };
  const report = route(layout, merged, hooks);
  const traces = srj.extractTraces(layout, connectionByNet, layerBySheet);
  const pairs = srj.measurePairs(layout, srj.normalisePairs((input as { differentialPairs?: unknown }).differentialPairs), netByConnection);
  const outSrj: SimpleRouteJson = { ...input, traces };
  return {
    ok: report.incompleteAfter === 0 && report.violationsAdded === 0,
    srj: outSrj,
    report,
    violationsBefore: report.violationsBefore,
    violationsAdded: report.violationsAdded,
    pairs,
    diagnostics: built.diagnostics,
  };
}
