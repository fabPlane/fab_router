/**
 * Shape construction for the Layout: DocShape (file units) → ShapeOnSheet (integer LU), the
 * rigid transform of pad placement (spec/formats/dsn.md §11: mirror, rotate, translate; F-116
 * exact for multiples of 90°), polyline_path corners (F-54, exact rational intersection then
 * rounding), ring cleaning (F-52: closing vertex and consecutive duplicates dropped) and the
 * degeneracy tests of F-52 / F-53 / F-96.
 *
 * Public surface: shapeToLu, transformShape, transformPt, cleanRing, simplifyRing, ringOf, isDegenerate,
 * shapeBox, polylineCorners, padShapes.
 */
import type { Box, Frame, Pad, PadForm, Pt, ShapeOnSheet } from "../../spec/types/layout.ts";
import type { DocShape } from "../../spec/types/dsn.ts";
import { area2, lineIntersectExact, fracToNumber, onSeg } from "../geom/index.ts";
import { halfWidthLu, toLu } from "./units.ts";

/** F-52: drop a repeated closing vertex and consecutive duplicates. */
export function cleanRing(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    out.push(p);
  }
  while (out.length > 1 && out[0]!.x === out[out.length - 1]!.x && out[0]!.y === out[out.length - 1]!.y) out.pop();
  return out;
}

/** Drop every vertex that lies exactly on the segment between its cyclic neighbours. */
export function simplifyRing(pts: readonly Pt[]): Pt[] {
  const out = cleanRing(pts);
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 3; i++) {
      const a = out[(i + out.length - 1) % out.length]!, b = out[i]!, c = out[(i + 1) % out.length]!;
      if (onSeg(b, a, c)) { out.splice(i, 1); changed = true; i--; }
    }
  }
  return out;
}

/** A CCW ring from vertices (reversed when the file wrote it clockwise). */
export function ringOf(pts: readonly Pt[]): Pt[] {
  const r = cleanRing(pts);
  if (r.length >= 3 && area2(r) < 0) r.reverse();
  return r;
}

function ptsOf(frame: Frame, nums: readonly number[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push({ x: toLu(frame, nums[i]!), y: toLu(frame, nums[i + 1]!) });
  return out;
}

/** F-54: corners of a polyline_path from its 2k vertices (LU), k − 1 corners. */
export function polylineCorners(v: readonly Pt[]): Pt[] {
  const lines: Array<[Pt, Pt]> = [];
  for (let i = 0; i + 1 < v.length; i += 2) lines.push([v[i]!, v[i + 1]!]);
  const out: Pt[] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    const [p1, p2] = lines[i]!;
    const [q1, q2] = lines[i + 1]!;
    const degenerateP = p1.x === p2.x && p1.y === p2.y;
    const degenerateQ = q1.x === q2.x && q1.y === q2.y;
    if (degenerateP || degenerateQ) { out.push(q1); continue; }
    const m = lineIntersectExact(p1, p2, q1, q2);
    if (typeof m === "string") { out.push(q1); continue; }
    out.push({ x: Math.round(fracToNumber(m.x)), y: Math.round(fracToNumber(m.y)) });
  }
  return out;
}

/**
 * Convert a document shape to LU. `polygon` becomes a ring (interior only, F-52), `path` a
 * stroked path (a single vertex is a disk, F-53), `rect` a box, `circle` a disk. Returns
 * undefined for a qarc.
 */
export function shapeToLu(frame: Frame, s: DocShape): ShapeOnSheet | undefined {
  switch (s.kind) {
    case "rect": {
      const x0 = toLu(frame, Math.min(s.x1, s.x2)), x1 = toLu(frame, Math.max(s.x1, s.x2));
      const y0 = toLu(frame, Math.min(s.y1, s.y2)), y1 = toLu(frame, Math.max(s.y1, s.y2));
      return { kind: "box", box: { x0, y0, x1, y1 } };
    }
    case "circle":
      return { kind: "disk", c: { x: toLu(frame, s.cx), y: toLu(frame, s.cy) }, r: halfWidthLu(frame, s.diameter) };
    case "polygon": {
      const ring = ringOf(ptsOf(frame, s.pts));
      // A polygon with an aperture but fewer than three distinct vertices is its stroked outline
      // (EasyEDA writes two-vertex polygons with a small aperture as line pads).
      if (ring.length < 3 && s.aperture > 0) {
        const pts = collapse(ptsOf(frame, s.pts));
        const hw = halfWidthLu(frame, s.aperture);
        if (pts.length === 1) return { kind: "disk", c: pts[0]!, r: hw };
        return { kind: "path", pts, halfWidth: hw };
      }
      return { kind: "ring", pts: ring };
    }
    case "path": {
      const pts = collapse(ptsOf(frame, s.pts));
      const hw = halfWidthLu(frame, s.width);
      if (pts.length === 1) return { kind: "disk", c: pts[0]!, r: hw };
      return { kind: "path", pts, halfWidth: hw };
    }
    case "polyline_path": {
      const corners = polylineCorners(ptsOf(frame, s.pts));
      const pts = collapse(corners);
      const hw = halfWidthLu(frame, s.width);
      if (pts.length === 1) return { kind: "disk", c: pts[0]!, r: hw };
      return { kind: "path", pts, halfWidth: hw };
    }
    case "qarc":
      return undefined;
  }
}

