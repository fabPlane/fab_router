/**
 * Line-probe — a gridless line-search detailed router for locked channels (docs/DESIGN.md §9b-1).
 * Literature: Hightower (1969) "A solution to line-routing problems on the continuous plane" and
 * Mikami & Tabuchi (1968) line-search routing — escape points shot as H/V (and 45°) probe lines
 * against the continuous free space, no grid; Nash, Daniel, Koenig & Felner (2007) Theta* for the
 * line-of-sight string-pull (src/route/pull.ts).
 *
 * A finer *uniform* grid cannot represent the ~150 µm channels between locked Prior copper over a
 * 50–65 mm span (proved in I7, docs/DESIGN.md §9b); a line search is geometry-defined, so it threads
 * those channels with no new spatial structure. From a source point it shoots probe lines directly
 * against the exact `sweepClear` predicate; where a probe passes an obstacle's edge it drops an
 * *escape point* (Hightower) from which a perpendicular probe can slip past — the mechanism that
 * finds a channel a straight or L route misses. The search is goal-directed (a best-first frontier
 * ordered by octile distance to the target), deterministic (directions, obstacles and escape
 * positions in a fixed order; ties by insertion sequence), and bounded (an escape-node cap plus a
 * `detailedBudgetMs`/abort deadline polled during the search).
 *
 * R-1/R-2 by construction: this module only *proposes* centrelines; every produced leg is Theta*-
 * pulled (`pull.ts`), legalised and re-checked leg-by-leg with the same exact `sweepClear` a DRC
 * uses (`legalise.ts`) before it reaches the Journal, and any partial insertion is rewound
 * atomically. Multilayer reuses the existing Barrel machinery (`dropViaNear` / `pickBarrel` /
 * `barrelFits`), so no `held`, `locked` or Prior-copper item is ever moved.
 *
 * Public surface: LineProbeOptions, lineProbeCentre, lineProbeRoute.
 */
import type { Layout, Pt } from "../../spec/types/layout.ts";
import type { Box } from "../geom/index.ts";
import type { Lattice } from "../lattice/index.ts";
import { RIM_ID, boundsOfShapes } from "../lattice/index.ts";
import type { Journal } from "./journal.ts";
import { barrelFits, sweepClear, type IgnoreSet } from "./clear.ts";
import { pullPath } from "./pull.ts";
import { legaliseTrail, trackPieces } from "./legalise.ts";
import { dropViaNear, pickBarrel } from "./via.ts";
import type { Profile } from "./profile.ts";

/** Bounds on one line-probe attempt (spec/api/settings.md `detailed*`). */
export interface LineProbeOptions {
  /** Absolute wall-clock deadline (`Date.now()`), polled during the search. */
  deadline?: number | undefined;
  /** Cancellation signal, polled during the search. */
  signal?: AbortSignal | undefined;
  /** Escape-node cap for one single-Sheet search (bounds the work). */
  maxEscapes?: number | undefined;
}

const DEFAULT_MAX_ESCAPES = 6000;
// How often the search polls the deadline / abort signal (docs/DESIGN.md §7: every ~256 pops).
const POLL_MASK = 0xff;

type ClearFn = (a: Pt, b: Pt) => boolean;

/** Octile (45°-aware) distance: an admissible heuristic in every angle mode. */
function octile(a: Pt, b: Pt): number {
  const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  const lo = Math.min(dx, dy), hi = Math.max(dx, dy);
  return (hi - lo) + Math.SQRT2 * lo;
}

/**
 * Largest integer `L` in `[0, maxLen]` for which the leg `p → p + (dx,dy)·L` is clear. `clear` is
 * monotone in `L` (a longer capsule contains a shorter one), so an exponential-then-binary search is
 * exact. `dx,dy ∈ {-1,0,1}` (axis or 45° unit step).
 */
function maxClearLen(clear: ClearFn, p: Pt, dx: number, dy: number, maxLen: number): number {
  if (maxLen <= 0) return 0;
  const at = (L: number): Pt => ({ x: p.x + dx * L, y: p.y + dy * L });
  let lo = 0;
  let hi = 1;
  while (hi < maxLen && clear(p, at(hi))) { lo = hi; hi = Math.min(hi * 2, maxLen); }
  if (clear(p, at(hi))) return hi;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (clear(p, at(mid))) lo = mid; else hi = mid; }
  return lo;
}

