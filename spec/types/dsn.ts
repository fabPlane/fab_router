/**
 * DsnDocument: a file-shaped DTO of a SPECCTRA DSN file, in file units, preserving what the file
 * said (not what the Layout makes of it). Completed by the formats spec drop (M1) before the DSN
 * reader task starts; the reader task file names the final version.
 *
 * Invariant F-ROUNDTRIP: writeDsn(readDsn(t).document) re-read deep-equals the document.
 */
export interface SExpr { head: string; items: Array<SExpr | string | number>; line?: number }

export interface DsnDocument {
  /** The `pcb` name token. */
  name: string;
  parser: { stringQuote: string; spaceInQuotedTokens: boolean; hostCad?: string; hostVersion?: string; raw: SExpr[] };
  resolution: { unit: string; perUnit: number };
  unit: string;
  /** Scopes retained as trees until the formats spec fixes their DTOs: structure, placement, library, network, wiring. */
  structure: SExpr; placement: SExpr; library: SExpr; network: SExpr; wiring: SExpr | null;
  /** Any top-level scope not listed above, in file order. */
  other: SExpr[];
}

export interface RulesFile { name: string; body: SExpr[] }
