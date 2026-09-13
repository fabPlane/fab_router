/**
 * Polyline shaping: angle-mode snapping, collinear simplification, bend classification.
 *
 * These are constructions on integer polylines; every emitted vertex is an integer LU point and
 * every test is an exact predicate. `snap45` and `stairs90` are the shaping step of the string
 * pull (docs/DESIGN.md §6, `pull.ts`): they turn an any-angle leg into legs the angle mode allows.
 *
 * Public surface: isOrthogonal, isOctilinear, simplifyCollinear, snap45, stairs90, bendKind,
 * bendAngleDeg, pathLength.
 */
import type { Pt } from "./types.ts";
import { cross, dist2PtPt, dot, onSeg } from "./predicates.ts";

export type BendKind = "straight" | "45" | "90" | "135" | "reverse" | "other";

export function isOrthogonal(a: Pt, b: Pt): boolean {
  return a.x === b.x || a.y === b.y;
}

export function isOctilinear(a: Pt, b: Pt): boolean {
  const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
  return dx === 0 || dy === 0 || dx === dy;
}

/**
 * Drop consecutive duplicate points, then every interior point lying exactly on the segment
 * between its neighbours, repeated until stable. A doubled-back point (collinear but outside the
 * neighbours' span) is kept: it changes the path.
 */
export function simplifyCollinear(pts: readonly Pt[]): Pt[] {
  let out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p);
  }
  let changed = true;
  while (changed && out.length >= 3) {
    changed = false;
    const next: Pt[] = [out[0]!];
    for (let i = 1; i + 1 < out.length; i++) {
      const a = next[next.length - 1]!, b = out[i]!, c = out[i + 1]!;
      if (onSeg(b, a, c)) { changed = true; continue; }
      next.push(b);
    }
    next.push(out[out.length - 1]!);
    out = next;
  }
  return out;
}

/**
 * Make every leg octilinear: a leg (dx, dy) that is neither axis-aligned nor diagonal becomes a
 * diagonal of length min(|dx|,|dy|) followed by the axis-aligned remainder. Deterministic.
 */
export function snap45(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    if (i === 0) { out.push(p); continue; }
    const a = out[out.length - 1]!;
    if (!isOctilinear(a, p)) {
      const dx = p.x - a.x, dy = p.y - a.y;
      const m = Math.min(Math.abs(dx), Math.abs(dy));
      out.push({ x: a.x + Math.sign(dx) * m, y: a.y + Math.sign(dy) * m });
    }
    out.push(p);
  }
  return simplifyCollinear(out);
}

/** Make every leg axis-aligned: a diagonal leg becomes horizontal then vertical. Deterministic. */
export function stairs90(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    if (i === 0) { out.push(p); continue; }
    const a = out[out.length - 1]!;
    if (!isOrthogonal(a, p)) out.push({ x: p.x, y: a.y });
    out.push(p);
  }
  return simplifyCollinear(out);
}

/** Classify the turn at b between legs a→b and b→c using exact integer tests. */
export function bendKind(a: Pt, b: Pt, c: Pt): BendKind {
  // With u = b−a (incoming) and v = c−b (outgoing): d = −(u·v), x = u×v.
  const d = dot(b, c, a);   // (c−b)·(a−b)
  const x = cross(b, c, a); // (c−b)×(a−b)
  if (x === 0) return d <= 0 ? "straight" : "reverse";
  if (d === 0) return "90";
  // |u·v| == |u×v| is a 45° or 135° turn; u·v > 0 (d < 0) is the gentle one.
  if (Math.abs(d) === Math.abs(x)) return d < 0 ? "45" : "135";
  return "other";
}

/** The turning angle at b in degrees (0 = straight on, 180 = reverse), float64. */
export function bendAngleDeg(a: Pt, b: Pt, c: Pt): number {
  const ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y;
  const ang = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  return Math.abs(ang) * (180 / Math.PI);
}

/** Euclidean length of a polyline (float64). */
export function pathLength(pts: readonly Pt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.sqrt(dist2PtPt(pts[i - 1]!, pts[i]!));
  return len;
}
