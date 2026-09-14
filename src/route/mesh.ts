/**
 * Mesh — the coarse global grid that the two-phase router negotiates on (docs/DESIGN.md §10.2,
 * §10.5). Literature: Nair (1987) "A simple yet effective technique for global wiring"; Kastner et
 * al. (2002) Labyrinth / pattern routing; Pan, Xu & Chu (2006–09) FastRoute; Cho & Pan (2006–07)
 * BoxRouter — the coarse-grid + capacity + congestion model of modern global routing; McMurchie &
 * Ebeling (1995) PathFinder — the per-Bridge `usage` / `present` / `history` cost fields the coarse
 * negotiation (M10b) will drive over this structure. Nothing here commits copper: the Mesh is a
 * data structure and a congestion report only, so R-1 cannot be affected by building it.
 *
 * Model (docs/DESIGN.md §10.2):
 *   - a **Bin** is one coarse cell on one signal Sheet; bins tile the Layout's bounding box on a
 *     `binLu`-pitch grid, `binLu` derived from the densest NetGroup's track pitch so the Mesh is
 *     ~30–120 bins across (deterministic; `globalBinUm` overrides);
 *   - a **Bridge** is a shared boundary between two adjacent Bins — an in-plane edge (E/N to the
 *     next Bin on the same Sheet) or an inter-Sheet via edge (the same (bx,by) Bin on the next
 *     signal Sheet) — carrying a **capacity** (how many width+spacing tracks may legally cross,
 *     after subtracting fixed blockage) and the live `usage` / `present` / `history` fields.
 *
 * **Capacities bake in R-2 (docs/DESIGN.md §10.2).** A Bridge's capacity is `floor(free / pitch)`
 * where `free` is the length of the shared Bin boundary NOT covered by *fixed blockage* — pads,
 * `held` / `locked` / `origin:"prior"` copper, `track` / `barrel` Fences, the Rim, and plane copper
 * — each queried through the existing `Lattice.hits` and projected onto the boundary after a
 * conservative expansion (its axis-aligned bounds grown by `margin = halfWidth + spacing`, so a
 * track centred past it keeps clearance). `free` other-net copper does NOT reduce capacity — it is
 * congestion the negotiation may move, never blockage. Every projection over-covers (an item's AABB
 * ⊇ its copper) and the division rounds DOWN, so a capacity is never optimistic: the global router
 * can never plan a track through immovable copper. A via Bridge's capacity is the analogous
 * area-based count over both adjacent Sheets (`floor(free_area / pitch²)`, the more-blocked Sheet
 * bounding it).
 *
 * Determinism: bins and bridges are numbered by a fixed index formula (Sheet, then row-major
 * (bx,by)); capacities are a pure function of the Layout and Lattice; `Lattice.hits` returns items
 * in ascending id order and the merge/round is integer arithmetic — two builds are identical.
 *
 * Public surface: Bin, BridgeKind, Bridge, Mesh, MeshOptions, buildMesh, BridgeOverflow,
 * BinCongestion, CongestionReport, meshCongestion.
 */
import type { Barrel, Fence, Layout, Pour, Pt, Track } from "../../spec/types/layout.ts";
import type { Box } from "../geom/index.ts";
import { boxExpand } from "../geom/index.ts";
import type { Lattice } from "../lattice/index.ts";
import { boundsOfShapes } from "../lattice/index.ts";

/** One coarse cell on one Sheet. `id` is its dense index in the Mesh (see `binId`). */
export interface Bin { id: number; sheet: number; bx: number; by: number }

/** `x` = in-plane East edge, `y` = in-plane North edge, `via` = inter-Sheet edge to the next Sheet. */
export type BridgeKind = "x" | "y" | "via";

/** A shared Bin boundary. `a` and `b` are the two Bin ids it joins (a < b for x/y, a below b for via). */
export interface Bridge { id: number; kind: BridgeKind; a: number; b: number; capacity: number }

