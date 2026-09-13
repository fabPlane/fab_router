/**
 * Unit and property tests for the constructive parts of src/geom: convex decomposition, bounds
 * and expansion, distances between shapes, path shaping and bend classification.
 */
import { describe, expect, test } from "bun:test";
import {
  area2, bendKind, boxOf, cleanRing, convexPieces, coreOf, dist2, dist2PtPt, dop8Intersects, dop8Of, dop8ToHull, expand,
  hullOf, isConvexCcw, isOctilinear, isOrthogonal, octagon, pointInConvex, pointInRing, simplifyCollinear, snap45,
  stairs90, type Pt, type Shape,
} from "../src/geom/index.ts";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(42);
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

/** A random simple star-shaped polygon around the origin (sorted by angle, random radius). */
function starPolygon(n: number, rMax = 100000): Pt[] {
  // Equally spaced sectors with jitter below half a sector keep the origin in the kernel, so the
  // polygon is simple (consecutive sectors never exceed 180°).
  const angles: number[] = [];
  const gap = (2 * Math.PI) / n;
  for (let i = 0; i < n; i++) angles.push(i * gap + (rnd() - 0.5) * gap * 0.9);
  const pts: Pt[] = [];
  for (const a of angles) {
    const r = int(Math.floor(rMax / 10), rMax);
    pts.push({ x: Math.round(r * Math.cos(a)), y: Math.round(r * Math.sin(a)) });
  }
  return cleanRing(pts);
}

describe("convexPieces", () => {
  test("a convex ring is returned whole; a concave one is split into convex CCW pieces of equal total area", () => {
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(convexPieces(square)).toEqual([{ kind: "hull", pts: square }]);
    // clockwise input is re-oriented
    expect(convexPieces(square.slice().reverse())[0]!.pts).toEqual(square);

    const lShape = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 20 }, { x: 0, y: 20 }];
    const pieces = convexPieces(lShape);
    expect(pieces.length).toBe(2);
    for (const p of pieces) expect(isConvexCcw(p.pts)).toBe(true);
    expect(pieces.reduce((s, p) => s + area2(p.pts), 0)).toBe(area2(lShape));
  });

  test("random star polygons: pieces are convex, cover the same area, and lie inside the ring", () => {
    for (let i = 0; i < 200; i++) {
      const ring = starPolygon(int(4, 40));
      if (ring.length < 3) continue;
      const pieces = convexPieces(ring);
      expect(pieces.length).toBeGreaterThan(0);
      let total = 0;
      for (const p of pieces) {
        expect(isConvexCcw(p.pts)).toBe(true);
        total += area2(p.pts);
        // the piece's vertices are ring vertices, hence on the boundary
        for (const v of p.pts) expect(pointInRing(ring, v)).toBe("boundary");
      }
      expect(total).toBe(area2(ring));
    }
  });

  test("cleanRing drops duplicates, collinear points and the closing vertex", () => {
    const ring = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }];
    expect(cleanRing(ring)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
  });
});

describe("bounds and expansion", () => {
  test("octagon(r) contains the disk of radius r and is integer", () => {
    for (const r of [1, 2, 3, 7, 100, 12345]) {
      const oct = octagon(r);
      expect(oct.length).toBeGreaterThanOrEqual(4);
      expect(oct.length).toBeLessThanOrEqual(8);
      expect(isConvexCcw(oct)).toBe(true);
      // every edge line is at distance ≥ r from the origin: cross(a,b,o)/|ab| ≥ r
      for (let i = 0; i < oct.length; i++) {
        const a = oct[i]!, b = oct[(i + 1) % oct.length]!;
        const twiceArea = (b.x - a.x) * (0 - a.y) - (b.y - a.y) * (0 - a.x);
        const len2 = dist2PtPt(a, b);
        expect(twiceArea * twiceArea >= r * r * len2).toBe(true);
      }
    }
  });

  test("dop8 expansion contains the euclidean expansion; dop8Of bounds both", () => {
    for (let i = 0; i < 300; i++) {
      const shape: Shape = i % 3 === 0
        ? { kind: "disk", c: { x: int(-1000, 1000), y: int(-1000, 1000) }, r: int(0, 50) }
        : i % 3 === 1
          ? { kind: "capsule", a: { x: int(-1000, 1000), y: int(-1000, 1000) }, b: { x: int(-1000, 1000), y: int(-1000, 1000) }, r: int(0, 50) }
          : { kind: "hull", pts: hullOf([0, 1, 2, 3, 4].map(() => ({ x: int(-1000, 1000), y: int(-1000, 1000) }))) };
      if (shape.kind === "hull" && shape.pts.length < 3) continue;
      const r = int(1, 40);
      const oct = expand(shape, r, "dop8");
      const eu = expand(shape, r, "euclid");
      expect(oct.kind).toBe("hull");
      const octPts = (oct as { kind: "hull"; pts: Pt[] }).pts;
      // Sample points on the boundary of the euclidean expansion: core points pushed by r in 16 directions.
      const core = coreOf(shape as Exclude<Shape, { kind: "pieces" }>);
      for (const p of core.pts) {
        for (let k = 0; k < 16; k++) {
          const ang = (k / 16) * 2 * Math.PI;
          const q = { x: Math.round(p.x + (core.r + r) * Math.cos(ang)), y: Math.round(p.y + (core.r + r) * Math.sin(ang)) };
          // q is within ~0.71 LU of the boundary; the octagon has slack ≥ r·(1/cos22.5°−1) ≈ 0.08r
          // so only assert containment for points pulled 1 LU inward.
          const inward = { x: Math.round(p.x + (core.r + r - 1) * Math.cos(ang)), y: Math.round(p.y + (core.r + r - 1) * Math.sin(ang)) };
          expect(pointInConvex(octPts, inward)).not.toBe("outside");
          expect(dist2(eu, { kind: "disk", c: q, r: 0 })).toBeLessThanOrEqual(1);
        }
      }
      const d = dop8Of(eu);
      const dh = dop8ToHull(d);
      for (const p of octPts) {
        // the dop8 hull of the euclidean expansion must contain the euclidean shape's dop8 corners loosely
        expect(dop8Intersects(d, dop8Of({ kind: "disk", c: p, r: 0 }))).toBe(true);
      }
      expect(isConvexCcw(dh.pts) || dh.pts.length < 3).toBe(true);
      const b = boxOf(eu);
      expect(b.x1 - b.x0).toBeGreaterThanOrEqual(2 * r);
    }
  });
});

