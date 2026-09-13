/**
 * `src/drc` — design-rule check, connectivity and statistics (docs/DESIGN.md §5; semantics in
 * spec/rules/drc.md and spec/rules/connectivity.md). Literature: Tarjan (1975) union-find for
 * connectivity; Kruskal (1956) for the required-connection spanning tree.
 *
 * The check itself is task I2. This file fixes the result vocabulary the acceptance runner
 * compares (spec/api/contract.md "Checking and measuring") and provides the empty values the
 * API stubs return.
 *
 * Public surface: emptyStats, emptyDrcResult, and the re-exported result types.
 */
import type { DrcResult, LayoutStats } from "../../spec/types/results.ts";

export type { Connection, DrcOptions, DrcResult, Incomplete, LayoutStats, StatsOptions, Violation } from "../../spec/types/results.ts";

/** A LayoutStats with every count at zero. */
export function emptyStats(): LayoutStats {
  return {
    items: { pads: 0, barrels: 0, tracks: 0, pours: 0, fences: 0 },
    connections: { maximum: 0, incomplete: 0 },
    barrels: { total: 0, through: 0, blind: 0, buried: 0 },
    tracks: { totalLengthLu: 0, totalLengthMm: 0, legs: 0, bends90: 0, bends45: 0, bendsOther: 0 },
    violations: { total: 0, byRule: {} },
    fanout: { smdPads: 0, escaped: 0 },
  };
}

/** A DrcResult with nothing found. */
export function emptyDrcResult(): DrcResult {
  return { violations: [], incompletes: [], counts: { violations: 0, incompletes: 0 } };
}