export interface MeshOptions {
  /** Bin size override in µm (`globalBinUm`); else derived from the densest NetGroup's track pitch. */
  binUm?: number;
}

export interface Mesh {
  readonly box: Box;
  /** Bin pitch in LU. */
  readonly binLu: number;
  /** Bins across (x) and down (y). */
  readonly nx: number;
  readonly ny: number;
  /** The signal Sheet ids the Mesh covers, ascending (index = Sheet layer in the Mesh). */
  readonly sheets: readonly number[];
  /** Track pitch (width + spacing) the capacities are counted in, LU. */
  readonly pitch: number;
  /** Total number of Bins and Bridges. */
  readonly binCount: number;
  readonly bridgeCount: number;

  /** Bin id of grid cell (sheet, bx, by); −1 when the Sheet is not in the Mesh or (bx,by) out of range. */
  binId(sheet: number, bx: number, by: number): number;
  /** Decode a Bin id. */
  binAt(id: number): Bin;
  /** The Bin containing point `p` on `sheet` (clamped to the grid); −1 when the Sheet is not in the Mesh. */
  binOf(sheet: number, p: Pt): number;
  /** Integer centre point of a Bin. */
  centreOf(binId: number): Pt;
  /** The Bridge ids incident to a Bin (up to 4 in-plane + 2 via), ascending. */
  bridgesOf(binId: number): number[];
  /** A Bridge as plain data (its capacity resolved). */
  bridge(id: number): Bridge;

  /** Capacity of a Bridge (tracks that may cross after fixed blockage); computed once and cached. */
  capacityOf(id: number): number;
  /** Live usage / present-sharing / history of a Bridge (the PathFinder cost fields; 0 until M10b). */
  usageOf(id: number): number;
  presentOf(id: number): number;
  historyOf(id: number): number;
  setUsage(id: number, v: number): void;
  addUsage(id: number, d: number): void;
  setPresent(id: number, v: number): void;
  addPresent(id: number, d: number): void;
  resetPresent(): void;
  addHistory(id: number, d: number): void;
  /** `max(0, usage − capacity)` — the quantity the negotiation drives to zero. */
  overflowOf(id: number): number;
}

// ---- board bounding box -------------------------------------------------------------------------

function boardBox(layout: Layout): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const eat = (p: Pt) => { if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y; };
  if (layout.rim && layout.rim.outline.length > 0) {
    for (const p of layout.rim.outline) eat(p);
  } else {
    for (const pad of layout.pads) eat(pad.at);
    for (const b of layout.barrels) eat(b.at);
    for (const t of layout.tracks) for (const p of t.pts) eat(p);
    for (const p of layout.pours) for (const v of p.outline) eat(v);
    for (const f of layout.fences) eat(fenceCentre(f));
  }
  if (!(x0 <= x1 && y0 <= y1)) return { x0: 0, y0: 0, x1: 1, y1: 1 };
  if (x1 === x0) x1 = x0 + 1;
  if (y1 === y0) y1 = y0 + 1;
  return { x0, y0, x1, y1 };
}

