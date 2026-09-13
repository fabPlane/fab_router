/**
 * Copper geometry of Layout items per Sheet, in the shape vocabulary of `src/geom`.
 *
 * Every item category maps to zero or more convex-core shapes on a Sheet:
 *   Pad     PadForm shapes on the form Sheet behind the Pad's Sheet (mirrored index for back-side
 *           Parts, spec/rules/layers.md L-10), mirrored across x for a back-side Pad, rotated by
 *           the Pad's rotation and translated to its centre (spec/formats/dsn.md F-113..F-116).
 *   Barrel  PadForm shapes translated to the Barrel's centre (no rotation, no mirroring).
 *   Track   one capsule per leg (stroked segment with round ends, radius = width / 2).
 *   Pour    the outline decomposed into convex pieces (holes are not subtracted: Pours are never
 *           obstacles, spec/rules/connectivity.md K-05; a consumer that needs the true copper
 *           must handle the holes itself).
 *   Fence   the Fence's shape as given.
 *   Rim     one zero-width segment per outline / cut-out edge (spec/rules/drc.md DR-03 measures
 *           copper-to-edge against the polylines).
 *
 * Rotations by multiples of 90° are exact; any other angle is float64 and rounded to LU (F-116).
 * A `ring` shape of either winding becomes CCW convex pieces (Hertel–Mehlhorn merge of an ear
 * clipping, `src/geom/pieces.ts`).
 *
 * Public surface: ItemCat, DrillDisk, rotatePt, transformShape, shapeOnSheetToGeom,
 * padFormSheetFor, padShapesOn, barrelShapesOn, trackLegShape, fenceShape, pourShape,
 * rimLegCount, rimLegShape, drillOfPad, drillOfBarrel, boundsOfShapes.
 */
import type { Barrel, Fence, Layout, Pad, PadForm, Pour, Rim, ShapeOnSheet, Track } from "../../spec/types/layout.ts";
import type { ConvexShape, Dop8, Pt, Shape } from "../geom/index.ts";
import { convexPieces, dop8Of, dop8OfPts, dop8Union, hullOf } from "../geom/index.ts";

/** Item categories the Lattice indexes. `rim` is the board outline (one leg per edge). */
export type ItemCat = "pad" | "barrel" | "track" | "pour" | "fence" | "rim";

/** A drill hole: centre, radius and the Sheet span it passes through. */
export interface DrillDisk { c: Pt; r: number; fromSheet: number; toSheet: number }

const DEG = Math.PI / 180;

/** Rotate `p` about the origin by `deg` counter-clockwise; exact for multiples of 90°. */
export function rotatePt(p: Pt, deg: number): Pt {
  let k = deg % 360;
  if (k < 0) k += 360;
  if (k === 0) return p;
  if (k === 90) return { x: -p.y, y: p.x };
  if (k === 180) return { x: -p.x, y: -p.y };
  if (k === 270) return { x: p.y, y: -p.x };
  const c = Math.cos(k * DEG), s = Math.sin(k * DEG);
  return { x: Math.round(p.x * c - p.y * s), y: Math.round(p.x * s + p.y * c) };
}

/** A rigid placement of a form-relative shape: optional mirror (x → −x), then rotation, then translation. */
export interface Placement { mirror: boolean; rotationDeg: number; at: Pt }

function place(p: Pt, pl: Placement): Pt {
  const m = pl.mirror ? { x: -p.x, y: p.y } : p;
  const r = rotatePt(m, pl.rotationDeg);
  return { x: r.x + pl.at.x, y: r.y + pl.at.y };
}

function isRightAngle(deg: number): boolean {
  let k = deg % 360;
  if (k < 0) k += 360;
  return k === 0 || k === 90 || k === 180 || k === 270;
}

/** The raw points of a ShapeOnSheet after placement (for bounds; radii are reported separately). */
function placedPoints(s: ShapeOnSheet, pl: Placement): { pts: Pt[]; r: number } {
  switch (s.kind) {
    case "disk": return { pts: [place(s.c, pl)], r: s.r };
    case "box": {
      const b = s.box;
      return { pts: [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }].map((p) => place(p, pl)), r: 0 };
    }
    case "ring": return { pts: s.pts.map((p) => place(p, pl)), r: 0 };
    case "capsule": return { pts: [place(s.a, pl), place(s.b, pl)], r: s.r };
    case "path": return { pts: s.pts.map((p) => place(p, pl)), r: s.halfWidth };
  }
}

