/**
 * Search — A* over the Quilt's Patches for one connection on one Sheet (docs/DESIGN.md §6;
 * glossary "Trail"). Literature: Hart, Nilsson & Raphael (1968) A* with an admissible heuristic;
 * the maze-search lineage of Lee (1961) and Soukup (1978). Determinism (docs/DESIGN.md §7): a
 * binary heap keyed `(f, h, seq)` breaks ties by insertion sequence, the neighbour order is
 * fixed, and no Map/Set iteration reaches a decision. The `AbortSignal` and the deadline are
 * polled every 256 pops so a cancel is seen within the contract's 250 ms.
 *
 * The search state is `(cell, incomingDirection)` so `bendCost` can charge a direction change; the
 * design carries the Sheet dimension too (`(sheet, patch)`) so task I5 adds Barrel moves without
 * restructuring. The graph itself is abstracted behind `SearchSpace` so the same A* serves the
 * hard search and the soft-obstacle rip-up search (src/route/ripup.ts): `edgeCost` returns a
 * per-edge extra cost and the ids a step would rip.
 *
 * The binary heap is exported (`Heap`, `HeapNode`) so other route-layer searches that key their
 * frontier the same deterministic `(f, h, seq)` way — the corner-stitched channel A* of
 * src/route/channel.ts — reuse it instead of re-deriving one.
 *
 * Corridor guidance (task I15, M10c; docs/DESIGN.md §10.4): an optional `corridorBias` lets a caller
 * that has a global Plan (src/route/plan.ts) map a Corridor onto the two mechanisms the design names
 * — `region` and `stepCost`. `outside(gx,gy)` bounds the search to the Corridor's Bins expanded by
 * one Bin (a per-cell region restriction, so the search cannot wander into another net's corridor —
 * this breaks the mutual-walling stagnation of the local loop); `factor(gx,gy)` scales the per-LU
 * length cost — a soft discount inside the Corridor, a penalty in the one-Bin margin (guidance,
 * never a hard block; the exact predicate in `clear.ts` stays the sole gate). The bias is a pure,
 * optional overlay: when it is absent the A* arithmetic is byte-identical to the M9 search, so
 * `globalPlan:"off"` is unaffected. The A* core (heuristic, relaxation, tie-break) is unchanged.
 *
 * Public surface: SearchSpace, EdgeCost, SearchOptions, SearchResult, aStar, DIRS_4, DIRS_8,
 * Heap, HeapNode, CorridorBias, LayeredCorridorBias.
 */
import type { Pt } from "../geom/index.ts";

/** The cost of stepping across one Seam, and what it would cost to rip (empty for a clear step). */
export interface EdgeCost { blocked: boolean; extra: number; rip: readonly number[] }

/**
 * Optional Corridor guidance for the single-Sheet A* (M10c). A cell is addressed by its grid
 * coordinates; the caller maps them to a Mesh Bin. `outside` realises the `region` restriction
 * (the search may not enter a cell outside the Corridor's Bins expanded by one Bin, save the goal);
 * `factor` realises the soft `stepCost` bias (per-LU length multiplier: <1 inside, >1 in the margin).
 */
export interface CorridorBias {
  outside(gx: number, gy: number): boolean;
  factor(gx: number, gy: number): number;
}

/** Optional Corridor guidance for the layered (multi-Sheet) A*, addressed by `(layer, gx, gy)`. */
export interface LayeredCorridorBias {
  outside(layer: number, gx: number, gy: number): boolean;
  factor(layer: number, gx: number, gy: number): number;
}

/** The graph the search walks: a uniform grid of Patches on one Sheet. */
export interface SearchSpace {
  readonly step: number;
  pointOf(gx: number, gy: number): Pt;
  /** Cheap necessary condition (cached Patch state); a blocked Patch is never expanded. */
  nodeFree(gx: number, gy: number): boolean;
  /** Exact clearance of the Seam crossing from grid point `a` to `b`. */
  edgeCost(a: Pt, b: Pt): EdgeCost;
}

