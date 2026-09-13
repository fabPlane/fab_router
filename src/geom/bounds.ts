/**
 * Boxes, 8-DOPs and shape expansion.
 *
 * Literature: Klosowski, Held, Mitchell, Sowizral, Zikan (1998), "Efficient collision detection
 * using bounding volume hierarchies of k-DOPs" — the 8-DOP bounds a shape in the four directions
 * x, y, x+y, x−y and is a tighter conservative filter than a box for the 45° legs a router draws.
 *
 * Expansion (Minkowski sum) comes in two flavours (docs/DESIGN.md §1):
 *   "dop8"   — sum with a regular octagon circumscribed about the disk of radius r (apothem r,
 *              vertex radius r / cos 22.5°). It *contains* the Euclidean expansion, so the router
 *              can use it as a conservative obstacle; the result is an integer convex hull.
 *   "euclid" — the exact rounded shape (core plus radius) for DRC.
 * Every rounding in this module is outward.
 *
 * Public surface: boxOfPts, boxUnion, boxIntersects, boxContains, boxExpand, dop8OfPts, dop8Of,
 * dop8Intersects, dop8Expand, dop8ToHull, boxOf, octagon, expand.
 */
import type { Box, ConvexShape, Dop8, Hull, Pt, Shape } from "./types.ts";
import { coreOf } from "./distance.ts";
import { hullOf } from "./hull.ts";

const SQRT2 = Math.SQRT2;
const TAN_22_5 = Math.SQRT2 - 1;

