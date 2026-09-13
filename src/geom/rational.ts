/**
 * Exact rational constructions (bigint).
 *
 * The float64 kernel is exact for predicates but only approximate for constructions whose
 * results are rationals (line intersection, perpendicular foot, point–segment distance in the
 * interior case). This module gives the exact reduced fraction for those, carried as bigint.
 * It is deliberately off the router's hot path (docs/DESIGN.md §1: no bigint at runtime in the
 * search); it exists for verification (the behaviour vectors), for the test oracle, and for any
 * final exact check a caller wants to make. Fractions are reduced with a positive denominator.
 *
 * Public surface: Frac, frac, fracToNumber, fracToStrings, lineIntersectExact, footExact,
 * pointSegDist2Exact, area2Exact, orientExact.
 */
import type { Pt } from "./types.ts";

export interface Frac { num: bigint; den: bigint }
export type LineMeet = { x: Frac; y: Frac } | "parallel" | "coincident";

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) { const t = a % b; a = b; b = t; }
  return a;
}

/** Build a reduced fraction with a positive denominator. `den` must be non-zero. */
export function frac(num: bigint, den: bigint): Frac {
  if (den === 0n) throw new RangeError("zero denominator");
  if (den < 0n) { num = -num; den = -den; }
  const g = gcd(num, den);
  return g > 1n ? { num: num / g, den: den / g } : { num, den };
}

export function fracToNumber(f: Frac): number {
  return Number(f.num) / Number(f.den);
}

export function fracToStrings(f: Frac): [string, string] {
  return [f.num.toString(), f.den.toString()];
}

const B = (n: number): bigint => BigInt(n);

/** Exact sign of (b − a) × (c − a). */
export function orientExact(a: Pt, b: Pt, c: Pt): -1 | 0 | 1 {
  const v = (B(b.x) - B(a.x)) * (B(c.y) - B(a.y)) - (B(b.y) - B(a.y)) * (B(c.x) - B(a.x));
  return v > 0n ? 1 : v < 0n ? -1 : 0;
}

/** Intersection of the infinite lines through p1,p2 and q1,q2 (each pair distinct). */
export function lineIntersectExact(p1: Pt, p2: Pt, q1: Pt, q2: Pt): LineMeet {
  const dx1 = B(p2.x) - B(p1.x), dy1 = B(p2.y) - B(p1.y);
  const dx2 = B(q2.x) - B(q1.x), dy2 = B(q2.y) - B(q1.y);
  const denom = dx1 * dy2 - dy1 * dx2;
  const ex = B(q1.x) - B(p1.x), ey = B(q1.y) - B(p1.y);
  if (denom === 0n) return (dx1 * ey - dy1 * ex) === 0n ? "coincident" : "parallel";
  const t = ex * dy2 - ey * dx2; // parameter along p, scaled by denom
  return {
    x: frac(B(p1.x) * denom + t * dx1, denom),
    y: frac(B(p1.y) * denom + t * dy1, denom),
  };
}

/** Foot of the perpendicular from p onto the infinite line through a ≠ b. */
export function footExact(p: Pt, a: Pt, b: Pt): { x: Frac; y: Frac } {
  const dx = B(b.x) - B(a.x), dy = B(b.y) - B(a.y);
  const len2 = dx * dx + dy * dy;
  const t = (B(p.x) - B(a.x)) * dx + (B(p.y) - B(a.y)) * dy;
  return { x: frac(B(a.x) * len2 + t * dx, len2), y: frac(B(a.y) * len2 + t * dy, len2) };
}

/** Exact squared distance from p to the closed segment a–b. */
export function pointSegDist2Exact(p: Pt, a: Pt, b: Pt): Frac {
  const dx = B(b.x) - B(a.x), dy = B(b.y) - B(a.y);
  const len2 = dx * dx + dy * dy;
  const px = B(p.x) - B(a.x), py = B(p.y) - B(a.y);
  const t = px * dx + py * dy;
  if (len2 === 0n || t <= 0n) return frac(px * px + py * py, 1n);
  if (t >= len2) { const qx = B(p.x) - B(b.x), qy = B(p.y) - B(b.y); return frac(qx * qx + qy * qy, 1n); }
  const c = dx * py - dy * px;
  return frac(c * c, len2);
}

/** Twice the signed area of a polygon, exactly. */
export function area2Exact(pts: readonly Pt[]): bigint {
  let sum = 0n;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i]!, b = pts[(i + 1) % n]!;
    sum += B(a.x) * B(b.y) - B(b.x) * B(a.y);
  }
  return sum;
}