describe("dist2 over shapes", () => {
  test("disk–disk, disk–box, capsule–hull, pieces", () => {
    const d1: Shape = { kind: "disk", c: { x: 0, y: 0 }, r: 10 };
    const d2: Shape = { kind: "disk", c: { x: 100, y: 0 }, r: 20 };
    expect(dist2(d1, d2)).toBe(70 * 70);
    expect(dist2(d1, { kind: "disk", c: { x: 25, y: 0 }, r: 20 })).toBe(0);
    const box: Shape = { kind: "box", x0: 50, y0: -5, x1: 60, y1: 5 };
    expect(dist2(d1, box)).toBe(40 * 40);
    expect(dist2(box, d1)).toBe(40 * 40);
    const cap: Shape = { kind: "capsule", a: { x: 0, y: 30 }, b: { x: 100, y: 30 }, r: 5 };
    const hull: Shape = { kind: "hull", pts: [{ x: 50, y: 0 }, { x: 70, y: -20 }, { x: 70, y: 20 }] };
    expect(dist2(cap, hull)).toBe(5 * 5);
    expect(dist2(hull, cap)).toBe(5 * 5);
    const pieces: Shape = { kind: "pieces", parts: [box, hull] };
    expect(dist2(pieces, d1)).toBe(40 * 40);
    expect(dist2(d1, pieces)).toBe(40 * 40);
    // touching counts as zero distance
    expect(dist2({ kind: "box", x0: 0, y0: 0, x1: 10, y1: 10 }, { kind: "box", x0: 10, y0: 5, x1: 20, y1: 15 })).toBe(0);
    // containment is zero distance
    expect(dist2({ kind: "box", x0: 0, y0: 0, x1: 100, y1: 100 }, { kind: "hull", pts: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 15, y: 20 }] })).toBe(0);
  });
});

describe("path shaping", () => {
  test("simplifyCollinear removes on-segment interior points and duplicates but keeps a double-back", () => {
    expect(simplifyCollinear([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]))
      .toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect(simplifyCollinear([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }]))
      .toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }]);
  });

  test("snap45 yields octilinear legs, stairs90 orthogonal legs; endpoints preserved", () => {
    for (let i = 0; i < 200; i++) {
      const pts: Pt[] = [];
      for (let k = 0; k < int(2, 8); k++) pts.push({ x: int(-500, 500), y: int(-500, 500) });
      const s45 = snap45(pts), s90 = stairs90(pts);
      expect(s45[0]).toEqual(pts[0]!);
      expect(s45[s45.length - 1]).toEqual(pts[pts.length - 1]!);
      expect(s90[0]).toEqual(pts[0]!);
      expect(s90[s90.length - 1]).toEqual(pts[pts.length - 1]!);
      for (let k = 1; k < s45.length; k++) expect(isOctilinear(s45[k - 1]!, s45[k]!)).toBe(true);
      for (let k = 1; k < s90.length; k++) expect(isOrthogonal(s90[k - 1]!, s90[k]!)).toBe(true);
    }
  });

  test("bendKind classifies turns exactly", () => {
    const o = { x: 0, y: 0 };
    expect(bendKind({ x: -10, y: 0 }, o, { x: 10, y: 0 })).toBe("straight");
    expect(bendKind({ x: -10, y: 0 }, o, { x: -5, y: 0 })).toBe("reverse");
    expect(bendKind({ x: -10, y: 0 }, o, { x: 0, y: 10 })).toBe("90");
    expect(bendKind({ x: -10, y: 0 }, o, { x: 10, y: 10 })).toBe("45");
    expect(bendKind({ x: -10, y: 0 }, o, { x: -10, y: 10 })).toBe("135");
    expect(bendKind({ x: -10, y: 0 }, o, { x: 10, y: 3 })).toBe("other");
  });
});