export interface SearchOptions {
  start: { gx: number; gy: number };
  goal: { gx: number; gy: number };
  /** Inclusive cell bounds the search may not leave. */
  region: { gx0: number; gy0: number; gx1: number; gy1: number };
  /** 4 in "90" mode, 8 otherwise. */
  dirs: readonly (readonly [number, number])[];
  /** Cost multiplier per LU for a step; index matches `dirs`. */
  stepCost(dirIndex: number): number;
  /** Smallest per-LU step cost (for an admissible heuristic). */
  minCost: number;
  bendCost: number;
  /** Upper bound on node pops before the search gives up. */
  maxPops: number;
  deadline?: number;
  signal?: AbortSignal;
  /** Optional Corridor guidance (M10c). Absent = the M9 search, byte-identical. */
  corridorBias?: CorridorBias;
}

export interface SearchResult {
  ok: boolean;
  /** Grid path from start to goal (inclusive), empty when `ok` is false. */
  path: Pt[];
  /** Item ids the winning path would rip (soft search only). */
  rip: number[];
  pops: number;
  aborted: boolean;
}

export const DIRS_4: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const DIRS_8: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

// ---- binary heap keyed (f, h, seq) ------------------------------------------------------------

export interface HeapNode { f: number; h: number; seq: number; state: number }

export class Heap {
  private a: HeapNode[] = [];
  get size(): number { return this.a.length; }
  private less(i: number, j: number): boolean {
    const x = this.a[i]!, y = this.a[j]!;
    return x.f < y.f || (x.f === y.f && (x.h < y.h || (x.h === y.h && x.seq < y.seq)));
  }
  push(n: HeapNode): void {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (this.less(i, p)) { [a[i], a[p]] = [a[p]!, a[i]!]; i = p; } else break; }
  }
  pop(): HeapNode {
    const a = this.a;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) { a[0] = last; this.down(0); }
    return top;
  }
  private down(i: number): void {
    const a = this.a, n = a.length;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < n && this.less(l, m)) m = l;
      if (r < n && this.less(r, m)) m = r;
      if (m === i) break;
      [a[i], a[m]] = [a[m]!, a[i]!];
      i = m;
    }
  }
}

// ---- allocation-free frontier and visited store (task I11, M9c) --------------------------------
//
// The A* loop of `aStar` / `aStarLayered` is behaviour-identical to a `Map`/object-node version but
// avoids per-step object and Map-entry churn (the GC pressure the M9c profile flagged): the frontier
// is a struct-of-arrays binary heap and the visited set is an open-addressing hash table, both on
// typed arrays and both pooled across connections. Determinism is unchanged: the heap orders by the
// same total order `(f, h, seq)` (seq is unique per push, so pop order equals the sorted order
// regardless of internal layout), and the visited store holds the identical float g-scores and
// parent links the two Maps did. The pools are reused, never concurrently: a search runs to
// completion before the next begins and no `SearchSpace` callback re-enters the search.