export function boxOfPts(pts: readonly Pt[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

export function boxUnion(a: Box, b: Box): Box {
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

/** Closed-interval overlap test (touching boxes intersect). */
export function boxIntersects(a: Box, b: Box): boolean {
  return a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
}

export function boxContains(b: Box, p: Pt): boolean {
  return b.x0 <= p.x && p.x <= b.x1 && b.y0 <= p.y && p.y <= b.y1;
}

/** Grow a box by `r` on every side (r is rounded up to an integer). */
export function boxExpand(b: Box, r: number): Box {
  const e = Math.ceil(r);
  return { x0: b.x0 - e, y0: b.y0 - e, x1: b.x1 + e, y1: b.y1 + e };
}

/** 8-DOP of a point set expanded by radius r (outward rounding; s/d slabs grow by ⌈r·√2⌉). */
export function dop8OfPts(pts: readonly Pt[], r = 0): Dop8 {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  let s0 = Infinity, s1 = -Infinity, d0 = Infinity, d1 = -Infinity;
  for (const p of pts) {
    const s = p.x + p.y, d = p.x - p.y;
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
    if (s < s0) s0 = s; if (s > s1) s1 = s;
    if (d < d0) d0 = d; if (d > d1) d1 = d;
  }
  if (r === 0) return { x0, y0, x1, y1, s0, s1, d0, d1 };
  const e = Math.ceil(r), es = Math.ceil(r * SQRT2);
  return { x0: x0 - e, y0: y0 - e, x1: x1 + e, y1: y1 + e, s0: s0 - es, s1: s1 + es, d0: d0 - es, d1: d1 + es };
}

/** 8-DOP of any shape (radius included). */
export function dop8Of(s: Shape): Dop8 {
  if (s.kind === "pieces") {
    let acc: Dop8 | undefined;
    for (const part of s.parts) {
      const d = dop8Of(part);
      acc = acc ? dop8Union(acc, d) : d;
    }
    return acc ?? dop8OfPts([]);
  }
  const c = coreOf(s);
  return dop8OfPts(c.pts, c.r);
}

export function dop8Union(a: Dop8, b: Dop8): Dop8 {
  return {
    x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
    s0: Math.min(a.s0, b.s0), s1: Math.max(a.s1, b.s1), d0: Math.min(a.d0, b.d0), d1: Math.max(a.d1, b.d1),
  };
}

export function dop8Intersects(a: Dop8, b: Dop8): boolean {
  return a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1 &&
    a.s0 <= b.s1 && b.s0 <= a.s1 && a.d0 <= b.d1 && b.d0 <= a.d1;
}

export function dop8Expand(d: Dop8, r: number): Dop8 {
  const e = Math.ceil(r), es = Math.ceil(r * SQRT2);
  return { x0: d.x0 - e, y0: d.y0 - e, x1: d.x1 + e, y1: d.y1 + e, s0: d.s0 - es, s1: d.s1 + es, d0: d.d0 - es, d1: d.d1 + es };
}

/** The (up to 8-vertex) convex polygon bounded by an 8-DOP's slabs; integer because slab bounds are. */
export function dop8ToHull(d: Dop8): Hull {
  // Candidate corners: box corners clipped by the diagonal slabs, plus diagonal-slab/box crossings.
  const cand: Pt[] = [];
  const push = (x: number, y: number) => {
    const s = x + y, dd = x - y;
    if (!(x >= d.x0 && x <= d.x1 && y >= d.y0 && y <= d.y1 && s >= d.s0 && s <= d.s1 && dd >= d.d0 && dd <= d.d1)) return;
    if (Number.isInteger(x)) { cand.push({ x, y }); return; }
    // A half-integer s×d corner (possible after expansion): bracket it along its s-line, outward.
    const xf = Math.floor(x), xc = Math.ceil(x);
    cand.push({ x: xf, y: s - xf }, { x: xc, y: s - xc });
  };
  for (const x of [d.x0, d.x1]) {
    for (const y of [d.y0, d.y1]) push(x, y);
    for (const s of [d.s0, d.s1]) push(x, s - x);
    for (const dd of [d.d0, d.d1]) push(x, x - dd);
  }
  for (const y of [d.y0, d.y1]) {
    for (const s of [d.s0, d.s1]) push(s - y, y);
    for (const dd of [d.d0, d.d1]) push(y + dd, y);
  }
  for (const s of [d.s0, d.s1]) for (const dd of [d.d0, d.d1]) push((s + dd) / 2, (s - dd) / 2);
  return { kind: "hull", pts: hullOf(cand) };
}

/** Axis-aligned bounds of any shape (radius included, outward rounding). */
export function boxOf(s: Shape): Box {
  const d = dop8Of(s);
  return { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 };
}

/**
 * Integer octagon circumscribed about the disk of radius r: vertices (±r, ±t) and (±t, ±r) with
 * t = ⌈r · tan 22.5°⌉, so every edge is at distance ≥ r from the centre.
 */
export function octagon(r: number): Pt[] {
  const R = Math.ceil(r);
  const t = Math.ceil(r * TAN_22_5);
  if (R === 0) return [{ x: 0, y: 0 }];
  if (t >= R) return [{ x: R, y: -R }, { x: R, y: R }, { x: -R, y: R }, { x: -R, y: -R }]; // tiny r: a square
  return [
    { x: R, y: -t }, { x: R, y: t }, { x: t, y: R }, { x: -t, y: R },
    { x: -R, y: t }, { x: -R, y: -t }, { x: -t, y: -R }, { x: t, y: -R },
  ];
}

/**
 * Minkowski expansion by r. "dop8": a convex integer Hull containing every point within r of the
 * shape (sum with the circumscribed octagon); "euclid": the exact rounded shape. `pieces` are
 * expanded part by part.
 */
export function expand(s: Shape, r: number, mode: "dop8" | "euclid"): Shape {
  if (s.kind === "pieces") return { kind: "pieces", parts: s.parts.map((p) => expand(p, r, mode) as ConvexShape) };
  return expandConvex(s, r, mode);
}

function expandConvex(s: ConvexShape, r: number, mode: "dop8" | "euclid"): ConvexShape {
  const c = coreOf(s);
  if (mode === "euclid") {
    const rr = c.r + r;
    if (c.pts.length === 1) return { kind: "disk", c: c.pts[0]!, r: rr };
    if (c.pts.length === 2) return { kind: "capsule", a: c.pts[0]!, b: c.pts[1]!, r: rr };
    return rr === 0 ? { kind: "hull", pts: c.pts } : { kind: "rounded", pts: c.pts, r: rr };
  }
  const oct = octagon(c.r + r);
  const sum: Pt[] = [];
  for (const p of c.pts) for (const o of oct) sum.push({ x: p.x + o.x, y: p.y + o.y });
  return { kind: "hull", pts: hullOf(sum) };
}