function fenceCentre(f: Fence): Pt {
  const s = f.shape;
  switch (s.kind) {
    case "disk": return s.c;
    case "box": return { x: (s.box.x0 + s.box.x1) / 2, y: (s.box.y0 + s.box.y1) / 2 };
    case "capsule": return { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
    case "ring": case "path": return s.pts[0] ?? { x: 0, y: 0 };
  }
}

// ---- densest track pitch ------------------------------------------------------------------------

interface PitchInfo { pitch: number; margin: number }

function densestPitch(layout: Layout, signalSheets: readonly number[]): PitchInfo {
  const sample = signalSheets[0] ?? layout.stack[0]?.id ?? 0;
  let bestPitch = Infinity, bestWidth = 0, bestSpacing = 0;
  for (const g of layout.netGroups) {
    const kind = g.categoryKinds?.track ?? g.kind ?? 0;
    const spacing = layout.spacing.get(kind, kind, sample);
    const width = Math.max(0, g.trackWidth);
    const pitch = width + spacing;
    if (pitch > 0 && pitch < bestPitch) { bestPitch = pitch; bestWidth = width; bestSpacing = spacing; }
  }
  if (!Number.isFinite(bestPitch)) { bestPitch = 3000; bestWidth = 3000; bestSpacing = 0; }
  const margin = Math.ceil(bestWidth / 2 + bestSpacing);
  return { pitch: Math.max(1, Math.round(bestPitch)), margin: Math.max(0, margin) };
}

// ---- bin size -----------------------------------------------------------------------------------

const TARGET_BINS = 64;   // middle of the ~30–120 window
const MIN_BINS = 30;
const MAX_BINS = 120;

function deriveBinLu(layout: Layout, box: Box, pitch: number, opts: MeshOptions): number {
  if (opts.binUm !== undefined && opts.binUm > 0) return Math.max(1, Math.round(opts.binUm * layout.frame.luPerUm));
  const span = Math.max(1, Math.max(box.x1 - box.x0, box.y1 - box.y0));
  let b = Math.max(pitch, Math.round(span / TARGET_BINS));
  const across = () => Math.ceil(span / b);
  if (across() > MAX_BINS) b = Math.ceil(span / MAX_BINS);
  if (across() < MIN_BINS) b = Math.max(1, Math.floor(span / MIN_BINS));
  return Math.max(1, b);
}

// ---- fixed-blockage predicate (R-2) -------------------------------------------------------------

function fixedBlockage(lattice: Lattice, id: number): boolean {
  const e = lattice.itemOf(id);
  if (!e) return false;
  switch (e.cat) {
    case "pad": return true;                       // pads are always locked copper
    case "rim": return true;                       // the board edge bounds every route
    case "barrel": { const b = e.item as Barrel; return b.hold === "held" || b.hold === "locked" || b.origin === "prior"; }
    case "track": { const t = e.item as Track; return t.hold === "held" || t.hold === "locked" || t.origin === "prior"; }
    case "pour": { const p = e.item as Pour; return p.origin === "prior" || p.hold === "held" || p.hold === "locked"; }
    case "fence": { const f = e.item as Fence; return f.scope === "track" || f.scope === "barrel"; }
    default: return false;
  }
}

// ---- the Mesh -----------------------------------------------------------------------------------

/** Build a per-Sheet coarse Mesh over the Layout with capacities baked from fixed blockage. */
export function buildMesh(layout: Layout, lattice: Lattice, opts: MeshOptions = {}): Mesh {
  const sheets = layout.stack.filter((s) => s.role === "signal").map((s) => s.id);
  const S = Math.max(1, sheets.length);
  const box = boardBox(layout);
  const { pitch, margin } = densestPitch(layout, sheets);
  const binLu = deriveBinLu(layout, box, pitch, opts);
  const nx = Math.max(1, Math.ceil((box.x1 - box.x0) / binLu));
  const ny = Math.max(1, Math.ceil((box.y1 - box.y0) / binLu));

  const binsPerSheet = nx * ny;
  const binCount = S * binsPerSheet;

  // Bridge id ranges: [x][y][via], each row-major within a Sheet / via layer.
  const xPerSheet = Math.max(0, nx - 1) * ny;
  const yPerSheet = nx * Math.max(0, ny - 1);
  const viaPerLayer = binsPerSheet;
  const xTotal = S * xPerSheet;
  const yTotal = S * yPerSheet;
  const viaTotal = Math.max(0, S - 1) * viaPerLayer;
  const bridgeCount = xTotal + yTotal + viaTotal;

  const capacity = new Int32Array(bridgeCount).fill(-1);   // −1 = not yet computed
  const usage = new Float64Array(bridgeCount);
  const present = new Float64Array(bridgeCount);
  const history = new Float64Array(bridgeCount);

  const binId = (sheet: number, bx: number, by: number): number => {
    const si = sheets.indexOf(sheet);
    if (si < 0 || bx < 0 || bx >= nx || by < 0 || by >= ny) return -1;
    return si * binsPerSheet + by * nx + bx;
  };
  const binAt = (id: number): Bin => {
    const si = Math.floor(id / binsPerSheet);
    const rem = id - si * binsPerSheet;
    return { id, sheet: sheets[si]!, bx: rem % nx, by: Math.floor(rem / nx) };
  };
  const binOf = (sheet: number, p: Pt): number => {
    if (sheets.indexOf(sheet) < 0) return -1;
    const bx = Math.min(nx - 1, Math.max(0, Math.floor((p.x - box.x0) / binLu)));
    const by = Math.min(ny - 1, Math.max(0, Math.floor((p.y - box.y0) / binLu)));
    return binId(sheet, bx, by);
  };
  const cellHi = (v0: number, i: number, hi: number) => Math.min(v0 + (i + 1) * binLu, hi);
  const centreOf = (id: number): Pt => {
    const { bx, by } = binAt(id);
    const x0 = box.x0 + bx * binLu, y0 = box.y0 + by * binLu;
    return { x: Math.round((x0 + cellHi(box.x0, bx, box.x1)) / 2), y: Math.round((y0 + cellHi(box.y0, by, box.y1)) / 2) };
  };

  // ---- capacity computation ----
  /** Free length of one in-plane boundary segment, in tracks. `alongY` = the boundary runs in y. */
  const inPlaneCap = (sheet: number, alongY: boolean, c: number, a0: number, a1: number): number => {
    const len = a1 - a0;
    if (len <= 0) return 0;
    const qb: Box = alongY
      ? { x0: c - margin, x1: c + margin, y0: a0 - margin, y1: a1 + margin }
      : { x0: a0 - margin, x1: a1 + margin, y0: c - margin, y1: c + margin };
    const intervals: Array<[number, number]> = [];
    for (const ref of lattice.hits(sheet, qb, (r) => fixedBlockage(lattice, r.id))) {
      const bnd = boundsOfShapes(lattice.shapesOf(ref.id, sheet, ref.leg));
      if (!bnd) continue;
      const ex = boxExpand(bnd, margin);
      const crossLo = alongY ? ex.x0 : ex.y0, crossHi = alongY ? ex.x1 : ex.y1;
      if (crossLo > c || crossHi < c) continue;   // does not straddle the boundary line
      const lo = Math.max(a0, alongY ? ex.y0 : ex.x0), hi = Math.min(a1, alongY ? ex.y1 : ex.x1);
      if (hi > lo) intervals.push([lo, hi]);
    }
    const covered = unionLength(intervals);
    return Math.floor(Math.max(0, len - covered) / pitch);
  };

  /** Free-area via count across a Bin on Sheet layers `si` and `si+1`. */
  const viaCap = (si: number, bx: number, by: number): number => {
    const x0 = box.x0 + bx * binLu, y0 = box.y0 + by * binLu;
    const x1 = cellHi(box.x0, bx, box.x1), y1 = cellHi(box.y0, by, box.y1);
    const w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return 0;
    const area = w * h;
    const binBox: Box = { x0, y0, x1, y1 };
    let maxBlocked = 0;
    for (const sheet of [sheets[si]!, sheets[si + 1]!]) {
      let blocked = 0;
      for (const ref of lattice.hits(sheet, boxExpand(binBox, margin), (r) => fixedBlockage(lattice, r.id))) {
        const bnd = boundsOfShapes(lattice.shapesOf(ref.id, sheet, ref.leg));
        if (!bnd) continue;
        const ex = boxExpand(bnd, margin);
        const ix0 = Math.max(ex.x0, x0), iy0 = Math.max(ex.y0, y0), ix1 = Math.min(ex.x1, x1), iy1 = Math.min(ex.y1, y1);
        if (ix1 > ix0 && iy1 > iy0) blocked += (ix1 - ix0) * (iy1 - iy0);
      }
      if (blocked > maxBlocked) maxBlocked = blocked;
    }
    return Math.floor(Math.max(0, area - Math.min(maxBlocked, area)) / (pitch * pitch));
  };

  const computeCapacity = (id: number): number => {
    if (id < xTotal) {                             // x (East) bridge
      const si = Math.floor(id / xPerSheet), rem = id - si * xPerSheet;
      const by = Math.floor(rem / (nx - 1)), bx = rem % (nx - 1);
      const c = box.x0 + (bx + 1) * binLu;
      return inPlaneCap(sheets[si]!, true, c, box.y0 + by * binLu, cellHi(box.y0, by, box.y1));
    }
    if (id < xTotal + yTotal) {                    // y (North) bridge
      const j = id - xTotal, si = Math.floor(j / yPerSheet), rem = j - si * yPerSheet;
      const by = Math.floor(rem / nx), bx = rem % nx;
      const c = box.y0 + (by + 1) * binLu;
      return inPlaneCap(sheets[si]!, false, c, box.x0 + bx * binLu, cellHi(box.x0, bx, box.x1));
    }
    const j = id - xTotal - yTotal;                // via bridge
    const si = Math.floor(j / viaPerLayer), rem = j - si * viaPerLayer;
    return viaCap(si, rem % nx, Math.floor(rem / nx));
  };

  const capacityOf = (id: number): number => {
    if (id < 0 || id >= bridgeCount) return 0;
    let c = capacity[id]!;
    if (c < 0) { c = computeCapacity(id); capacity[id] = c; }
    return c;
  };

  // ---- bridge endpoints (for `bridge` / `bridgesOf` / congestion) ----
  const endpoints = (id: number): { kind: BridgeKind; a: number; b: number } => {
    if (id < xTotal) {
      const si = Math.floor(id / xPerSheet), rem = id - si * xPerSheet;
      const by = Math.floor(rem / (nx - 1)), bx = rem % (nx - 1);
      return { kind: "x", a: si * binsPerSheet + by * nx + bx, b: si * binsPerSheet + by * nx + bx + 1 };
    }
    if (id < xTotal + yTotal) {
      const j = id - xTotal, si = Math.floor(j / yPerSheet), rem = j - si * yPerSheet;
      const by = Math.floor(rem / nx), bx = rem % nx;
      return { kind: "y", a: si * binsPerSheet + by * nx + bx, b: si * binsPerSheet + (by + 1) * nx + bx };
    }
    const j = id - xTotal - yTotal, si = Math.floor(j / viaPerLayer), rem = j - si * viaPerLayer;
    return { kind: "via", a: si * binsPerSheet + rem, b: (si + 1) * binsPerSheet + rem };
  };

  const xId = (si: number, bx: number, by: number) => si * xPerSheet + by * (nx - 1) + bx;
  const yId = (si: number, bx: number, by: number) => xTotal + si * yPerSheet + by * nx + bx;
  const viaId = (si: number, bx: number, by: number) => xTotal + yTotal + si * viaPerLayer + by * nx + bx;

  const bridgesOf = (id: number): number[] => {
    const si = Math.floor(id / binsPerSheet), rem = id - si * binsPerSheet;
    const bx = rem % nx, by = Math.floor(rem / nx);
    const out: number[] = [];
    if (bx > 0) out.push(xId(si, bx - 1, by));       // West
    if (bx < nx - 1) out.push(xId(si, bx, by));      // East
    if (by > 0) out.push(yId(si, bx, by - 1));       // South
    if (by < ny - 1) out.push(yId(si, bx, by));      // North
    if (si > 0) out.push(viaId(si - 1, bx, by));     // down via
    if (si < S - 1) out.push(viaId(si, bx, by));     // up via
    return out.sort((p, q) => p - q);
  };

  const clamp = (id: number) => id >= 0 && id < bridgeCount;

  return {
    box, binLu, nx, ny, sheets, pitch, binCount, bridgeCount,
    binId, binAt, binOf, centreOf, bridgesOf,
    bridge: (id) => { const e = endpoints(id); return { id, kind: e.kind, a: e.a, b: e.b, capacity: capacityOf(id) }; },
    capacityOf,
    usageOf: (id) => (clamp(id) ? usage[id]! : 0),
    presentOf: (id) => (clamp(id) ? present[id]! : 0),
    historyOf: (id) => (clamp(id) ? history[id]! : 0),
    setUsage: (id, v) => { if (clamp(id)) usage[id] = v; },
    addUsage: (id, d) => { if (clamp(id)) usage[id]! += d; },
    setPresent: (id, v) => { if (clamp(id)) present[id] = v; },
    addPresent: (id, d) => { if (clamp(id)) present[id]! += d; },
    resetPresent: () => present.fill(0),
    addHistory: (id, d) => { if (clamp(id)) history[id]! += d; },
    overflowOf: (id) => Math.max(0, (clamp(id) ? usage[id]! : 0) - capacityOf(id)),
  };
}

/** Total length of a set of intervals after merging overlaps (integer or real endpoints). */
function unionLength(intervals: Array<[number, number]>): number {
  if (intervals.length === 0) return 0;
  intervals.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  let total = 0, lo = intervals[0]![0], hi = intervals[0]![1];
  for (let i = 1; i < intervals.length; i++) {
    const [l, h] = intervals[i]!;
    if (l > hi) { total += hi - lo; lo = l; hi = h; }
    else if (h > hi) hi = h;
  }
  return total + (hi - lo);
}

// ---- congestion / overflow report ---------------------------------------------------------------

export interface BridgeOverflow { bridge: number; kind: BridgeKind; capacity: number; usage: number; overflow: number }
export interface BinCongestion { bin: number; overflow: number }
export interface CongestionReport {
  /** Number of Bridges in the Mesh. */
  bridges: number;
  /** Bridges with `usage > capacity`. */
  overCapacity: number;
  /** Largest single-Bridge overflow and the sum of all overflow. */
  maxOverflow: number;
  totalOverflow: number;
  /** The most-congested Bridges (descending overflow, ties by id). */
  worstBridges: BridgeOverflow[];
  /** The most-congested Bins by summed incident-Bridge overflow (descending, ties by id). */
  worstBins: BinCongestion[];
}

/** Per-Bridge overflow and a board summary (docs/DESIGN.md §10.2). Diagnostics only — commits nothing. */
export function meshCongestion(mesh: Mesh, topN = 16): CongestionReport {
  let overCapacity = 0, maxOverflow = 0, totalOverflow = 0;
  const worst: BridgeOverflow[] = [];
  const binOv = new Map<number, number>();
  for (let id = 0; id < mesh.bridgeCount; id++) {
    const ov = mesh.overflowOf(id);
    if (ov <= 0) continue;
    overCapacity++;
    totalOverflow += ov;
    if (ov > maxOverflow) maxOverflow = ov;
    const b = mesh.bridge(id);
    worst.push({ bridge: id, kind: b.kind, capacity: b.capacity, usage: mesh.usageOf(id), overflow: ov });
    binOv.set(b.a, (binOv.get(b.a) ?? 0) + ov);
    binOv.set(b.b, (binOv.get(b.b) ?? 0) + ov);
  }
  worst.sort((p, q) => q.overflow - p.overflow || p.bridge - q.bridge);
  const worstBins = [...binOv.entries()].map(([bin, overflow]) => ({ bin, overflow }))
    .sort((p, q) => q.overflow - p.overflow || p.bin - q.bin).slice(0, topN);
  return {
    bridges: mesh.bridgeCount,
    overCapacity, maxOverflow, totalOverflow,
    worstBridges: worst.slice(0, topN),
    worstBins,
  };
}
