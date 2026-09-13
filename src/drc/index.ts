/**
 * `src/drc` — design-rule check, connectivity and statistics (docs/DESIGN.md §5; semantics in
 * spec/rules/drc.md and spec/rules/connectivity.md). Literature: Tarjan (1975) union-find for
 * connectivity; Kruskal (1956) for the required-connection spanning tree; Shewchuk (1997) for
 * why the decisions are exact.
 *
 * `checkDrc`, `layoutStats` and `requiredConnections` are the bodies behind the public API
 * (spec/api/contract.md). All three are pure (DR-10): they build a fresh Lattice over the Layout,
 * run the clearance sweep (spacing.ts) and the connectivity analysis (connect.ts), and return
 * plain results. `DrcOptions` distances are µm and are converted to LU with the C-04 rounding
 * (nearest, then up to even).
 *
 * Public surface: checkDrc, layoutStats, requiredConnections, analyse, Analysis, emptyStats,
 * emptyDrcResult, and the re-exported result types and the internal modules.
 */
import type { Layout } from "../../spec/types/layout.ts";
import type { Connection, DrcOptions, DrcResult, Incomplete, LayoutStats, StatsOptions, Violation } from "../../spec/types/results.ts";
import { buildLattice, type Lattice } from "../lattice/index.ts";
import { connectivity, requiredConnectionsOf, type Connectivity } from "./connect.ts";
import { checkSpacing, type SpacingOptions } from "./spacing.ts";
import { ignoredNets, statsOf } from "./stats.ts";

export type { Connection, DrcOptions, DrcResult, Incomplete, LayoutStats, StatsOptions, Violation } from "../../spec/types/results.ts";
export * from "./connect.ts";
export * from "./spacing.ts";
export * from "./exact.ts";
export * from "./pour.ts";
export { ignoredNets, maximumConnections, statsOf } from "./stats.ts";

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

/** A spacing in µm → LU: nearest integer, then up to the next even integer (C-04). */
export function spacingLuOf(um: number, luPerUm: number): number {
  let v = Math.round(um * luPerUm);
  if (v < 0) v = 0;
  return v % 2 === 0 ? v : v + 1;
}

/** DrcOptions → the LU options of the sweep. */
export function spacingOptionsOf(layout: Layout, opts?: DrcOptions): SpacingOptions {
  const luPerUm = layout.frame.luPerUm;
  const out: SpacingOptions = { holeClearance: opts?.holeClearanceUm !== undefined && opts.holeClearanceUm > 0 ? spacingLuOf(opts.holeClearanceUm, luPerUm) : 0 };
  if (opts?.copperToEdgeClearanceUm !== undefined && opts.copperToEdgeClearanceUm >= 0) out.edgeClearance = spacingLuOf(opts.copperToEdgeClearanceUm, luPerUm);
  return out;
}

export interface Analysis {
  lattice: Lattice;
  connectivity: Connectivity;
  violations: Violation[];
  incompletes: Incomplete[];
  ignored: Set<number>;
}

/** One pass over the Layout: Lattice, joins and components, Violations, required connections. */
export function analyse(layout: Layout, opts?: DrcOptions & StatsOptions, lattice?: Lattice): Analysis {
  const lat = lattice ?? buildLattice(layout);
  const conn = connectivity(layout, lat);
  const violations = checkSpacing(layout, lat, spacingOptionsOf(layout, opts));
  const ignored = ignoredNets(layout, opts?.ignoreNetGroups);
  const incompletes: Incomplete[] = [];
  for (const n of layout.nets) if (!ignored.has(n.id)) incompletes.push(...requiredConnectionsOf(conn, n.id));
  return { lattice: lat, connectivity: conn, violations, incompletes, ignored };
}

export function checkDrc(layout: Layout, opts?: DrcOptions): DrcResult {
  const a = analyse(layout, opts);
  return { violations: a.violations, incompletes: a.incompletes, counts: { violations: a.violations.length, incompletes: a.incompletes.length } };
}

export function layoutStats(layout: Layout, opts?: StatsOptions): LayoutStats {
  const a = analyse(layout, opts);
  return statsOf(layout, a.connectivity, a.violations, a.ignored);
}

export function requiredConnections(layout: Layout): Connection[] {
  const lat = buildLattice(layout);
  const conn = connectivity(layout, lat);
  const out: Connection[] = [];
  for (const n of layout.nets) out.push(...requiredConnectionsOf(conn, n.id));
  return out;
}
