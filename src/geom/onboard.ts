/**
 * `src/geom` — DR-11 "copper stays on the board" predicates (ruling Q-I3b-43, Q-I2-59).
 *
 * The board outline and its cut-outs are treated as zero-width polylines; a piece of copper is on
 * the board when its interior meets no outline or cut-out edge and each of its parts sits inside
 * the outer ring and outside every cut-out. The decision is exact: it composes the orientation
 * predicate (Shewchuk 1997, "Adaptive Precision Floating-Point Arithmetic and Fast Robust
 * Geometric Predicates") for proper segment crossings and point-in-polygon containment
 * (crossing-number rule, e.g. Preparata & Shamis 1985, "Computational Geometry: An Introduction").
 * It lives in `src/geom` so the router's clearance queries (`src/route/clear.ts`) and DRC
 * (`src/drc/exact.ts`) share one copy and can never disagree on a tie.
 *
 * Public surface: outerRings, rimBounds, crossesEdge, withinRim.
 */
import type { Rim } from "../../spec/types/layout.ts";
import type { Box, ConvexShape, Pt, Shape } from "./types.ts";
import { coreOf, dist2Pts } from "./distance.ts";
import { orient, pointInConvex, pointInRing } from "./predicates.ts";

/** All outer rings, with the single-outline fallback for caller-built Layouts. */
export function outerRings(rim: Rim): readonly (readonly Pt[])[] {
  return rim.outers?.length ? rim.outers : [rim.outline];
}

/** Bounding box of every outer ring, or undefined for a missing outline. */
export function rimBounds(rim: Rim): Box | undefined {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const ring of outerRings(rim)) {
    if (ring.length < 2) continue;
    for (const p of ring) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
  }
  return x0 <= x1 && y0 <= y1 ? { x0, y0, x1, y1 } : undefined;
}

/** The two segments cross at a single point interior to both (touching and collinear overlap excluded). */
function properCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  return orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
}

/**
 * Does the interior of `s` meet the zero-width edge a–b? For a rounded core that is
 * `dist²(core, edge) < r²`; for a sharp core (r = 0) a proper crossing of a core edge, or an
 * edge endpoint strictly inside a polygon core. Touching is never a crossing.
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
 * Given that no Rim edge crosses the copper's interior, is every shape inside an outer ring and
 * outside every cut-out? One core point per rounded convex part decides (the part is on one side
 * of every ring); every core point is tested for a sharp part. Rings with fewer than three
 * vertices constrain nothing.
 */
export function withinRim(rim: Rim, shapes: readonly Shape[]): boolean {
  const outlines = outerRings(rim).filter((r) => r.length >= 3);
  const cutouts = rim.cutouts.filter((c) => c.length >= 3);
  if (outlines.length === 0 && cutouts.length === 0) return true;
  const parts: ConvexShape[] = [];
  for (const s of shapes) { if (s.kind === "pieces") parts.push(...s.parts); else parts.push(s); }
  for (const part of parts) {
    const core = coreOf(part);
    const probes = core.r > 0 ? core.pts.slice(0, 1) : core.pts;
    for (const p of probes) {
      if (outlines.length > 0 && !outlines.some((r) => pointInRing(r, p) !== "outside")) return false;
      for (const c of cutouts) if (pointInRing(c, p) === "inside") return false;
    }
  }
  return true;
}
