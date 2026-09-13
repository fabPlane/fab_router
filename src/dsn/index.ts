/**
 * `src/dsn` — SPECCTRA design-file reader, writer and rules overlay (docs/DESIGN.md §3; formats
 * in spec/formats/dsn.md, dsn-dialects.md, padstack-names.md, rules.md; from the published
 * SPECCTRA Design Language Reference, Cadence 2003). The lexer, tree reader, Layout builder,
 * writer and rules overlay are task I1. This file fixes the internal surface the acceptance runner
 * uses beyond the public API: the parse summary (spec/acceptance/parse/README.md) and the rules
 * result envelope.
 *
 * Public surface: RulesResult, ParseSummaryResult, parseSummary (stub).
 */
import type { Diagnostic, Layout, ParseError } from "../../spec/types/layout.ts";
import type { DsnDocument, RulesFile } from "../../spec/types/dsn.ts";
import { notImplemented } from "../pipeline/index.ts";

/** Result of `readRules` (spec/api/contract.md); `ok: false` only when the head is missing. */
export type RulesResult =
  | { ok: true; rules: RulesFile; diagnostics: Diagnostic[] }
  | { ok: false; error: ParseError; diagnostics: Diagnostic[] };

/** The normalised parse summary of a board, as a plain JSON object (parse/README.md fields). */
export type ParseSummaryResult =
  | { ok: true; summary: Record<string, unknown>; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };

/** Compute the parse summary of a Layout + document. Stub until task I1. */
export function parseSummary(_layout: Layout, _document: DsnDocument, _boardName: string): ParseSummaryResult {
  return { ok: false, diagnostics: [notImplemented("parseSummary")] };
}