/** The search region: the endpoints' bounding box inflated, then clamped to the Rim's box. */
function regionOf(layout: Layout, from: Pt, to: Pt): Box {
  const bb: Box = { x0: Math.min(from.x, to.x), y0: Math.min(from.y, to.y), x1: Math.max(from.x, to.x), y1: Math.max(from.y, to.y) };
  const span = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0);
  const inflate = Math.max(span, 1);
  let box: Box = { x0: bb.x0 - inflate, y0: bb.y0 - inflate, x1: bb.x1 + inflate, y1: bb.y1 + inflate };
  if (layout.rim && layout.rim.outline.length >= 2) {
    let rx0 = Infinity, ry0 = Infinity, rx1 = -Infinity, ry1 = -Infinity;
    for (const p of layout.rim.outline) { rx0 = Math.min(rx0, p.x); ry0 = Math.min(ry0, p.y); rx1 = Math.max(rx1, p.x); ry1 = Math.max(ry1, p.y); }
    box = { x0: Math.max(box.x0, rx0), y0: Math.max(box.y0, ry0), x1: Math.min(box.x1, rx1), y1: Math.min(box.y1, ry1) };
  }
  // Keep both endpoints strictly inside.
  return {
    x0: Math.min(box.x0, from.x, to.x), y0: Math.min(box.y0, from.y, to.y),
    x1: Math.max(box.x1, from.x, to.x), y1: Math.max(box.y1, from.y, to.y),
  };
}

// A tiny binary min-heap over frontier nodes keyed (priority, sequence).
interface Frontier { push(f: number, node: number): void; pop(): number | undefined; size(): number }
function makeFrontier(): Frontier {
  const fs: number[] = [];
  const seqs: number[] = [];
  const ids: number[] = [];
  let seq = 0;
  const less = (i: number, j: number): boolean => fs[i]! < fs[j]! || (fs[i]! === fs[j]! && seqs[i]! < seqs[j]!);
  const swap = (i: number, j: number): void => {
    [fs[i], fs[j]] = [fs[j]!, fs[i]!]; [seqs[i], seqs[j]] = [seqs[j]!, seqs[i]!]; [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  };
  return {
    push(f, node) {
      fs.push(f); seqs.push(seq++); ids.push(node);
      let i = fs.length - 1;
      while (i > 0) { const par = (i - 1) >> 1; if (less(i, par)) { swap(i, par); i = par; } else break; }
    },
    pop() {
      if (fs.length === 0) return undefined;
      const top = ids[0]!;
      const last = fs.length - 1;
      swap(0, last); fs.pop(); seqs.pop(); ids.pop();
      let i = 0;
      const n = fs.length;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2; let m = i;
        if (l < n && less(l, m)) m = l;
        if (r < n && less(r, m)) m = r;
        if (m === i) break; swap(i, m); i = m;
      }
      return top;
    },
    size: () => fs.length,
  };
}

/**
 * Line-search a clear single-Sheet centreline from `from` to `to` on `sheet`, or `undefined` when
 * none is found within the budget. The result is a polyline whose every leg is a clear straight
 * line at `profile.width`; the caller still pulls, legalises and re-checks it before inserting.
 */
