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
 * Public surface: SearchSpace, EdgeCost, SearchOptions, SearchResult, aStar, DIRS_4, DIRS_8.
 */
import type { Pt } from "../geom/index.ts";

/** The cost of stepping across one Seam, and what it would cost to rip (empty for a clear step). */
export interface EdgeCost { blocked: boolean; extra: number; rip: readonly number[] }

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

interface HeapNode { f: number; h: number; seq: number; state: number }

class Heap {
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

const NDIR = 9; // 8 real directions plus 8 = "no incoming direction" (start)

/** Run A* over `space` between the option's start and goal cells. */
export function aStar(space: SearchSpace, o: SearchOptions): SearchResult {
  const { start, goal, region, dirs } = o;
  const width = region.gx1 - region.gx0 + 1;
  const height = region.gy1 - region.gy0 + 1;
  const inRegion = (gx: number, gy: number): boolean => gx >= region.gx0 && gx <= region.gx1 && gy >= region.gy0 && gy <= region.gy1;
  const cellIndex = (gx: number, gy: number): number => (gy - region.gy0) * width + (gx - region.gx0);
  const stateOf = (cell: number, dir: number): number => cell * NDIR + dir;

  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();       // state -> previous state
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

  const startCell = cellIndex(start.gx, start.gy);
  const startState = stateOf(startCell, 8);
  gScore.set(startState, 0);
  const heap = new Heap();
  let seq = 0;
  heap.push({ f: heuristic(start.gx, start.gy), h: heuristic(start.gx, start.gy), seq: seq++, state: startState });

  let pops = 0;
  let aborted = false;

  const reconstruct = (endState: number): Pt[] => {
    const cells: number[] = [];
    let s: number | undefined = endState;
    while (s !== undefined) {
      cells.push(cellOfState(s));
      s = cameFrom.get(s);
    }
    cells.reverse();
    return cells.map((c) => space.pointOf(gxOf(c), gyOf(c)));
  };

  void height;

  while (heap.size > 0) {
    if ((pops & 255) === 0) {
      if (o.signal?.aborted) { aborted = true; break; }
      if (o.deadline !== undefined && Date.now() > o.deadline) break;
    }
    const node = heap.pop();
    pops++;
    if (pops > o.maxPops) break;
    const cell = cellOfState(node.state);
    const cgx = gxOf(cell), cgy = gyOf(cell);
    if (cgx === goal.gx && cgy === goal.gy) {
      const path = reconstruct(node.state);
      // Collect ripped ids along the winning path (recompute edges; cheap for a short path).
      const rip = collectRip(space, path);
      return { ok: true, path, rip, pops, aborted };
    }
    const gCur = gScore.get(node.state) ?? Infinity;
    // Skip a stale heap entry (a cheaper path to this state was found after it was queued).
    if (node.f - node.h > gCur + 1e-6) continue;
    const inDir = dirOfState(node.state);
    const from = space.pointOf(cgx, cgy);
    for (let d = 0; d < dirs.length; d++) {
      const [dx, dy] = dirs[d]!;
      const ngx = cgx + dx, ngy = cgy + dy;
      if (!inRegion(ngx, ngy)) continue;
      if (!(ngx === goal.gx && ngy === goal.gy) && !space.nodeFree(ngx, ngy)) continue;
      const to = space.pointOf(ngx, ngy);
      const ec = space.edgeCost(from, to);
      if (ec.blocked) continue;
      const legLen = Math.hypot(to.x - from.x, to.y - from.y);
      const bend = inDir !== 8 && inDir !== d ? o.bendCost : 0;
      const stepG = gCur + legLen * o.stepCost(d) + bend + ec.extra;
      const nState = stateOf(cellIndex(ngx, ngy), d);
      const prev = gScore.get(nState);
      if (prev !== undefined && prev <= stepG) continue;
      gScore.set(nState, stepG);
      cameFrom.set(nState, node.state);
      const h = heuristic(ngx, ngy);
      heap.push({ f: stepG + h, h, seq: seq++, state: nState });
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

  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const heap = new Heap();
  let seq = 0;
  for (const s of o.starts) {
    if (!inRegion(s.gx, s.gy)) continue;
    const st = stateOf(cellIndex(s.gx, s.gy), s.layer, 8);
    if ((gScore.get(st) ?? Infinity) <= 0) continue;
    gScore.set(st, 0);
    const h = heuristic(s.gx, s.gy, s.layer);
    heap.push({ f: h, h, seq: seq++, state: st });
  }

  let pops = 0;
  let aborted = false;

  const reconstruct = (endState: number): LayeredStep[] => {
    const chain: number[] = [];
    let s: number | undefined = endState;
    while (s !== undefined) { chain.push(s); s = cameFrom.get(s); }
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

  while (heap.size > 0) {
    if ((pops & 255) === 0) {
      if (o.signal?.aborted) { aborted = true; break; }
      if (o.deadline !== undefined && Date.now() > o.deadline) break;
    }
    const node = heap.pop();
    pops++;
    if (pops > o.maxPops) break;
    const cell = cellOfState(node.state);
    const layer = layerOfState(node.state);
    const cgx = gxOf(cell), cgy = gyOf(cell);
    const atGoal = cgx === o.goalCell.gx && cgy === o.goalCell.gy && goalSet.has(layer);
    // Line-of-sight goal test only near the goal (bounded cost).
    const near = Math.max(Math.abs(cgx - o.goalCell.gx), Math.abs(cgy - o.goalCell.gy)) <= 8;
    if (atGoal || (near && goalSet.has(layer) && o.reachGoal?.(layer, cgx, cgy))) {
      const path = reconstruct(node.state);
      const rip = collectLayeredRip(space, path);
      return { ok: true, path, rip, pops, aborted };
    }
    const gCur = gScore.get(node.state) ?? Infinity;
    if (node.f - node.h > gCur + 1e-6) continue;
    const inDir = dirOfState(node.state);
    const from = space.pointOf(cgx, cgy);

    // Horizontal Seam crossings on the same Sheet.
    for (let d = 0; d < dirs.length; d++) {
      const [dx, dy] = dirs[d]!;
      const ngx = cgx + dx, ngy = cgy + dy;
      if (!inRegion(ngx, ngy)) continue;
      const isGoalCell = ngx === o.goalCell.gx && ngy === o.goalCell.gy;
      if (!isGoalCell && !space.nodeFree(layer, ngx, ngy)) continue;
      const to = space.pointOf(ngx, ngy);
      const ec = space.edgeCost(layer, from, to);
      if (ec.blocked) continue;
      const legLen = Math.hypot(to.x - from.x, to.y - from.y);
      const bend = inDir !== 8 && inDir !== d ? o.bendCost : 0;
      const stepG = gCur + legLen * o.stepCost(layer, d) + bend + ec.extra;
      const nState = stateOf(cellIndex(ngx, ngy), layer, d);
      const prev = gScore.get(nState);
      if (prev !== undefined && prev <= stepG) continue;
      gScore.set(nState, stepG);
      cameFrom.set(nState, node.state);
      const h = heuristic(ngx, ngy, layer);
      heap.push({ f: stepG + h, h, seq: seq++, state: nState });
    }

    // Barrel drops to another Sheet at the same cell.
    for (let lj = 0; lj < layers; lj++) {
      if (lj === layer) continue;
      const vm = space.viaMove(layer, lj, cgx, cgy);
      if (!vm) continue;
      const stepG = gCur + vm.extra;
      const nState = stateOf(cell, lj, 8);
      const prev = gScore.get(nState);
      if (prev !== undefined && prev <= stepG) continue;
      gScore.set(nState, stepG);
      cameFrom.set(nState, node.state);
      const h = heuristic(cgx, cgy, lj);
      heap.push({ f: stepG + h, h, seq: seq++, state: nState });
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