/** Struct-of-arrays min-heap keyed `(f, h, seq)`; pop leaves the popped fields in `popF/popH/popState`. */
class SoaHeap {
  private f = new Float64Array(1024);
  private h = new Float64Array(1024);
  private seq = new Float64Array(1024);
  private st = new Float64Array(1024);
  private n = 0;
  private cap = 1024;
  popF = 0; popH = 0; popState = 0;
  get size(): number { return this.n; }
  clear(): void { this.n = 0; }
  private less(i: number, j: number): boolean {
    const fi = this.f[i]!, fj = this.f[j]!;
    if (fi < fj) return true;
    if (fi > fj) return false;
    const hi = this.h[i]!, hj = this.h[j]!;
    if (hi < hj) return true;
    if (hi > hj) return false;
    return this.seq[i]! < this.seq[j]!;
  }
  private swap(i: number, j: number): void {
    const f = this.f, h = this.h, s = this.seq, st = this.st;
    const tf = f[i]!; f[i] = f[j]!; f[j] = tf;
    const th = h[i]!; h[i] = h[j]!; h[j] = th;
    const ts = s[i]!; s[i] = s[j]!; s[j] = ts;
    const tt = st[i]!; st[i] = st[j]!; st[j] = tt;
  }
  private grow(): void {
    const cap = this.cap * 2;
    const f = new Float64Array(cap); f.set(this.f);
    const h = new Float64Array(cap); h.set(this.h);
    const s = new Float64Array(cap); s.set(this.seq);
    const st = new Float64Array(cap); st.set(this.st);
    this.f = f; this.h = h; this.seq = s; this.st = st; this.cap = cap;
  }
  push(f: number, h: number, seq: number, state: number): void {
    if (this.n === this.cap) this.grow();
    let i = this.n++;
    this.f[i] = f; this.h[i] = h; this.seq[i] = seq; this.st[i] = state;
    while (i > 0) { const p = (i - 1) >> 1; if (this.less(i, p)) { this.swap(i, p); i = p; } else break; }
  }
  pop(): void {
    this.popF = this.f[0]!; this.popH = this.h[0]!; this.popState = this.st[0]!;
    const last = --this.n;
    if (last > 0) {
      this.f[0] = this.f[last]!; this.h[0] = this.h[last]!; this.seq[0] = this.seq[last]!; this.st[0] = this.st[last]!;
      let i = 0;
      const n = last;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < n && this.less(l, m)) m = l;
        if (r < n && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
  }
}

const NONE = -1; // parent sentinel: a start state has no predecessor

/** Open-addressing hash table `state -> (g, parent)`; reset in O(1) by bumping a generation stamp. */
class VisitedStore {
  private keys = new Float64Array(1024);
  private stamp = new Int32Array(1024);
  private gval = new Float64Array(1024);
  private parent = new Float64Array(1024);
  private mask = 1023;
  private cap = 1024;
  private count = 0;
  private gen = 0;
  private pi = 0;
  private pf = false;
  reset(): void {
    this.count = 0;
    this.gen++;
    if (this.gen >= 0x7fffffff) { this.stamp.fill(0); this.gen = 1; }
  }
  private hash(key: number): number {
    const hi = Math.floor(key / 4294967296);
    let h = Math.imul((key >>> 0) ^ hi, 2654435761);
    h ^= h >>> 15;
    return h & this.mask;
  }
  private probe(key: number): void {
    let i = this.hash(key);
    const stamp = this.stamp, keys = this.keys, gen = this.gen;
    while (stamp[i] === gen) {
      if (keys[i] === key) { this.pi = i; this.pf = true; return; }
      i = (i + 1) & this.mask;
    }
    this.pi = i; this.pf = false;
  }
  private grow(): void {
    const oldKeys = this.keys, oldStamp = this.stamp, oldG = this.gval, oldP = this.parent, oldGen = this.gen, oldCap = this.cap;
    const cap = oldCap * 2;
    this.keys = new Float64Array(cap);
    this.stamp = new Int32Array(cap);
    this.gval = new Float64Array(cap);
    this.parent = new Float64Array(cap);
    this.mask = cap - 1;
    this.cap = cap;
    for (let i = 0; i < oldCap; i++) {
      if (oldStamp[i] !== oldGen) continue;
      const key = oldKeys[i]!;
      let j = this.hash(key);
      while (this.stamp[j] === oldGen) j = (j + 1) & this.mask;
      this.keys[j] = key; this.stamp[j] = oldGen; this.gval[j] = oldG[i]!; this.parent[j] = oldP[i]!;
    }
  }
  /** g-score of `key`, or `dflt` when absent. */
  gOr(key: number, dflt: number): number {
    this.probe(key);
    return this.pf ? this.gval[this.pi]! : dflt;
  }
  /** True when `key` is present and its g-score is ≤ `val` (the A* relaxation skip test). */
  leq(key: number, val: number): boolean {
    this.probe(key);
    return this.pf && this.gval[this.pi]! <= val;
  }
  /** Parent state of `key`, or `NONE` when `key` is a start or absent. */
  parentOf(key: number): number {
    this.probe(key);
    return this.pf ? this.parent[this.pi]! : NONE;
  }
  /** Insert or overwrite `key`'s g-score and parent. */
  put(key: number, g: number, parent: number): void {
    this.probe(key);
    let i = this.pi;
    if (!this.pf) {
      if ((this.count + 1) * 10 > this.cap * 7) { this.grow(); let j = this.hash(key); while (this.stamp[j] === this.gen) j = (j + 1) & this.mask; i = j; }
      this.keys[i] = key; this.stamp[i] = this.gen; this.count++;
    }
    this.gval[i] = g; this.parent[i] = parent;
  }
}

// One pooled frontier/visited pair; a search resets both at entry (see the reentrancy note above).
const HEAP = new SoaHeap();
const VIS = new VisitedStore();

const NDIR = 9; // 8 real directions plus 8 = "no incoming direction" (start)

/** Run A* over `space` between the option's start and goal cells. */
export function aStar(space: SearchSpace, o: SearchOptions): SearchResult {
  const { start, goal, region, dirs } = o;
  const width = region.gx1 - region.gx0 + 1;
  const height = region.gy1 - region.gy0 + 1;
  const inRegion = (gx: number, gy: number): boolean => gx >= region.gx0 && gx <= region.gx1 && gy >= region.gy0 && gy <= region.gy1;
  const cellIndex = (gx: number, gy: number): number => (gy - region.gy0) * width + (gx - region.gx0);
  const stateOf = (cell: number, dir: number): number => cell * NDIR + dir;

  const cellOfState = (state: number): number => Math.floor(state / NDIR);
  const dirOfState = (state: number): number => state % NDIR;

  // Decode a cell index back to grid coords.
  const gxOf = (cell: number): number => region.gx0 + (cell % width);
  const gyOf = (cell: number): number => region.gy0 + Math.floor(cell / width);

  const heuristic = (gx: number, gy: number): number => {
    const dx = Math.abs(gx - goal.gx), dy = Math.abs(gy - goal.gy);
    // Octile distance when diagonals exist, Manhattan otherwise; both admissible with minCost.
    const diag = dirs.length > 4 ? Math.min(dx, dy) : 0;
    const straight = dirs.length > 4 ? Math.abs(dx - dy) : dx + dy;
    const cells = diag * Math.SQRT2 + straight;
    return cells * space.step * o.minCost;
  };

  // Per-direction step cost is a pure function of `d`; cache it once instead of a closure call per
  // neighbour. Per-direction leg length is filled lazily from the first real (from, to) it sees, so
  // it equals the original `Math.hypot(to.x - from.x, to.y - from.y)` bit-for-bit (the difference is
  // exactly `dx * step` for a linear `pointOf`, constant across the search).
  const nd = dirs.length;
  const stepCostOf = new Float64Array(nd);
  for (let d = 0; d < nd; d++) stepCostOf[d] = o.stepCost(d);
  const legLenOf = new Float64Array(nd);
  for (let d = 0; d < nd; d++) legLenOf[d] = -1;

  VIS.reset();
  HEAP.clear();
  const startCell = cellIndex(start.gx, start.gy);
  const startState = stateOf(startCell, 8);
  VIS.put(startState, 0, NONE);
  let seq = 0;
  const h0 = heuristic(start.gx, start.gy);
  HEAP.push(h0, h0, seq++, startState);

  let pops = 0;
  let aborted = false;

  const reconstruct = (endState: number): Pt[] => {
    const cells: number[] = [];
    let s = endState;
    for (;;) { cells.push(cellOfState(s)); const p = VIS.parentOf(s); if (p === NONE) break; s = p; }
    cells.reverse();
    return cells.map((c) => space.pointOf(gxOf(c), gyOf(c)));
  };

  void height;

  while (HEAP.size > 0) {
    if ((pops & 255) === 0) {
      if (o.signal?.aborted) { aborted = true; break; }
      if (o.deadline !== undefined && Date.now() > o.deadline) break;
    }
    HEAP.pop();
    const nodeF = HEAP.popF, nodeH = HEAP.popH, nodeState = HEAP.popState;
    pops++;
    if (pops > o.maxPops) break;
    const cell = cellOfState(nodeState);
    const cgx = gxOf(cell), cgy = gyOf(cell);
    if (cgx === goal.gx && cgy === goal.gy) {
      const path = reconstruct(nodeState);
      // Collect ripped ids along the winning path (recompute edges; cheap for a short path).
      const rip = collectRip(space, path);
      return { ok: true, path, rip, pops, aborted };
    }
    const gCur = VIS.gOr(nodeState, Infinity);
    // Skip a stale heap entry (a cheaper path to this state was found after it was queued).
    if (nodeF - nodeH > gCur + 1e-6) continue;
    const inDir = dirOfState(nodeState);
    const from = space.pointOf(cgx, cgy);
    const bias = o.corridorBias;
    for (let d = 0; d < nd; d++) {
      const [dx, dy] = dirs[d]!;
      const ngx = cgx + dx, ngy = cgy + dy;
      const isGoal = ngx === goal.gx && ngy === goal.gy;
      if (!inRegion(ngx, ngy)) continue;
      // Corridor region restriction (M10c): stay inside the Corridor's Bins expanded one Bin, but
      // never wall off the goal itself. A no-op when `corridorBias` is absent (globalPlan:"off").
      if (bias !== undefined && !isGoal && bias.outside(ngx, ngy)) continue;
      if (!isGoal && !space.nodeFree(ngx, ngy)) continue;
      const to = space.pointOf(ngx, ngy);
      const ec = space.edgeCost(from, to);
      if (ec.blocked) continue;
      let legLen = legLenOf[d]!;
      if (legLen < 0) { legLen = Math.hypot(to.x - from.x, to.y - from.y); legLenOf[d] = legLen; }
      const bend = inDir !== 8 && inDir !== d ? o.bendCost : 0;
      // Soft Corridor cost bias (M10c): scale only the length term; identical when the bias is absent.
      let lenCost = legLen * stepCostOf[d]!;
      if (bias !== undefined) lenCost *= bias.factor(ngx, ngy);
      const stepG = gCur + lenCost + bend + ec.extra;
      const nState = stateOf(cellIndex(ngx, ngy), d);
      if (VIS.leq(nState, stepG)) continue;
      VIS.put(nState, stepG, nodeState);
      const h = heuristic(ngx, ngy);
      HEAP.push(stepG + h, h, seq++, nState);
    }
  }
  return { ok: false, path: [], rip: [], pops, aborted };
}

/** Ids ripped by every edge of a path, deduplicated, ascending. */
function collectRip(space: SearchSpace, path: readonly Pt[]): number[] {
  const set = new Set<number>();
  for (let i = 1; i < path.length; i++) {
    const ec = space.edgeCost(path[i - 1]!, path[i]!);
    for (const id of ec.rip) set.add(id);
  }
  return [...set].sort((a, b) => a - b);
}

// ---- multi-Sheet A* with Barrel (via) moves (task I5) -----------------------------------------

/**
 * The graph the layered search walks: a shared uniform grid over `layers` usable Sheets, with a
 * horizontal Seam crossing on one Sheet and a vertical Barrel drop at a cell joining two Sheets
 * (docs/DESIGN.md §6: the A* state is `(sheet, patch)`; a Barrel move costs `viaCost` /
 * `planeViaCost`). A `layer` is an index into the connection's usable-Sheet list.
 */
export interface LayeredSpace {
  readonly step: number;
  readonly layers: number;
  pointOf(gx: number, gy: number): Pt;
  nodeFree(layer: number, gx: number, gy: number): boolean;
  edgeCost(layer: number, a: Pt, b: Pt): EdgeCost;
  /** A Barrel at `(gx, gy)` joining layers `li` and `lj`; `null` when none fits there. */
  viaMove(li: number, lj: number, gx: number, gy: number): { extra: number; rip: readonly number[] } | null;
}

export interface LayeredOptions {
  starts: ReadonlyArray<{ layer: number; gx: number; gy: number }>;
  goalCell: { gx: number; gy: number };
  goalLayers: readonly number[];
  region: { gx0: number; gy0: number; gx1: number; gy1: number };
  dirs: readonly (readonly [number, number])[];
  /** Cost multiplier per LU for a step on `layer`; `d` indexes `dirs`. */
  stepCost(layer: number, d: number): number;
  minCost: number;
  bendCost: number;
  /** Smallest possible Barrel cost, for the heuristic (admissible when ≤ every `viaMove.extra`). */
  viaFloor: number;
  maxPops: number;
  deadline?: number;
  signal?: AbortSignal;
  /** Optional Theta*-style goal test: clear straight line-of-sight from `(gx,gy)` on `layer` to
   *  the goal point on a goal layer. Lets the search finish near a goal buried in a pin field. */
  reachGoal?(layer: number, gx: number, gy: number): boolean;
  /** Optional Corridor guidance (M10c). Absent = the M9 layered search, byte-identical. */
  corridorBias?: LayeredCorridorBias;
}

export interface LayeredStep { layer: number; pt: Pt; via: boolean }
export interface LayeredResult { ok: boolean; path: LayeredStep[]; rip: number[]; pops: number; aborted: boolean }

/** Run A* over `space`'s layered grid from any start to the goal cell on any goal layer. */
export function aStarLayered(space: LayeredSpace, o: LayeredOptions): LayeredResult {
  const { region, dirs } = o;
  const width = region.gx1 - region.gx0 + 1;
  const layers = space.layers;
  const inRegion = (gx: number, gy: number): boolean => gx >= region.gx0 && gx <= region.gx1 && gy >= region.gy0 && gy <= region.gy1;
  const cellIndex = (gx: number, gy: number): number => (gy - region.gy0) * width + (gx - region.gx0);
  const gxOf = (cell: number): number => region.gx0 + (cell % width);
  const gyOf = (cell: number): number => region.gy0 + Math.floor(cell / width);
  const stateOf = (cell: number, layer: number, dir: number): number => (cell * layers + layer) * NDIR + dir;
  const cellOfState = (s: number): number => Math.floor(s / (layers * NDIR));
  const layerOfState = (s: number): number => Math.floor(s / NDIR) % layers;
  const dirOfState = (s: number): number => s % NDIR;

  const goalSet = new Set(o.goalLayers);
  const heuristic = (gx: number, gy: number, layer: number): number => {
    const dx = Math.abs(gx - o.goalCell.gx), dy = Math.abs(gy - o.goalCell.gy);
    const diag = dirs.length > 4 ? Math.min(dx, dy) : 0;
    const straight = dirs.length > 4 ? Math.abs(dx - dy) : dx + dy;
    const cells = diag * Math.SQRT2 + straight;
    return cells * space.step * o.minCost + (goalSet.has(layer) ? 0 : o.viaFloor);
  };

  // Cache the per-(layer, direction) step cost and the per-direction leg length (see `aStar`); both
  // are byte-identical substitutes for the original closure call and `Math.hypot`.
  const nd = dirs.length;
  const stepCostOf = new Float64Array(layers * nd);
  for (let ly = 0; ly < layers; ly++) for (let d = 0; d < nd; d++) stepCostOf[ly * nd + d] = o.stepCost(ly, d);
  const legLenOf = new Float64Array(nd);
  for (let d = 0; d < nd; d++) legLenOf[d] = -1;

  VIS.reset();
  HEAP.clear();
  let seq = 0;
  for (const s of o.starts) {
    if (!inRegion(s.gx, s.gy)) continue;
    const st = stateOf(cellIndex(s.gx, s.gy), s.layer, 8);
    if (VIS.gOr(st, Infinity) <= 0) continue;
    VIS.put(st, 0, NONE);
    const h = heuristic(s.gx, s.gy, s.layer);
    HEAP.push(h, h, seq++, st);
  }

  let pops = 0;
  let aborted = false;

  const reconstruct = (endState: number): LayeredStep[] => {
    const chain: number[] = [];
    let s = endState;
    for (;;) { chain.push(s); const p = VIS.parentOf(s); if (p === NONE) break; s = p; }
    chain.reverse();
    const out: LayeredStep[] = [];
    for (let i = 0; i < chain.length; i++) {
      const st = chain[i]!;
      const cell = cellOfState(st), layer = layerOfState(st);
      const prev = i > 0 ? chain[i - 1]! : undefined;
      const via = prev !== undefined && cellOfState(prev) === cell && layerOfState(prev) !== layer;
      out.push({ layer, pt: space.pointOf(gxOf(cell), gyOf(cell)), via });
    }
    return out;
  };

  while (HEAP.size > 0) {
    if ((pops & 255) === 0) {
      if (o.signal?.aborted) { aborted = true; break; }
      if (o.deadline !== undefined && Date.now() > o.deadline) break;
    }
    HEAP.pop();
    const nodeF = HEAP.popF, nodeH = HEAP.popH, nodeState = HEAP.popState;
    pops++;
    if (pops > o.maxPops) break;
    const cell = cellOfState(nodeState);
    const layer = layerOfState(nodeState);
    const cgx = gxOf(cell), cgy = gyOf(cell);
    const atGoal = cgx === o.goalCell.gx && cgy === o.goalCell.gy && goalSet.has(layer);
    // Line-of-sight goal test only near the goal (bounded cost).
    const near = Math.max(Math.abs(cgx - o.goalCell.gx), Math.abs(cgy - o.goalCell.gy)) <= 8;
    if (atGoal || (near && goalSet.has(layer) && o.reachGoal?.(layer, cgx, cgy))) {
      const path = reconstruct(nodeState);
      const rip = collectLayeredRip(space, path);
      return { ok: true, path, rip, pops, aborted };
    }
    const gCur = VIS.gOr(nodeState, Infinity);
    if (nodeF - nodeH > gCur + 1e-6) continue;
    const inDir = dirOfState(nodeState);
    const from = space.pointOf(cgx, cgy);
    const bias = o.corridorBias;

    // Horizontal Seam crossings on the same Sheet.
    for (let d = 0; d < nd; d++) {
      const [dx, dy] = dirs[d]!;
      const ngx = cgx + dx, ngy = cgy + dy;
      if (!inRegion(ngx, ngy)) continue;
      const isGoalCell = ngx === o.goalCell.gx && ngy === o.goalCell.gy;
      if (bias !== undefined && !isGoalCell && bias.outside(layer, ngx, ngy)) continue;
      if (!isGoalCell && !space.nodeFree(layer, ngx, ngy)) continue;
      const to = space.pointOf(ngx, ngy);
      const ec = space.edgeCost(layer, from, to);
      if (ec.blocked) continue;
      let legLen = legLenOf[d]!;
      if (legLen < 0) { legLen = Math.hypot(to.x - from.x, to.y - from.y); legLenOf[d] = legLen; }
      const bend = inDir !== 8 && inDir !== d ? o.bendCost : 0;
      let lenCost = legLen * stepCostOf[layer * nd + d]!;
      if (bias !== undefined) lenCost *= bias.factor(layer, ngx, ngy);
      const stepG = gCur + lenCost + bend + ec.extra;
      const nState = stateOf(cellIndex(ngx, ngy), layer, d);
      if (VIS.leq(nState, stepG)) continue;
      VIS.put(nState, stepG, nodeState);
      const h = heuristic(ngx, ngy, layer);
      HEAP.push(stepG + h, h, seq++, nState);
    }

    // Barrel drops to another Sheet at the same cell.
    for (let lj = 0; lj < layers; lj++) {
      if (lj === layer) continue;
      const isGoalCell = cgx === o.goalCell.gx && cgy === o.goalCell.gy;
      if (bias !== undefined && !isGoalCell && bias.outside(lj, cgx, cgy)) continue;
      const vm = space.viaMove(layer, lj, cgx, cgy);
      if (!vm) continue;
      const stepG = gCur + vm.extra;
      const nState = stateOf(cell, lj, 8);
      if (VIS.leq(nState, stepG)) continue;
      VIS.put(nState, stepG, nodeState);
      const h = heuristic(cgx, cgy, lj);
      HEAP.push(stepG + h, h, seq++, nState);
    }
  }
  return { ok: false, path: [], rip: [], pops, aborted };
}

function collectLayeredRip(space: LayeredSpace, path: readonly LayeredStep[]): number[] {
  const set = new Set<number>();
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!;
    // Barrel moves are only permitted by `viaMove` when they fit against hard obstacles, so they
    // rip nothing; only same-Sheet Seam crossings carry rip ids.
    if (!b.via && a.layer === b.layer) for (const id of space.edgeCost(a.layer, a.pt, b.pt).rip) set.add(id);
  }
  return [...set].sort((x, y) => x - y);
}