export function lineProbeCentre(
  layout: Layout, lattice: Lattice, sheet: number, from: Pt, to: Pt,
  profile: Profile, ignore: IgnoreSet, opts: LineProbeOptions = {},
): Pt[] | undefined {
  const clear: ClearFn = (a, b) => sweepClear(layout, lattice, sheet, { a, b }, profile, ignore, profile.width).ok;
  // Cheap first cut: the direct leg and the two L corners (Soukup 1978) — a line probe only earns
  // its cost when these miss.
  if (clear(from, to)) return [from, to];
  const l1 = { x: to.x, y: from.y }, l2 = { x: from.x, y: to.y };
  if (clear(from, l1) && clear(l1, to)) return [from, l1, to];
  if (clear(from, l2) && clear(l2, to)) return [from, l2, to];

  const region = regionOf(layout, from, to);
  const margin = Math.max(1, Math.round((profile.width / 2) + profile.maxSpacing) + 1);
  const maxEscapes = opts.maxEscapes ?? DEFAULT_MAX_ESCAPES;
  // Probe directions: H/V always; 45° too unless the angle mode is strictly 90°.
  const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (profile.angleMode !== "90") dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);

  // Escape-point nodes (a parent chain to `from`). Deduplicated by a coarse quantisation so the
  // frontier stays bounded and the walk is deterministic.
  const px: number[] = [], py: number[] = [], parent: number[] = [];
  const seen = new Set<string>();
  const quant = Math.max(1, margin);
  const key = (x: number, y: number): string => `${Math.round(x / quant)},${Math.round(y / quant)}`;
  const frontier = makeFrontier();
  const add = (x: number, y: number, par: number): void => {
    const k = key(x, y);
    if (seen.has(k)) return;
    seen.add(k);
    const id = px.length;
    px.push(x); py.push(y); parent.push(par);
    frontier.push(octile({ x, y }, to), id);
  };
  seen.add(key(from.x, from.y));
  px.push(from.x); py.push(from.y); parent.push(-1);
  frontier.push(octile(from, to), 0);

  const reconstruct = (id: number): Pt[] => {
    const out: Pt[] = [];
    for (let i = id; i >= 0; i = parent[i]!) out.push({ x: px[i]!, y: py[i]! });
    out.reverse();
    return out;
  };

  let pops = 0;
  while (frontier.size() > 0 && px.length < maxEscapes) {
    if ((pops++ & POLL_MASK) === 0) {
      if (opts.signal?.aborted) return undefined;
      if (opts.deadline !== undefined && Date.now() > opts.deadline) return undefined;
    }
    const cur = frontier.pop()!;
    const p: Pt = { x: px[cur]!, y: py[cur]! };

    // Goal test: a straight or single-bend leg to the target.
    if (clear(p, to)) return [...reconstruct(cur), to];
    const c1 = { x: to.x, y: p.y }, c2 = { x: p.x, y: to.y };
    if (clear(p, c1) && clear(c1, to)) return [...reconstruct(cur), c1, to];
    if (clear(p, c2) && clear(c2, to)) return [...reconstruct(cur), c2, to];

    // Expand: shoot a probe line in each direction and drop escape points at obstacle edges.
    for (const [dx, dy] of dirs) {
      const maxLen = dx !== 0 && dy !== 0
        ? Math.min(dx > 0 ? region.x1 - p.x : p.x - region.x0, dy > 0 ? region.y1 - p.y : p.y - region.y0)
        : dx !== 0 ? (dx > 0 ? region.x1 - p.x : p.x - region.x0) : (dy > 0 ? region.y1 - p.y : p.y - region.y0);
      const L = maxClearLen(clear, p, dx, dy, Math.max(0, maxLen));
      if (L <= 0) continue;
      const end: Pt = { x: p.x + dx * L, y: p.y + dy * L };
      add(end.x, end.y, cur); // the probe's far extent is always an escape point
      if (dx !== 0 && dy !== 0) continue; // 45° probes contribute only their extent (no edge scan)

      // Hightower escape points: scan obstacles beside the probe line and drop a turn point just
      // past each obstacle's along-axis edge, so a perpendicular probe from it slips past.
      dropEdgeEscapes(layout, lattice, sheet, p, end, dx, dy, margin, ignore, add, cur);
    }
  }
  return undefined;
}

/**
 * Drop escape points at the along-axis edges of obstacles beside the probe line `p → end`
 * (Hightower). Every escape point lies on the clear probe leg, so it is clear as a point; the
 * turn it enables is validated when it is expanded.
 */
function dropEdgeEscapes(
  layout: Layout, lattice: Lattice, sheet: number, p: Pt, end: Pt, dx: number, dy: number,
  margin: number, ignore: IgnoreSet, add: (x: number, y: number, par: number) => void, par: number,
): void {
  const lo = { x: Math.min(p.x, end.x), y: Math.min(p.y, end.y) };
  const hi = { x: Math.max(p.x, end.x), y: Math.max(p.y, end.y) };
  const reach = margin * 3; // how far to either side of the line an obstacle may sit and still gate a turn
  const box: Box = { x0: lo.x - reach, y0: lo.y - reach, x1: hi.x + reach, y1: hi.y + reach };
  const along0 = dx !== 0 ? Math.min(p.x, end.x) : Math.min(p.y, end.y);
  const along1 = dx !== 0 ? Math.max(p.x, end.x) : Math.max(p.y, end.y);
  let count = 0;
  for (const ref of lattice.hits(sheet, box)) {
    if (count >= 48) break; // cap the escape points from one probe
    if (ref.id === RIM_ID || ignore.ids.has(ref.id)) continue;
    const entry = lattice.itemOf(ref.id);
    if (!entry) continue;
    const inet = (entry.item as { net?: number | null }).net;
    if (inet !== undefined && inet !== null && ignore.net !== null && inet === ignore.net) continue;
    if (entry.cat === "pour" && (entry.item as { origin?: string }).origin !== "prior") continue;
    const b = boundsOfShapes(lattice.shapesOf(ref.id, sheet, ref.leg));
    if (!b) continue;
    // The obstacle's edges along the probe axis; a turn point sits just past each edge.
    const e0 = (dx !== 0 ? b.x0 : b.y0) - margin;
    const e1 = (dx !== 0 ? b.x1 : b.y1) + margin;
    for (const e of [e0, e1]) {
      if (e <= along0 || e >= along1) continue; // must land strictly inside the clear probe leg
      if (dx !== 0) add(e, p.y, par); else add(p.x, e, par);
      count++;
    }
  }
}

