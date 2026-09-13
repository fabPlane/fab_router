/**
 * Convex hull and polygon area.
 *
 * Literature: Andrew (1979), "Another efficient algorithm for convex hulls in two dimensions" —
 * the monotone chain: sort by (x, y), sweep a lower and an upper chain, pop while the turn is not
 * strictly counter-clockwise. Exact because every turn test is `orient`.
 *
 * Public surface: hullOf, area2, isCcw, isConvexCcw.
 */
import type { Pt } from "./types.ts";
import { cross, orient } from "./predicates.ts";

/**
 * Convex hull of a point set (duplicates and collinear runs allowed). Returned counter-clockwise,
 * starting at the vertex with the lowest y (ties: lowest x); points lying strictly between two
 * hull vertices are omitted. Degenerate inputs give 0, 1 or 2 points.
 */
export function hullOf(points: readonly Pt[]): Pt[] {
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const uniq: Pt[] = [];
  for (const p of sorted) {
    const last = uniq[uniq.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) uniq.push({ x: p.x, y: p.y });
  }
  const n = uniq.length;
  if (n <= 2) return rotateToStart(uniq);

  const lower: Pt[] = [];
  for (const p of uniq) {
    while (lower.length >= 2 && orient(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const p = uniq[i]!;
    while (upper.length >= 2 && orient(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return rotateToStart(lower.concat(upper));
}

/** Rotate a CCW ring so it starts at the lowest-y (then lowest-x) vertex. */
function rotateToStart(ring: Pt[]): Pt[] {
  if (ring.length < 2) return ring;
  let k = 0;
  for (let i = 1; i < ring.length; i++) {
    const p = ring[i]!, q = ring[k]!;
    if (p.y < q.y || (p.y === q.y && p.x < q.x)) k = i;
  }
  return k === 0 ? ring : ring.slice(k).concat(ring.slice(0, k));
}

/**
 * Twice the signed area of a polygon (positive when counter-clockwise, y up). Computed as a fan
 * from `pts[0]` so every term is a difference of products of coordinate differences (exact, ≤ 2^53).
 * The running sum is exact whenever the fan's partial polygons stay within the bounding square's
 * area, which holds for every convex polygon and for every polygon whose partial fans do not wind
 * (see README.md).
 */
export function area2(pts: readonly Pt[]): number {
  const n = pts.length;
  if (n < 3) return 0;
  const o = pts[0]!;
  let sum = 0;
  for (let i = 1; i + 1 < n; i++) sum += cross(o, pts[i]!, pts[i + 1]!);
  return sum;
}

export function isCcw(pts: readonly Pt[]): boolean {
  return area2(pts) > 0;
}

/** True when `pts` is a counter-clockwise convex polygon with no reflex or collinear vertex. */
export function isConvexCcw(pts: readonly Pt[]): boolean {
  const n = pts.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    if (orient(pts[i]!, pts[(i + 1) % n]!, pts[(i + 2) % n]!) <= 0) return false;
  }
  return true;
}