/** Collapse consecutive coincident vertices of an open polyline. */
function collapse(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    out.push(p);
  }
  return out;
}

/** F-52 / F-53 / F-96: a shape with no area. */
export function isDegenerate(s: ShapeOnSheet): boolean {
  switch (s.kind) {
    case "disk": return s.r <= 0;
    case "box": return s.box.x1 <= s.box.x0 || s.box.y1 <= s.box.y0;
    case "ring": return s.pts.length < 3 || area2(s.pts) === 0;
    case "capsule": return s.r <= 0;
    case "path": {
      if (s.pts.length === 0) return true;
      if (s.halfWidth > 0) return false;
      // A zero-width path is a degenerate segment or point.
      return true;
    }
  }
}

export function shapeBox(s: ShapeOnSheet): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x: number, y: number) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
  switch (s.kind) {
    case "disk": add(s.c.x - s.r, s.c.y - s.r); add(s.c.x + s.r, s.c.y + s.r); break;
    case "box": add(s.box.x0, s.box.y0); add(s.box.x1, s.box.y1); break;
    case "ring": for (const p of s.pts) add(p.x, p.y); break;
    case "capsule": add(s.a.x - s.r, s.a.y - s.r); add(s.a.x + s.r, s.a.y + s.r); add(s.b.x - s.r, s.b.y - s.r); add(s.b.x + s.r, s.b.y + s.r); break;
    case "path": for (const p of s.pts) { add(p.x - s.halfWidth, p.y - s.halfWidth); add(p.x + s.halfWidth, p.y + s.halfWidth); } break;
  }
  if (x0 === Infinity) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  return { x0, y0, x1, y1 };
}

/** A rigid transform: optional mirror across the y axis, then rotation (CCW degrees), then translation. */
export interface Rigid { mirror: boolean; rotationDeg: number; dx: number; dy: number }

export function transformPt(p: Pt, t: Rigid): Pt {
  let x = t.mirror ? -p.x : p.x;
  let y = p.y;
  const r = ((t.rotationDeg % 360) + 360) % 360;
  if (r === 0) { /* nothing */ }
  else if (r === 90) { const nx = -y; y = x; x = nx; }
  else if (r === 180) { x = -x; y = -y; }
  else if (r === 270) { const nx = y; y = -x; x = nx; }
  else {
    const a = (r * Math.PI) / 180;
    const c = Math.cos(a), s = Math.sin(a);
    const nx = x * c - y * s;
    const ny = x * s + y * c;
    x = Math.round(nx); y = Math.round(ny);
  }
  return { x: x + t.dx, y: y + t.dy };
}

/** Transform a shape; boxes stay boxes only for multiples of 90°; rings keep CCW winding. */
export function transformShape(s: ShapeOnSheet, t: Rigid): ShapeOnSheet {
  const r = ((t.rotationDeg % 360) + 360) % 360;
  switch (s.kind) {
    case "disk": return { kind: "disk", c: transformPt(s.c, t), r: s.r };
    case "capsule": return { kind: "capsule", a: transformPt(s.a, t), b: transformPt(s.b, t), r: s.r };
    case "path": return { kind: "path", pts: s.pts.map((p) => transformPt(p, t)), halfWidth: s.halfWidth };
    case "ring": {
      const pts = s.pts.map((p) => transformPt(p, t));
      if (t.mirror) pts.reverse();
      return { kind: "ring", pts };
    }
    case "box": {
      const corners = [
        { x: s.box.x0, y: s.box.y0 }, { x: s.box.x1, y: s.box.y0 }, { x: s.box.x1, y: s.box.y1 }, { x: s.box.x0, y: s.box.y1 },
      ].map((p) => transformPt(p, t));
      if (r % 90 === 0) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of corners) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
        return { kind: "box", box: { x0, y0, x1, y1 } };
      }
      if (t.mirror) corners.reverse();
      return { kind: "ring", pts: corners };
    }
  }
}

/** The copper of a Pad per Sheet, in absolute LU (model.ts convention). */
export function padShapes(pad: Pad, form: PadForm & { absolute?: boolean }, sheetCount: number): Map<number, ShapeOnSheet[]> {
  const absolute = form.absolute === true;
  const out = new Map<number, ShapeOnSheet[]>();
  const t: Rigid = { mirror: pad.side === "back", rotationDeg: pad.rotationDeg, dx: pad.at.x, dy: pad.at.y };
  for (const [sheet, shapes] of form.perSheet) {
    const target = pad.side === "back" && !absolute ? sheetCount - 1 - sheet : sheet;
    out.set(target, shapes.map((s) => transformShape(s, t)));
  }
  return out;
}