/** Pull → legalise → re-check → insert one single-Sheet centreline; false (rewound) on any block. */
function insertCentre(
  layout: Layout, lattice: Lattice, journal: Journal, sheet: number, centre: readonly Pt[],
  profile: Profile, ignore: IgnoreSet,
): boolean {
  if (centre.length < 2) return true; // a zero-length stub is already "there"
  const los: ClearFn = (a, b) => sweepClear(layout, lattice, sheet, { a, b }, profile, ignore, profile.width).ok;
  const pulled = pullPath(centre, los);
  const leg = legaliseTrail(layout, lattice, sheet, pulled, profile, ignore, true);
  if (!leg.ok) return false;
  const pieces = trackPieces(leg.pts, leg.widths);
  if (pieces.length === 0) return false;
  const mark = journal.mark();
  for (const piece of pieces) {
    if (piece.pts.length < 2) continue;
    journal.addTrack({ net: ignore.net, sheet, pts: piece.pts, width: piece.width, kind: profile.trackKind, hold: "free" });
  }
  return true;
}

/**
 * Route `from → to` with the line probe: single-Sheet on every shared usable Sheet first, then (when
 * vias are allowed and no shared Sheet closes it) a one-Barrel bridge — a via dropped near `to` on a
 * `toSheet` (existing `dropViaNear` machinery), the far Sheet's channel threaded to it with the line
 * probe. Every leg is pulled, legalised and re-checked before the Journal insert; the whole attempt
 * is rewound atomically on any failure. Returns true when copper was inserted.
 */
export function lineProbeRoute(
  layout: Layout, lattice: Lattice, journal: Journal, from: Pt, to: Pt,
  fromSheets: readonly number[], toSheets: readonly number[], viasAllowed: boolean,
  profile: Profile, ignore: IgnoreSet, opts: LineProbeOptions = {},
): boolean {
  const aborted = (): boolean => opts.signal?.aborted === true || (opts.deadline !== undefined && Date.now() > opts.deadline);

  // 1) Single-Sheet channels on every shared usable Sheet, ascending.
  const common = fromSheets.filter((s) => toSheets.includes(s)).sort((a, b) => a - b);
  for (const sheet of common) {
    if (aborted()) return false;
    const centre = lineProbeCentre(layout, lattice, sheet, from, to, profile, ignore, opts);
    if (!centre) continue;
    const mark = journal.mark();
    if (insertCentre(layout, lattice, journal, sheet, centre, profile, ignore)) return true;
    journal.rewind(mark);
  }
  if (!viasAllowed || profile.barrelForms.length === 0) return false;

  // 2) One-Barrel bridge: a via near `to` on a toSheet, its far channel line-probed on a fromSheet.
  const luPerUm = layout.frame.luPerUm;
  const maxRadius = Math.max(1, Math.round(2000 * luPerUm)); // up to ~2 mm from the pad, as in tryPlaneVia
  const froms = [...fromSheets].sort((a, b) => a - b);
  const tos = [...toSheets].sort((a, b) => a - b);
  for (const toSheet of tos) {
    for (const fromSheet of froms) {
      if (fromSheet === toSheet) continue;
      if (aborted()) return false;
      if (!pickBarrel(profile, fromSheet, toSheet)) continue;
      const drop = dropViaNear(layout, lattice, toSheet, fromSheet, to, profile, ignore, maxRadius);
      if (!drop) continue;
      const mark = journal.mark();
      // Barrel first, so the far channel treats it as same-net (K-01 joint).
      if (!barrelFits(layout, lattice, drop.at, drop.candidate, profile, ignore).ok) { journal.rewind(mark); continue; }
      journal.addBarrel({ net: ignore.net, at: drop.at, form: drop.candidate.form, fromSheet: drop.candidate.fromSheet, toSheet: drop.candidate.toSheet, kind: drop.candidate.kind, hold: "free" });
      if (drop.stub.length >= 2 && !insertCentre(layout, lattice, journal, toSheet, drop.stub, profile, ignore)) { journal.rewind(mark); continue; }
      const centre = lineProbeCentre(layout, lattice, fromSheet, from, drop.at, profile, ignore, opts);
      if (!centre || !insertCentre(layout, lattice, journal, fromSheet, centre, profile, ignore)) { journal.rewind(mark); continue; }
      return true;
    }
  }
  return false;
}
