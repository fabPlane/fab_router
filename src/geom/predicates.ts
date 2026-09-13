/**
 * Exact integer predicates.
 *
 * Literature: Shewchuk (1997), "Adaptive precision floating-point arithmetic and fast robust
 * geometric predicates" — the reason decisions must be exact. Here exactness comes from the
 * coordinate bound instead of adaptive arithmetic: with |coord| ≤ 2^25 every difference is
 * ≤ 2^26, every product of two differences ≤ 2^52, and a sum or difference of two such products
 * ≤ 2^53 — all exactly representable in float64, so `orient`, `dot` and `dist2` never round.
 *
 * Public surface: cross, dot, orient, side, onSeg, segsIntersect, pointInConvex, pointInRing.
 */
import type { Pt } from "./types.ts";

export type Sign = -1 | 0 | 1;
export type Containment = "inside" | "outside" | "boundary";

/** (b − a) × (c − a): twice the signed area of the triangle abc. Exact. */
export function cross(a: Pt, b: Pt, c: Pt): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** (b − a) · (c − a). Exact. */
export function dot(a: Pt, b: Pt, c: Pt): number {
  return (b.x - a.x) * (c.x - a.x) + (b.y - a.y) * (c.y - a.y);
}

/** Squared distance between two points. Exact. */
export function dist2PtPt(a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  return dx * dx + dy * dy;
}

/** +1 when c is left of the directed line a→b (counter-clockwise turn), −1 right, 0 collinear. */
export function orient(a: Pt, b: Pt, c: Pt): Sign {
  const v = cross(a, b, c);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** Same sign convention as `orient`, but returns the signed doubled area itself (exact). */
export function side(a: Pt, b: Pt, p: Pt): number {
  return cross(a, b, p);
}

/** True when p lies on the closed segment a–b (a may equal b). */
export function onSeg(p: Pt, a: Pt, b: Pt): boolean {
  if (cross(a, b, p) !== 0) return false;
  return Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y);
}

/**
 * True when the closed segments p1–p2 and q1–q2 share at least one point: a proper crossing, an
 * endpoint touching the other segment anywhere, or a collinear overlap.
 */
export function segsIntersect(p1: Pt, p2: Pt, q1: Pt, q2: Pt): boolean {
  const o1 = orient(p1, p2, q1), o2 = orient(p1, p2, q2);
  const o3 = orient(q1, q2, p1), o4 = orient(q1, q2, p2);
  if (o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) return true; // proper
  if (o1 === 0 && onSeg(q1, p1, p2)) return true;
  if (o2 === 0 && onSeg(q2, p1, p2)) return true;
  if (o3 === 0 && onSeg(p1, q1, q2)) return true;
  if (o4 === 0 && onSeg(p2, q1, q2)) return true;
  return false;
}

/**
 * Containment of p in a convex polygon given counter-clockwise (y up). Degenerate polygons of one
 * or two points are treated as a point / a segment (only "boundary" or "outside").
 */
export function pointInConvex(pts: readonly Pt[], p: Pt): Containment {
  const n = pts.length;
  if (n === 0) return "outside";
  if (n === 1) return pts[0]!.x === p.x && pts[0]!.y === p.y ? "boundary" : "outside";
  if (n === 2) return onSeg(p, pts[0]!, pts[1]!) ? "boundary" : "outside";
  let boundary = false;
  for (let i = 0; i < n; i++) {
    const a = pts[i]!, b = pts[(i + 1) % n]!;
    const o = orient(a, b, p);
    if (o < 0) return "outside";
    if (o === 0) {
      if (onSeg(p, a, b)) boundary = true;
      else return "outside"; // collinear with an edge line but beyond it: outside a convex set
    }
  }
  return boundary ? "boundary" : "inside";
}

/**
 * Containment of p in a simple polygon of either winding (crossing-number test with exact
 * orientation; a ray is cast towards +x and edges are half-open in y to count each crossing once).
 */
export function pointInRing(pts: readonly Pt[], p: Pt): Containment {
  const n = pts.length;
  if (n < 3) return pointInConvex(pts, p);
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = pts[j]!, b = pts[i]!;
    if (onSeg(p, a, b)) return "boundary";
    if ((a.y > p.y) !== (b.y > p.y)) {
      // The edge spans p.y. It crosses the +x ray iff the crossing lies right of p:
      // for an upward edge (b.y > a.y) that is "p left of a→b", for a downward edge the reverse.
      const o = orient(a, b, p);
      if (b.y > a.y ? o > 0 : o < 0) inside = !inside;
    }
  }
  return inside ? "inside" : "outside";
}
