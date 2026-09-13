/**
 * Squared distances between shapes.
 *
 * One rule covers every pair: a convex shape is a convex core (point / segment / CCW polygon)
 * plus a radius, and dist(A, B) = max(0, dist(coreA, coreB) − rA − rB). Core–core distances are
 * exact integers whenever the nearest points are vertices; only the point–segment interior case
 * (cross² / len²) is a float64 approximation of an exact rational — see `rational.ts` for the
 * exact form and README.md for the error argument. `sqrt` is taken only when a radius is present.
 *
 * Public surface: coreOf, dist2PtSeg, dist2SegSeg, dist2PtPoly, dist2SegPoly, dist2PolyPoly,
 * dist2Core, dist2.
 */
import type { Core, Pt, Shape } from "./types.ts";
import { cross, dist2PtPt, dot, pointInConvex, segsIntersect } from "./predicates.ts";
import { hullOf } from "./hull.ts";

/** Squared distance from p to the closed segment a–b. */
export function dist2PtSeg(p: Pt, a: Pt, b: Pt): number {
  if (a.x === b.x && a.y === b.y) return dist2PtPt(p, a);
  if (dot(a, b, p) <= 0) return dist2PtPt(p, a);
  if (dot(b, a, p) <= 0) return dist2PtPt(p, b);
  const c = cross(a, b, p);
  return (c * c) / dist2PtPt(a, b);
}

/** Squared distance between two closed segments (0 when they touch). */
export function dist2SegSeg(a1: Pt, a2: Pt, b1: Pt, b2: Pt): number {
  if (segsIntersect(a1, a2, b1, b2)) return 0;
  return Math.min(dist2PtSeg(a1, b1, b2), dist2PtSeg(a2, b1, b2), dist2PtSeg(b1, a1, a2), dist2PtSeg(b2, a1, a2));
}

/** Squared distance from p to a CCW convex polygon (0 inside or on the boundary). */
export function dist2PtPoly(p: Pt, poly: readonly Pt[]): number {
  if (pointInConvex(poly, p) !== "outside") return 0;
  let best = Infinity;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const d = dist2PtSeg(p, poly[i]!, poly[(i + 1) % n]!);
    if (d < best) best = d;
  }
  return best;
}

/** Squared distance from the segment a–b to a CCW convex polygon. */
export function dist2SegPoly(a: Pt, b: Pt, poly: readonly Pt[]): number {
  if (pointInConvex(poly, a) !== "outside" || pointInConvex(poly, b) !== "outside") return 0;
  const n = poly.length;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const c = poly[i]!, d = poly[(i + 1) % n]!;
    const v = dist2SegSeg(a, b, c, d);
    if (v === 0) return 0;
    if (v < best) best = v;
  }
  return best;
}

/** Squared distance between two CCW convex polygons (0 when they overlap or touch). */
export function dist2PolyPoly(p: readonly Pt[], q: readonly Pt[]): number {
  if (pointInConvex(q, p[0]!) !== "outside" || pointInConvex(p, q[0]!) !== "outside") return 0;
  const n = p.length, m = q.length;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const a = p[i]!, b = p[(i + 1) % n]!;
    for (let j = 0; j < m; j++) {
      const v = dist2SegSeg(a, b, q[j]!, q[(j + 1) % m]!);
      if (v === 0) return 0;
      if (v < best) best = v;
    }
  }
  return best;
}

/** Squared distance between two convex cores (radius ignored). */
export function dist2Pts(a: readonly Pt[], b: readonly Pt[]): number {
  if (a.length === 0 || b.length === 0) return Infinity;
  if (a.length > b.length) return dist2Pts(b, a);
  // a.length ≤ b.length
  if (a.length === 1) {
    const p = a[0]!;
    if (b.length === 1) return dist2PtPt(p, b[0]!);
    if (b.length === 2) return dist2PtSeg(p, b[0]!, b[1]!);
    return dist2PtPoly(p, b);
  }
  if (a.length === 2) {
    if (b.length === 2) return dist2SegSeg(a[0]!, a[1]!, b[0]!, b[1]!);
    return dist2SegPoly(a[0]!, a[1]!, b);
  }
  return dist2PolyPoly(a, b);
}

/** The convex core + radius view of a convex shape. Boxes become 1, 2 or 4 points. */
export function coreOf(s: Exclude<Shape, { kind: "pieces" }>): Core {
  switch (s.kind) {
    case "disk": return { pts: [s.c], r: s.r };
    case "capsule": return { pts: (s.a.x === s.b.x && s.a.y === s.b.y) ? [s.a] : [s.a, s.b], r: s.r };
    case "hull": return { pts: s.pts, r: 0 };
    case "rounded": return { pts: s.pts, r: s.r };
    case "box": {
      const x0 = Math.min(s.x0, s.x1), x1 = Math.max(s.x0, s.x1);
      const y0 = Math.min(s.y0, s.y1), y1 = Math.max(s.y0, s.y1);
      if (x0 === x1 && y0 === y1) return { pts: [{ x: x0, y: y0 }], r: 0 };
      if (x0 === x1 || y0 === y1) return { pts: [{ x: x0, y: y0 }, { x: x1, y: y1 }], r: 0 };
      return { pts: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], r: 0 };
    }
  }
}

/** Squared distance between two convex cores including their radii. */
export function dist2Core(a: Core, b: Core): number {
  const d2 = dist2Pts(a.pts, b.pts);
  const r = a.r + b.r;
  if (r === 0) return d2;
  if (d2 === 0) return 0;
  const d = Math.sqrt(d2) - r;
  return d <= 0 ? 0 : d * d;
}

/** Squared distance between any two shapes; `pieces` take the minimum over their parts. */
export function dist2(a: Shape, b: Shape): number {
  if (a.kind === "pieces") {
    let best = Infinity;
    for (const part of a.parts) { const v = dist2(part, b); if (v < best) { best = v; if (v === 0) break; } }
    return best;
  }
  if (b.kind === "pieces") return dist2(b, a);
  return dist2Core(coreOf(a), coreOf(b));
}

/** All core points of a shape (for bounds); `pieces` contribute every part's core. */
export function corePoints(s: Shape): Pt[] {
  if (s.kind === "pieces") return s.parts.flatMap((p) => coreOf(p).pts);
  return coreOf(s).pts;
}

/** Convex hull of the core points of a shape (radius ignored). */
export function coreHull(s: Shape): Pt[] {
  return hullOf(corePoints(s));
}
