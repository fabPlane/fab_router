/**
 * Exact shape comparisons for DRC and connectivity (spec/rules/drc.md DR-07: distances are
 * Euclidean between the true copper shapes; spec/rules/connectivity.md K-01: touching counts as
 * overlap).
 *
 * Every decision is the squared comparison over the convex cores of `src/geom`:
 *   closer(a, b, required)  ⇔  dist²(coreA, coreB) < (required + rA + rB)²
 *   touching(a, b)          ⇔  dist²(coreA, coreB) ≤ (rA + rB)²
 * which never takes a square root and is exact whenever the nearest core points are vertices
 * (Shewchuk 1997 is the reason decisions must be exact; the coordinate bound of src/geom makes
 * them so). The same formulation is used by the router's clearance queries (src/route/clear.ts),
 * so the two never disagree on ties. `distance` (a float) and `gapPoint` (a point in the gap or
 * overlap) are informational: they fill `Violation.actual` and `Violation.at`.
 *
 * DR-11 (copper stays on the board, ruling Q-I3b-43) is decided by `crossesEdge` and `withinRim`,
 * the same rule the router's clearance queries apply (src/route/clear.ts; the layering of
 * docs/DESIGN.md §8 keeps `drc` below `route`, so the rule is stated here in the same words):
 * for a rounded core no outline or cut-out edge within the core radius; for a sharp core no
 * proper crossing and no edge endpoint strictly inside; then one probe point per rounded part
 * (every core point of a sharp part) neither outside the outline nor inside a cut-out; touching
 * is on the board.
 *
 * Public surface: closer, touching, anyCloser, anyTouching, distance, minDistance, gapPoint,
 * crossesEdge, withinRim.
 */
import type { Rim } from "../../spec/types/layout.ts";
import type { ConvexShape, Core, Pt, Shape } from "../geom/index.ts";
import { coreOf, cross, dist2PtPt, dist2PtSeg, dist2Pts, dot, orient, pointInConvex, pointInRing, segsIntersect } from "../geom/index.ts";

type Convex = ConvexShape;

function closerConvex(a: Convex, b: Convex, required: number): boolean {
  const ca = coreOf(a), cb = coreOf(b);
  const need = required + ca.r + cb.r;
  return dist2Pts(ca.pts, cb.pts) < need * need;
}

function touchingConvex(a: Convex, b: Convex): boolean {
  const ca = coreOf(a), cb = coreOf(b);
  const need = ca.r + cb.r;
  return dist2Pts(ca.pts, cb.pts) <= need * need;
}

/** dist(a, b) < required, exactly; never true for required ≤ 0. */
export function closer(a: Shape, b: Shape, required: number): boolean {
  if (required <= 0) return false;
  if (a.kind === "pieces") return a.parts.some((p) => closer(p, b, required));
  if (b.kind === "pieces") return b.parts.some((p) => closer(a, p, required));
  return closerConvex(a, b, required);
}

/** dist(a, b) ≤ 0: the shapes overlap or touch. */
export function touching(a: Shape, b: Shape): boolean {
  if (a.kind === "pieces") return a.parts.some((p) => touching(p, b));
  if (b.kind === "pieces") return b.parts.some((p) => touching(a, p));
  return touchingConvex(a, b);
}

export function anyCloser(as: readonly Shape[], bs: readonly Shape[], required: number): boolean {
  if (required <= 0) return false;
  for (const a of as) for (const b of bs) if (closer(a, b, required)) return true;
  return false;
}

export function anyTouching(as: readonly Shape[], bs: readonly Shape[]): boolean {
  for (const a of as) for (const b of bs) if (touching(a, b)) return true;
  return false;
}

function distanceConvex(a: Convex, b: Convex): number {
  const ca = coreOf(a), cb = coreOf(b);
  const d = Math.sqrt(dist2Pts(ca.pts, cb.pts)) - ca.r - cb.r;
  return d <= 0 ? 0 : d;
}

/** Euclidean distance between two shapes (0 when they overlap); float64. */
export function distance(a: Shape, b: Shape): number {
  if (a.kind === "pieces") { let best = Infinity; for (const p of a.parts) best = Math.min(best, distance(p, b)); return best; }
  if (b.kind === "pieces") return distance(b, a);
  return distanceConvex(a, b);
}

/** Smallest distance over two shape lists (Infinity for an empty list). */
export function minDistance(as: readonly Shape[], bs: readonly Shape[]): number {
  let best = Infinity;
  for (const a of as) for (const b of bs) { const d = distance(a, b); if (d < best) { best = d; if (d === 0) return 0; } }
  return best;
}

// ---- a point in the gap ---------------------------------------------------------------------

