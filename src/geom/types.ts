/**
 * Geometry kernel — plain data types.
 *
 * Every coordinate is an integer in layout units (LU) with |coord| ≤ MAX_COORD = 2^25. That bound
 * is what makes the predicates in `predicates.ts` exact in float64 (see README.md). Nothing here
 * has methods; every operation is a pure function in a sibling module.
 *
 * Shape vocabulary (docs/DESIGN.md §1): a *convex* shape is a convex core (a point, a segment or a
 * CCW convex polygon) plus a radius; `disk`, `capsule`, `box`, `hull` and `rounded` are the named
 * special cases. `pieces` is a union of convex shapes (the output of `convexPieces`).
 */

/** Largest allowed |coordinate|: 2^25. */
export const MAX_COORD = 33_554_432;

export interface Pt { x: number; y: number }
export interface Seg { a: Pt; b: Pt }
/** Axis-aligned bounds, inclusive on both ends. */
export interface Box { x0: number; y0: number; x1: number; y1: number }
/** 8-DOP: bounds on x, y, s = x + y and d = x − y (Klosowski et al. 1998). */
export interface Dop8 extends Box { s0: number; s1: number; d0: number; d1: number }
/** A simple polygon; `pts` closes back to `pts[0]`. Winding is not implied unless stated. */
export interface Ring { pts: Pt[] }

export type Disk = { kind: "disk"; c: Pt; r: number };
export type BoxShape = { kind: "box" } & Box;
/** Convex polygon, counter-clockwise (y up), no repeated or collinear vertices. */
export type Hull = { kind: "hull"; pts: Pt[] };
/** Stroked segment: every point within `r` of the segment a–b. */
export type Capsule = { kind: "capsule"; a: Pt; b: Pt; r: number };
/** Convex polygon expanded by `r` (Minkowski sum with a disk) — the exact Euclidean expansion. */
export type Rounded = { kind: "rounded"; pts: Pt[]; r: number };
export type ConvexShape = Disk | BoxShape | Hull | Capsule | Rounded;
export type Pieces = { kind: "pieces"; parts: ConvexShape[] };
export type Shape = ConvexShape | Pieces;

/** Uniform view of a convex shape: a convex core of 1, 2 or ≥ 3 CCW points plus a radius. */
export interface Core { pts: Pt[]; r: number }

export const pt = (x: number, y: number): Pt => ({ x, y });
export const ptEq = (a: Pt, b: Pt): boolean => a.x === b.x && a.y === b.y;
