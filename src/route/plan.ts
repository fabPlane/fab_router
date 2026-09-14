/**
 * Plan — the data structures of the two-phase global router's coarse phase (docs/DESIGN.md §10.2,
 * §10.3), plus the global segment ordering. Literature: Nair (1987) "A simple yet effective
 * technique for global wiring" — route the *difficult* connections first (descending airline ×
 * local congestion) so easy nets bend around them; Chu & Wong (2008) FLUTE and Hwang (1976) — the
 * rectilinear-Steiner decomposition that produces the 2-pin Segments (built in `steiner.ts`);
 * McMurchie & Ebeling (1995) PathFinder — the negotiation that fills each Segment's Corridor
 * (built in `negotiate.ts`).
 *
 * A Plan is a **proposal over the Mesh, never copper** (docs/DESIGN.md §10.2): a per-net Steiner
 * topology cut into 2-pin Segments, each realised as a Corridor (an ordered list of Bins) with a
 * Sheet assignment, plus a deterministic global Segment order. Building or negotiating a Plan
 * commits nothing to the Layout, so R-1 cannot be affected (§10.5).
 *
 * Public surface: Terminal, Segment, Corridor, Plan, orderSegments.
 */
import type { Pt } from "../geom/index.ts";
import type { Mesh } from "./mesh.ts";

/**
 * One endpoint of a Segment: a net terminal (a connected component's representative Pad/Pour
 * point) or a Steiner point. `bx`/`by` is its Bin column; `bins` are the terminal Bin ids the
 * negotiation may seed from — the (bx,by) column on each Sheet the terminal may attach to.
 */
export interface Terminal {
  /** Representative point in layout units. */
  readonly point: Pt;
  /** Bin column indices into the Mesh grid. */
  readonly bx: number;
  readonly by: number;
  /** Signal Sheet ids this terminal may attach to, ascending. */
  readonly sheets: readonly number[];
  /** Terminal Bin ids (the column on each allowed Sheet), ascending — negotiation seeds. */
  readonly bins: readonly number[];
  /** Lowest item id anchoring this terminal, or −1 for a Steiner point. */
  readonly anchor: number;
}

/** A 2-pin edge of a net's Steiner topology, to be realised as a Corridor. */
export interface Segment {
  /** Dense index in the Plan's segment list. */
  readonly id: number;
  /** Net id. */
  readonly net: number;
  readonly from: Terminal;
  readonly to: Terminal;
  /** Euclidean airline between the two representative points, LU. */
  readonly airlineLu: number;
}

/** The coarse path a Segment is planned through — an ordered run of Bins. Never copper. */
export interface Corridor {
  /** Segment id this Corridor realises. */
  readonly segment: number;
  /** Ordered Bin ids from a `from` seed to a `to` seed; empty when unrealised. */
  bins: number[];
  /** Bridge ids the Corridor crosses, in order; empty when unrealised. */
  bridges: number[];
  /** The Sheet the `from` seed sits on (the Corridor's primary Sheet), or −1 when unrealised. */
  sheet: number;
  /** True when the coarse search found a path (false = hard-blocked by fixed blockage). */
  realised: boolean;
}

/** A congestion-resolved (or best-effort) proposal over the Mesh — a proposal, never copper. */
export interface Plan {
  readonly segments: readonly Segment[];
  /** Segment ids in global routing order (Nair difficulty). */
  readonly order: readonly number[];
  /** Corridor per Segment id. */
  readonly corridors: readonly Corridor[];
  /** Residual total Overflow after negotiation (0 = congestion resolved). */
  readonly overflow: number;
  /** Iterations actually run. */
  readonly iterations: number;
  /** Segments the coarse search could not realise (hard-blocked by fixed blockage). */
  readonly unrealised: number;
}

/**
 * The global Segment order (Nair 1987): route the *difficult* Segments first — descending
 * `airline × (1 + local endpoint density)`, so a long Segment through a crowded region negotiates
 * before the short easy ones bend around it. Local density is the count of terminal endpoints
 * inside a Segment's airline bounding box, read off a Bin-grid prefix sum (O(segments + bins)).
 * Deterministic: ties break by ascending Segment id (no Map-order or floating-point-address
 * dependence).
 */
export function orderSegments(mesh: Mesh, segments: readonly Segment[]): number[] {
  const nx = mesh.nx, ny = mesh.ny;
  // Endpoint density per (bx,by) Bin column.
  const density = new Int32Array(nx * ny);
  for (const s of segments) {
    density[s.from.by * nx + s.from.bx]! += 1;
    density[s.to.by * nx + s.to.bx]! += 1;
  }
  // Inclusive 2-D prefix sum, padded by one row/column so a rectangle query is four lookups.
  const pref = new Int32Array((nx + 1) * (ny + 1));
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      pref[(y + 1) * (nx + 1) + (x + 1)] =
        density[y * nx + x]! +
        pref[y * (nx + 1) + (x + 1)]! +
        pref[(y + 1) * (nx + 1) + x]! -
        pref[y * (nx + 1) + x]!;
    }
  }
  const rectSum = (x0: number, y0: number, x1: number, y1: number): number =>
    pref[(y1 + 1) * (nx + 1) + (x1 + 1)]! -
    pref[y0 * (nx + 1) + (x1 + 1)]! -
    pref[(y1 + 1) * (nx + 1) + x0]! +
    pref[y0 * (nx + 1) + x0]!;

  const key = new Float64Array(segments.length);
  for (const s of segments) {
    const x0 = Math.min(s.from.bx, s.to.bx), x1 = Math.max(s.from.bx, s.to.bx);
    const y0 = Math.min(s.from.by, s.to.by), y1 = Math.max(s.from.by, s.to.by);
    const congestion = rectSum(x0, y0, x1, y1);
    key[s.id] = s.airlineLu * (1 + congestion);
  }
  const order = segments.map((s) => s.id);
  order.sort((a, b) => key[b]! - key[a]! || a - b);
  return order;
}