function nearestOnSeg(p: Pt, a: Pt, b: Pt): Pt {
  if (a.x === b.x && a.y === b.y) return a;
  if (dot(a, b, p) <= 0) return a;
  if (dot(b, a, p) <= 0) return b;
  const len2 = dist2PtPt(a, b);
  const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2;
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

function edgesOf(pts: readonly Pt[]): Array<[Pt, Pt]> {
  if (pts.length < 2) return [];
  if (pts.length === 2) return [[pts[0]!, pts[1]!]];
  const out: Array<[Pt, Pt]> = [];
  for (let i = 0; i < pts.length; i++) out.push([pts[i]!, pts[(i + 1) % pts.length]!]);
  return out;
}

function lineCrossing(a: Pt, b: Pt, c: Pt, d: Pt): Pt {
  const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (den === 0) return { x: (a.x + b.x + c.x + d.x) / 4, y: (a.y + b.y + c.y + d.y) / 4 };
  const t = cross(c, d, a) / -den;
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

/** The closest pair of points between two cores (radius ignored); approximate for crossings. */
function closestCorePoints(a: Core, b: Core): [Pt, Pt] {
  const A = a.pts, B = b.pts;
  if (A.length >= 3 && B.length >= 1 && pointInConvex(A, B[0]!) !== "outside") return [B[0]!, B[0]!];
  if (B.length >= 3 && A.length >= 1 && pointInConvex(B, A[0]!) !== "outside") return [A[0]!, A[0]!];
  const ea = edgesOf(A), eb = edgesOf(B);
  for (const [p, q] of ea) for (const [r, s] of eb) if (segsIntersect(p, q, r, s)) { const x = lineCrossing(p, q, r, s); return [x, x]; }
  let best = Infinity;
  let pair: [Pt, Pt] = [A[0]!, B[0]!];
  const consider = (p: Pt, q: Pt) => { const d = dist2PtPt(p, q); if (d < best) { best = d; pair = [p, q]; } };
  if (A.length === 1 && B.length === 1) return [A[0]!, B[0]!];
  for (const p of A) {
    if (eb.length === 0) consider(p, B[0]!);
    for (const [r, s] of eb) { const q = nearestOnSeg(p, r, s); if (dist2PtSeg(p, r, s) < best) consider(p, q); }
  }
  for (const q of B) {
    if (ea.length === 0) consider(A[0]!, q);
    for (const [p, r] of ea) { const s = nearestOnSeg(q, p, r); if (dist2PtSeg(q, p, r) < best) consider(s, q); }
  }
  return pair;
}

/** A point in the gap (or the overlap) between two shapes: the midpoint of the nearest pair, integer LU. */
export function gapPoint(a: Shape, b: Shape): Pt {
  if (a.kind === "pieces" || b.kind === "pieces") {
    const as = a.kind === "pieces" ? a.parts : [a];
    const bs = b.kind === "pieces" ? b.parts : [b];
    let best = Infinity;
    let pick: [Convex, Convex] = [as[0]!, bs[0]!];
    for (const p of as) for (const q of bs) { const d = distanceConvex(p, q); if (d < best) { best = d; pick = [p, q]; if (d === 0) break; } }
    return gapPoint(pick[0], pick[1]);
  }
  const ca = coreOf(a), cb = coreOf(b);
  const [p, q] = closestCorePoints(ca, cb);
  const d = Math.sqrt(dist2PtPt(p, q));
  if (d === 0) return { x: Math.round(p.x), y: Math.round(p.y) };
  // Move from p towards q past a's radius, then halfway across the remaining gap.
  const gap = Math.max(0, d - ca.r - cb.r);
  const t = Math.min(1, (ca.r + gap / 2) / d);
  return { x: Math.round(p.x + (q.x - p.x) * t), y: Math.round(p.y + (q.y - p.y) * t) };
}

// ---- DR-11: copper stays on the board (ruling Q-I3b-43) ---------------------------------------

/** The two segments cross at a single point interior to both (touching and collinear overlap excluded). */
function properCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  return orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
}

/**
 * Does the interior of `s` meet the zero-width edge a–b? Rounded core: `dist²(core, edge) < r²`;
 * sharp core: a proper crossing of a core edge, or an edge endpoint strictly inside a polygon
 * core. Touching is never a crossing.
 */
export function crossesEdge(s: Shape, a: Pt, b: Pt): boolean {
  if (s.kind === "pieces") return s.parts.some((p) => crossesEdge(p, a, b));
  const core = coreOf(s);
  const pts = core.pts;
  if (pts.length === 0) return false;
  const degenerate = a.x === b.x && a.y === b.y;
  if (core.r > 0) return dist2Pts(pts, degenerate ? [a] : [a, b]) < core.r * core.r;
  if (pts.length < 2) return false;
  if (pts.length === 2) return !degenerate && properCross(pts[0]!, pts[1]!, a, b);
  if (!degenerate) for (let i = 0; i < pts.length; i++) if (properCross(pts[i]!, pts[(i + 1) % pts.length]!, a, b)) return true;
  return pointInConvex(pts, a) === "inside" || pointInConvex(pts, b) === "inside";
}

/**
 * Given that no Rim edge crosses the copper's interior: is every shape inside the outline and
 * outside every cut-out? One core point per rounded part decides; every core point of a sharp
 * part is probed. Rings with fewer than three vertices constrain nothing.
 */
export function withinRim(rim: Rim, shapes: readonly Shape[]): boolean {
  const outline = rim.outline.length >= 3 ? rim.outline : undefined;
  const cutouts = rim.cutouts.filter((c) => c.length >= 3);
  if (!outline && cutouts.length === 0) return true;
  const parts: Convex[] = [];
  for (const s of shapes) { if (s.kind === "pieces") parts.push(...s.parts); else parts.push(s); }
  for (const part of parts) {
    const core = coreOf(part);
    const probes = core.r > 0 ? core.pts.slice(0, 1) : core.pts;
    for (const p of probes) {
      if (outline && pointInRing(outline, p) === "outside") return false;
      for (const c of cutouts) if (pointInRing(c, p) === "inside") return false;
    }
  }
  return true;
}