/** Convert a placed ShapeOnSheet into geom shapes (a `ring` may yield several convex pieces). */
export function transformShape(s: ShapeOnSheet, pl: Placement): Shape[] {
  switch (s.kind) {
    case "disk": return [{ kind: "disk", c: place(s.c, pl), r: s.r }];
    case "box": {
      const { pts } = placedPoints(s, pl);
      if (isRightAngle(pl.rotationDeg)) {
        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
        return [{ kind: "box", x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }];
      }
      return [{ kind: "hull", pts: hullOf(pts) }];
    }
    case "ring": {
      const { pts } = placedPoints(s, pl);
      const pieces = convexPieces(pts);
      return pieces.length === 1 ? [pieces[0]!] : [{ kind: "pieces", parts: pieces }];
    }
    case "capsule": return [{ kind: "capsule", a: place(s.a, pl), b: place(s.b, pl), r: s.r }];
    case "path": {
      const { pts } = placedPoints(s, pl);
      if (pts.length === 0) return [];
      if (pts.length === 1) return [{ kind: "disk", c: pts[0]!, r: s.halfWidth }];
      const parts: ConvexShape[] = [];
      for (let i = 0; i + 1 < pts.length; i++) parts.push({ kind: "capsule", a: pts[i]!, b: pts[i + 1]!, r: s.halfWidth });
      return parts.length === 1 ? [parts[0]!] : [{ kind: "pieces", parts }];
    }
  }
}

const IDENTITY: Placement = { mirror: false, rotationDeg: 0, at: { x: 0, y: 0 } };

/** A ShapeOnSheet in place (no transform) as geom shapes. */
export function shapeOnSheetToGeom(s: ShapeOnSheet): Shape[] {
  return transformShape(s, IDENTITY);
}

/** Bounds of a placed ShapeOnSheet without building its convex pieces. */
function placedBounds(s: ShapeOnSheet, pl: Placement): Dop8 {
  const { pts, r } = placedPoints(s, pl);
  return dop8OfPts(pts, r);
}

function sheetIndex(layout: Layout, sheetId: number): number {
  const i = layout.stack.findIndex((s) => s.id === sheetId);
  return i < 0 ? sheetId : i;
}

/**
 * The PadForm Sheet whose shapes land on `sheet` for this Pad: the mirrored index for a back-side
 * Part (L-10) when the form has shapes there, else the Sheet itself (an `absolute` padstack).
 */
export function padFormSheetFor(layout: Layout, pad: Pad, form: PadForm, sheet: number): number | undefined {
  if (pad.side === "back") {
    const n = layout.stack.length;
    const idx = sheetIndex(layout, sheet);
    const mirrored = layout.stack[n - 1 - idx]?.id;
    if (mirrored !== undefined && form.perSheet.has(mirrored)) return mirrored;
  }
  return form.perSheet.has(sheet) ? sheet : undefined;
}

function padPlacement(pad: Pad): Placement {
  return { mirror: pad.side === "back", rotationDeg: pad.rotationDeg, at: pad.at };
}

/** Copper of a Pad on `sheet` (empty when the Pad has none there). */
export function padShapesOn(layout: Layout, pad: Pad, sheet: number): Shape[] {
  if (!pad.sheets.includes(sheet)) return [];
  const form = formOf(layout, pad.form);
  if (!form) return [];
  const fs = padFormSheetFor(layout, pad, form, sheet);
  if (fs === undefined) return [];
  const pl = padPlacement(pad);
  const out: Shape[] = [];
  for (const s of form.perSheet.get(fs) ?? []) out.push(...transformShape(s, pl));
  return out;
}

/** Bounds of a Pad's copper on `sheet`, or undefined when it has none. */
export function padBoundsOn(layout: Layout, pad: Pad, sheet: number): Dop8 | undefined {
  if (!pad.sheets.includes(sheet)) return undefined;
  const form = formOf(layout, pad.form);
  if (!form) return undefined;
  const fs = padFormSheetFor(layout, pad, form, sheet);
  if (fs === undefined) return undefined;
  const pl = padPlacement(pad);
  let acc: Dop8 | undefined;
  for (const s of form.perSheet.get(fs) ?? []) {
    const d = placedBounds(s, pl);
    acc = acc ? dop8Union(acc, d) : d;
  }
  return acc;
}

export function formOf(layout: Layout, formId: number): PadForm | undefined {
  const direct = layout.padForms[formId];
  if (direct && direct.id === formId) return direct;
  return layout.padForms.find((f) => f.id === formId);
}

/** Sheets on which a Barrel has copper: the form's Sheets within the Barrel's span. */
export function barrelSheets(layout: Layout, barrel: Barrel): number[] {
  const form = formOf(layout, barrel.form);
  if (!form) return [];
  const lo = Math.min(barrel.fromSheet, barrel.toSheet), hi = Math.max(barrel.fromSheet, barrel.toSheet);
  const out: number[] = [];
  for (const s of layout.stack) if (s.id >= lo && s.id <= hi && form.perSheet.has(s.id)) out.push(s.id);
  return out;
}

/** Copper of a Barrel on `sheet`. */
export function barrelShapesOn(layout: Layout, barrel: Barrel, sheet: number): Shape[] {
  const form = formOf(layout, barrel.form);
  if (!form) return [];
  const lo = Math.min(barrel.fromSheet, barrel.toSheet), hi = Math.max(barrel.fromSheet, barrel.toSheet);
  if (sheet < lo || sheet > hi) return [];
  const pl: Placement = { mirror: false, rotationDeg: 0, at: barrel.at };
  const out: Shape[] = [];
  for (const s of form.perSheet.get(sheet) ?? []) out.push(...transformShape(s, pl));
  return out;
}

