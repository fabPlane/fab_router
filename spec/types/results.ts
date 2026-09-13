/** Result shapes for spec/api/contract.md. */
import type { Diagnostic, Layout, ParseError, Pt } from "./layout.ts";
import type { RouteSettings } from "./settings.ts";
import type { DsnDocument } from "./dsn.ts";

export type ReadResult =
  | { ok: true; layout: Layout; document: DsnDocument; diagnostics: Diagnostic[] }
  | { ok: false; error: ParseError; diagnostics: Diagnostic[] };

export interface Violation {
  a: number; b: number | "rim" | "fence" | "hole";
  sheet: number;
  required: number; actual: number;
  at: Pt;
  rule: "spacing" | "rim" | "hole" | "fence";
}
export interface Incomplete { net: number; from: number; to: number; airlineLu: number }
export interface Connection { net: number; from: number; to: number; airlineLu: number }

export interface DrcResult { violations: Violation[]; incompletes: Incomplete[]; counts: { violations: number; incompletes: number } }
export interface DrcOptions { copperToEdgeClearanceUm?: number; holeClearanceUm?: number; ignoreNetGroups?: string[] }
export interface StatsOptions { ignoreNetGroups?: string[] }

export interface LayoutStats {
  items: { pads: number; barrels: number; tracks: number; pours: number; fences: number };
  connections: { maximum: number; incomplete: number };
  barrels: { total: number; through: number; blind: number; buried: number };
  tracks: { totalLengthLu: number; totalLengthMm: number; legs: number; bends90: number; bends45: number; bendsOther: number };
  violations: { total: number; byRule: Record<string, number> };
  fanout: { smdPads: number; escaped: number };
}

export interface RouteReport {
  passes: number;
  attempted: number; completed: number; incompleteBefore: number; incompleteAfter: number;
  added: { tracks: number; barrels: number };
  ripped: number;
  violationsBefore: number; violationsAdded: number;
  timedOut: boolean; aborted: boolean;
  stoppedBy: "complete" | "maxPasses" | "stagnant" | "maxItems" | "timeBudget" | "abort";
  effectiveSettings: RouteSettings;
  wallClockMs: number;
  perNet?: Array<{ net: string; incomplete: number }>;
}

export interface RouteHooks {
  signal?: AbortSignal;
  onPass?(e: { pass: number; incomplete: number; elapsedMs: number }): void;
  onConnection?(e: { net: string; from: string; to: string; ok: boolean; elapsedMs: number }): void;
  onProgress?(e: { done: number; total: number; elapsedMs: number }): void;
  onLog?(level: "info" | "warn", message: string): void;
}

export type RouteDsnResult =
  | { ok: true; ses: string; report: RouteReport; statsBefore: LayoutStats; statsAfter: LayoutStats; diagnostics: Diagnostic[] }
  | { ok: false; error: ParseError; diagnostics: Diagnostic[] };

export interface ApplyResult { ok: boolean; applied: { tracks: number; barrels: number }; diagnostics: Diagnostic[] }
export interface SesWriteOptions { hostCad?: string; hostVersion?: string; includeFileWiring?: boolean }
