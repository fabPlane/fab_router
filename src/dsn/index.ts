/**
 * `src/dsn` — SPECCTRA design-file reader, writer and rules overlay (docs/DESIGN.md §3; formats
 * in spec/formats/dsn.md, dsn-dialects.md, padstack-names.md, rules.md; written from the
 * published SPECCTRA Design Language Reference, Cadence). This file is the module's surface:
 * `readDsn` (text → document + Layout), `parseSummary` (the normalised summary the acceptance
 * runner compares) and the re-exports of the writer and the rules overlay.
 *
 * Public surface: RulesResult, ParseSummaryResult, readDsn, parseSummary, writeDsn, readRules,
 * applyRules, lex, readDocument.
 */
import type { Diagnostic, Layout, ParseError } from "../../spec/types/layout.ts";
import type { DsnDocument, RulesFile } from "../../spec/types/dsn.ts";
import type { ReadResult } from "../../spec/types/results.ts";
import { buildLayout } from "../layout/build.ts";
import type { LayoutX } from "../layout/model.ts";
import { summarise } from "../layout/summary.ts";
import { readDocument } from "./read.ts";

export { lex } from "./lex.ts";
export { readDocument } from "./read.ts";
export { writeDsn } from "./write.ts";
export { readRules, applyRules } from "./rules.ts";

/** Result of `readRules` (spec/api/contract.md); `ok: false` only when the head is missing. */
export type RulesResult =
  | { ok: true; rules: RulesFile; diagnostics: Diagnostic[] }
  | { ok: false; error: ParseError; diagnostics: Diagnostic[] };

/** The normalised parse summary of a board, as a plain JSON object (parse/README.md fields). */
export type ParseSummaryResult =
  | { ok: true; summary: Record<string, unknown>; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };

/** spec/api/contract.md `readDsn`: never throws; `ok: false` only without a `pcb` head (F-20). */
export function readDsn(text: string, opts?: { name?: string }): ReadResult {
  const r = readDocument(text);
  if (!r.ok) return { ok: false, error: r.error, diagnostics: r.diagnostics };
  const diagnostics = r.diagnostics;
  const layout = buildLayout(r.document, diagnostics);
  if (opts?.name !== undefined) layout.boardName = opts.name;
  return { ok: true, layout, document: r.document, diagnostics };
}

/** Compute the parse summary of a Layout + document (runner surface, task I0 question 3). */
export function parseSummary(layout: Layout, document: DsnDocument, boardName: string): ParseSummaryResult {
  const L = layout as LayoutX;
  if (!Array.isArray(L.netGroups) || L.netGroups.length === 0 || (L.netGroups[0] as { categoryKinds?: unknown }).categoryKinds === undefined) {
    return { ok: false, diagnostics: [{ level: "warning", code: "layout-foreign", message: "parseSummary needs a Layout produced by readDsn" }] };
  }
  return { ok: true, summary: summarise(L, document, boardName), diagnostics: [] };
}