export function barrelBoundsOn(layout: Layout, barrel: Barrel, sheet: number): Dop8 | undefined {
  const form = formOf(layout, barrel.form);
  if (!form) return undefined;
  const lo = Math.min(barrel.fromSheet, barrel.toSheet), hi = Math.max(barrel.fromSheet, barrel.toSheet);
  if (sheet < lo || sheet > hi) return undefined;
  const pl: Placement = { mirror: false, rotationDeg: 0, at: barrel.at };
  let acc: Dop8 | undefined;
  for (const s of form.perSheet.get(sheet) ?? []) {
    const d = placedBounds(s, pl);
    acc = acc ? dop8Union(acc, d) : d;
  }
  return acc;
}

/** Number of legs of a Track (a single-point Track has one degenerate leg). */
export function trackLegCount(track: Track): number {
  return Math.max(1, track.pts.length - 1);
}

/** The capsule of Track leg `leg` (a one-point Track is a disk). */
export function trackLegShape(track: Track, leg: number): Shape {
  const r = track.width / 2;
  const a = track.pts[leg] ?? track.pts[0]!;
  const b = track.pts[leg + 1] ?? a;
  if (a.x === b.x && a.y === b.y) return { kind: "disk", c: a, r };
  return { kind: "capsule", a, b, r };
}

export function trackLegBounds(track: Track, leg: number): Dop8 {
  const a = track.pts[leg] ?? track.pts[0]!;
  const b = track.pts[leg + 1] ?? a;
  return dop8OfPts([a, b], track.width / 2);
}

/** A Fence's region as geom shapes. */
export function fenceShape(fence: Fence): Shape[] {
  return shapeOnSheetToGeom(fence.shape);
}

export function fenceBounds(fence: Fence): Dop8 {
  return placedBounds(fence.shape, IDENTITY);
}

/** A Pour's outline as convex pieces (holes not subtracted; see the header). */
export function pourShape(pour: Pour): Shape[] {
  const pieces = convexPieces(pour.outline);
  if (pieces.length === 0) return [];
  return pieces.length === 1 ? [pieces[0]!] : [{ kind: "pieces", parts: pieces }];
}

export function pourBounds(pour: Pour): Dop8 {
  return dop8OfPts(pour.outline);
}

/** Rim edges: the outline's edges first, then each cut-out's edges, each a zero-width segment. */
export function rimLegCount(rim: Rim): number {
  let n = rim.outline.length >= 2 ? rim.outline.length : 0;
  for (const c of rim.cutouts) n += c.length >= 2 ? c.length : 0;
  return n;
}

function rimLegPoints(rim: Rim, leg: number): [Pt, Pt] | undefined {
  const rings: (readonly Pt[])[] = [rim.outline, ...rim.cutouts];
  let k = leg;
  for (const ring of rings) {
    const n = ring.length >= 2 ? ring.length : 0;
    if (k < n) return [ring[k]!, ring[(k + 1) % n]!];
    k -= n;
  }
  return undefined;
}

export function rimLegShape(rim: Rim, leg: number): Shape | undefined {
  const e = rimLegPoints(rim, leg);
  if (!e) return undefined;
  const [a, b] = e;
  if (a.x === b.x && a.y === b.y) return { kind: "disk", c: a, r: 0 };
  return { kind: "capsule", a, b, r: 0 };
}

export function rimLegBounds(rim: Rim, leg: number): Dop8 | undefined {
  const e = rimLegPoints(rim, leg);
  return e ? dop8OfPts(e) : undefined;
}

/** The drill of a Pad (through its PadForm), if any. */
export function drillOfPad(layout: Layout, pad: Pad): DrillDisk | undefined {
  const form = formOf(layout, pad.form);
  if (!form?.drill || form.drill.diameter <= 0) return undefined;
  const lo = Math.min(form.drill.fromSheet, form.drill.toSheet), hi = Math.max(form.drill.fromSheet, form.drill.toSheet);
  return { c: pad.at, r: form.drill.diameter / 2, fromSheet: lo, toSheet: hi };
}

/** The drill of a Barrel (through its PadForm), if any. */
export function drillOfBarrel(layout: Layout, barrel: Barrel): DrillDisk | undefined {
  const form = formOf(layout, barrel.form);
  if (!form?.drill || form.drill.diameter <= 0) return undefined;
  const lo = Math.min(form.drill.fromSheet, form.drill.toSheet), hi = Math.max(form.drill.fromSheet, form.drill.toSheet);
  return { c: barrel.at, r: form.drill.diameter / 2, fromSheet: lo, toSheet: hi };
}

/** Union of the 8-DOPs of a shape list (undefined for an empty list). */
export function boundsOfShapes(shapes: readonly Shape[]): Dop8 | undefined {
  let acc: Dop8 | undefined;
  for (const s of shapes) {
    const d = dop8Of(s);
    acc = acc ? dop8Union(acc, d) : d;
  }
  return acc;
}
