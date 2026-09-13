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
