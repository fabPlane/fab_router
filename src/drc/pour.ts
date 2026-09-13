/**
 * Pour copper: does a shape touch the filled area of a Pour (outline minus holes)?
 * spec/rules/connectivity.md K-03 (the pour ruling: a Pour connects every same-net item whose
 * copper overlaps or touches its filled area) and K-04 (plane Sheets).
 *
 * The Lattice indexes a Pour by its outline only (holes not subtracted, since Pours are never
 * obstacles), so connectivity needs the true region. The test for one convex shape S (core + r):
 *   1. if any outline edge is within r of the core, S touches the Pour's boundary → touches;
 *   2. otherwise S lies wholly inside or wholly outside the outline; a core point decides
 *      (exact `pointInRing`); outside → no contact;
 *   3. inside: a hole edge within r → touches the hole's rim (Pour copper); a core point inside
 *      a hole with no edge contact → S lies wholly in the hole → no contact; else S is in copper.
 * Edge tests are prefiltered by the shape's box. Two Pours touch when an edge of one touches the
 * other's filled area or one lies wholly inside the other's copper.
 *
 * Public surface: PourRegion, pourRegion, shapeTouchesPour, poursTouch.
 */
import type { Pour, Pt } from "../../spec/types/layout.ts";
import type { Box, Shape } from "../geom/index.ts";
import { boxOf, boxOfPts, coreOf, dist2PtSeg, dist2SegSeg, dist2Pts, pointInRing } from "../geom/index.ts";

export interface PourRegion {
  outline: readonly Pt[];
  holes: readonly (readonly Pt[])[];
  box: Box;
  holeBoxes: Box[];
}

export function pourRegion(p: Pour): PourRegion {
  return { outline: p.outline, holes: p.holes, box: boxOfPts(p.outline), holeBoxes: p.holes.map((h) => boxOfPts(h)) };
}

/** Squared distance from a convex core (1, 2 or ≥ 3 points) to the segment a–b. */
function dist2CoreSeg(pts: readonly Pt[], a: Pt, b: Pt): number {
  if (pts.length === 1) return dist2PtSeg(pts[0]!, a, b);
  if (pts.length === 2) return dist2SegSeg(pts[0]!, pts[1]!, a, b);
  return dist2Pts([a, b], pts);
}

/** True when some edge of `ring` lies within `r` of the core. */
function ringEdgeWithin(ring: readonly Pt[], ringBox: Box, pts: readonly Pt[], r: number, box: Box): boolean {
  if (ring.length < 2) return false;
  if (box.x0 > ringBox.x1 || ringBox.x0 > box.x1 || box.y0 > ringBox.y1 || ringBox.y0 > box.y1) return false;
  const r2 = r * r;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i]!, b = ring[(i + 1) % n]!;
    // Edge box against the shape box (the shape box already includes r).
    if (Math.max(a.x, b.x) < box.x0 || Math.min(a.x, b.x) > box.x1 || Math.max(a.y, b.y) < box.y0 || Math.min(a.y, b.y) > box.y1) continue;
    if (dist2CoreSeg(pts, a, b) <= r2) return true;
  }
  return false;
}

function convexTouchesPour(s: Exclude<Shape, { kind: "pieces" }>, region: PourRegion): boolean {
  const core = coreOf(s);
  if (core.pts.length === 0 || region.outline.length < 3) return false;
  const box = boxOf(s);
  if (box.x0 > region.box.x1 || region.box.x0 > box.x1 || box.y0 > region.box.y1 || region.box.y0 > box.y1) return false;
  if (ringEdgeWithin(region.outline, region.box, core.pts, core.r, box)) return true;
  const p = core.pts[0]!;
  if (pointInRing(region.outline, p) === "outside") return false;
  for (let i = 0; i < region.holes.length; i++) {
    const hole = region.holes[i]!;
    if (hole.length < 3) continue;
    if (ringEdgeWithin(hole, region.holeBoxes[i]!, core.pts, core.r, box)) return true;
    if (pointInRing(hole, p) === "inside") return false;
  }
  return true;
}

/** Does the copper `shape` overlap or touch the Pour's filled area? */
export function shapeTouchesPour(shape: Shape, region: PourRegion): boolean {
  if (shape.kind === "pieces") return shape.parts.some((p) => convexTouchesPour(p, region));
  return convexTouchesPour(shape, region);
}

/** Do the filled areas of two Pours overlap or touch? */
export function poursTouch(a: PourRegion, b: PourRegion): boolean {
  if (a.box.x0 > b.box.x1 || b.box.x0 > a.box.x1 || a.box.y0 > b.box.y1 || b.box.y0 > a.box.y1) return false;
  const rings = [a.outline, ...a.holes];
  for (const ring of rings) {
    const n = ring.length;
    if (n < 2) continue;
    for (let i = 0; i < n; i++) {
      const p = ring[i]!, q = ring[(i + 1) % n]!;
      if (convexTouchesPour({ kind: "capsule", a: p, b: q, r: 0 }, b)) return true;
    }
  }
  // No edge of a touches b: either disjoint, or b lies wholly inside a's copper.
  if (b.outline.length > 0 && convexTouchesPour({ kind: "disk", c: b.outline[0]!, r: 0 }, a)) return true;
  return false;
}
