/**
 * Exact clearance queries for the router (docs/DESIGN.md §6 `clear.ts`).
 *
 * "Clear" means what spec/rules/drc.md DR-01..DR-08 mean by "no Violation": the Euclidean
 * distance between the new copper and every other-net item's copper on the Sheet is ≥ the
 * SpacingTable value for the two Kinds (strictly less is blocked, equal is clear), with
 *   - the same-net exemption of DR-02 (an item with `net: null` shares no net with anything),
 *   - Fences by scope (spec/rules/keepouts.md KO-01: `track` blocks Tracks and Barrels, `barrel`
 *     blocks Barrels only, `place` nothing); a Fence of Kind `null` is a wall the copper must
 *     merely not touch (DR-03), any other Kind keeps `spacing(kind(Fence), kind(item))` away,
 *   - the Rim as zero-width outline / cut-out polylines (DR-03 `rim`), with the Profile's
 *     copper-to-edge override when the run sets one (C-15),
 *   - hole clearance (DR-06) when the Profile carries one: other-net drills against the new
 *     copper and, for a Barrel, its own drill against other-net copper and drills,
 *   - Pours never block (K-05, L-07), items of Kind `null` never push copper away (C-01),
 *   - a Barrel may overlap a same-net Pad only when its form allows attach and the Pad is SMD
 *     (spec/rules/vias.md V-08); a drill coinciding with a same-net Pad's drill is blocked.
 *
 * Candidates come from the Lattice with the bounds expanded by halfWidth + the largest margin
 * (spacing.max of the Kind, the hole and edge clearances); the decision is the exact squared
 * comparison `dist²(coreA, coreB) < (required + rA + rB)²` over the convex cores of `src/geom`,
 * which never takes a square root and is exact whenever the nearest core points are vertices.
 *
 * `ignore` names the connection's own items (their ids) and its net.
 *
 * Public surface: IgnoreSet, ClearResult, sweepClear, pointFree, barrelFits, closerThan,
 * anyCloser, anyOverlap, ignoreOf.
 */
import type { Barrel, Fence, Layout, Pad, Rim, Track } from "../../spec/types/layout.ts";
import type { Box, Dop8, Pt, Seg, Shape } from "../geom/index.ts";
import { boxExpand, coreOf, dist2Pts, dop8OfPts } from "../geom/index.ts";
import type { DrillDisk, Lattice, LatticeItemRef } from "../lattice/index.ts";
import { RIM_ID, boundsOfShapes, drillOfBarrel, drillOfPad, formOf, transformShape } from "../lattice/index.ts";
import type { BarrelCandidate, Profile } from "./profile.ts";

export interface IgnoreSet { ids: ReadonlySet<number>; net: number | null }
export interface ClearResult { ok: boolean; blocking: number[] }

/** Build an IgnoreSet from item ids and a net. */
export function ignoreOf(net: number | null, ids: Iterable<number> = []): IgnoreSet {
  return { ids: new Set(ids), net };
}

// ---- exact comparisons ----------------------------------------------------------------------

function closerConvex(a: Exclude<Shape, { kind: "pieces" }>, b: Exclude<Shape, { kind: "pieces" }>, required: number, orTouching: boolean): boolean {
  const ca = coreOf(a), cb = coreOf(b);
  const need = required + ca.r + cb.r;
  const d2 = dist2Pts(ca.pts, cb.pts);
  return orTouching ? d2 <= need * need : d2 < need * need;
}

/** True when dist(a, b) < required (exact form; `required` ≤ 0 is never blocked). */
export function closerThan(a: Shape, b: Shape, required: number): boolean {
  if (required <= 0) return false;
  return compare(a, b, required, false);
}

/** True when the two shapes overlap or touch (distance 0). */
export function overlaps(a: Shape, b: Shape): boolean {
  return compare(a, b, 0, true);
}

function compare(a: Shape, b: Shape, required: number, orTouching: boolean): boolean {
  if (a.kind === "pieces") return a.parts.some((p) => compare(p, b, required, orTouching));
  if (b.kind === "pieces") return b.parts.some((p) => compare(a, p, required, orTouching));
  return closerConvex(a, b, required, orTouching);
}

export function anyCloser(as: readonly Shape[], bs: readonly Shape[], required: number): boolean {
  if (required <= 0) return false;
  for (const a of as) for (const b of bs) if (compare(a, b, required, false)) return true;
  return false;
}

export function anyOverlap(as: readonly Shape[], bs: readonly Shape[]): boolean {
  for (const a of as) for (const b of bs) if (compare(a, b, 0, true)) return true;
  return false;
}

const drillShape = (d: DrillDisk): Shape => ({ kind: "disk", c: d.c, r: d.r });
const drillSpans = (d: DrillDisk, sheet: number): boolean => sheet >= d.fromSheet && sheet <= d.toSheet;

// ---- the per-candidate rule ---------------------------------------------------------------------

interface Subject {
  shapes: readonly Shape[];
  kind: number;
  /** "track" copper is subject to `track` Fences only; "barrel" copper to `track` and `barrel` Fences. */
  cat: "track" | "barrel";
  drill?: DrillDisk;
}

/**
 * The Kind a Fence carries (KO-05). The public `Fence` type has no `kind` field (see
 * src/QUESTIONS.md); a reader that sets one is honoured, otherwise the default group's Kind.
 */
export function fenceKind(layout: Layout, f: Fence): number {
  const k = (f as { kind?: number }).kind;
  if (typeof k === "number") return k;
  return layout.netGroups.find((g) => g.id === 0)?.kind ?? layout.netGroups[0]?.kind ?? 1;
}

function sameNet(itemNet: number | null, net: number | null): boolean {
  return itemNet !== null && net !== null && itemNet === net;
}

/**
 * Decide whether one Lattice hit blocks the subject on `sheet`. Returns true when blocked.
 * Same-net Pads are only relevant to Barrels (attach rule), handled by the caller flag.
 */
function hitBlocks(layout: Layout, lattice: Lattice, sheet: number, ref: LatticeItemRef, subject: Subject, profile: Profile, ignore: IgnoreSet, attach: boolean): boolean {
  const entry = lattice.itemOf(ref.id);
  if (!entry) return false;
  const table = layout.spacing;
  switch (entry.cat) {
    case "pour": return false;
    case "fence": {
      const f = entry.item as Fence;
      if (f.scope === "place") return false;
      if (f.scope === "barrel" && subject.cat !== "barrel") return false;
      if (f.net !== undefined && sameNet(f.net, ignore.net)) return false;
      const shapes = lattice.shapesOf(ref.id, sheet);
      const fk = fenceKind(layout, f);
      if (fk === 0) return anyOverlap(subject.shapes, shapes);
      return anyCloser(subject.shapes, shapes, table.get(fk, subject.kind, sheet));
    }
    case "rim": {
      const rim = entry.item as Rim;
      const required = profile.edgeClearance ?? table.get(rim.kind, subject.kind, sheet);
      return anyCloser(subject.shapes, lattice.shapesOf(ref.id, sheet, ref.leg), required);
    }
    case "pad": case "barrel": case "track": {
      const item = entry.item as Pad | Barrel | Track;
      if (ignore.ids.has(ref.id) && !(entry.cat === "pad" && subject.cat === "barrel")) return false;
      const shapes = lattice.shapesOf(ref.id, sheet, ref.leg);
      if (sameNet(item.net, ignore.net)) {
        if (entry.cat !== "pad" || subject.cat !== "barrel") return false;
        // V-08: a Barrel over a same-net Pad needs attach (SMD Pad only); coincident drills are blocked.
        const pad = item as Pad;
        const smd = pad.sheets.length === 1;
        if (!(attach && smd) && anyOverlap(subject.shapes, shapes)) return true;
        const pd = drillOfPad(layout, pad);
        if (subject.drill && pd && overlaps(drillShape(subject.drill), drillShape(pd))) return true;
        return false;
      }
      if (ignore.ids.has(ref.id)) return false;
      if (item.kind !== 0 && subject.kind !== 0) {
        const required = table.get(subject.kind, item.kind, sheet);
        if (anyCloser(subject.shapes, shapes, required)) return true;
      }
      if (profile.holeClearance > 0) {
        const hc = profile.holeClearance;
        const drill = entry.cat === "pad" ? drillOfPad(layout, item as Pad) : entry.cat === "barrel" ? drillOfBarrel(layout, item as Barrel) : undefined;
        if (drill && drillSpans(drill, sheet) && anyCloser(subject.shapes, [drillShape(drill)], hc)) return true;
        if (subject.drill && drillSpans(subject.drill, sheet)) {
          if (anyCloser([drillShape(subject.drill)], shapes, hc)) return true;
          if (drill && closerThan(drillShape(subject.drill), drillShape(drill), hc)) return true;
        }
      }
      return false;
    }
  }
}

function margin(profile: Profile, kind: number, layout: Layout): number {
  return Math.max(layout.spacing.max(kind), profile.maxSpacing, profile.holeClearance, profile.edgeClearance ?? 0);
}

function pushBlocking(out: number[], id: number): void {
  if (out.length === 0 || out[out.length - 1] !== id) out.push(id);
}

// ---- public queries ---------------------------------------------------------------------------

/**
 * Is a Track leg `seg` of width `width` (default `profile.width`) clear on `sheet`?
 * `blocking` lists the ids of the items in the way (the Rim as RIM_ID), ascending.
 */
export function sweepClear(layout: Layout, lattice: Lattice, sheet: number, seg: Seg, profile: Profile, ignore: IgnoreSet, width = profile.width): ClearResult {
  const r = width / 2;
  const leg: Shape = seg.a.x === seg.b.x && seg.a.y === seg.b.y ? { kind: "disk", c: seg.a, r } : { kind: "capsule", a: seg.a, b: seg.b, r };
  const q: Dop8 = dop8OfPts([seg.a, seg.b], r + margin(profile, profile.trackKind, layout));
  const subject: Subject = { shapes: [leg], kind: profile.trackKind, cat: "track" };
  const blocking: number[] = [];
  for (const ref of lattice.sweepHits(sheet, q)) {
    if (hitBlocks(layout, lattice, sheet, ref, subject, profile, ignore, false)) pushBlocking(blocking, ref.id);
  }
  return { ok: blocking.length === 0, blocking };
}

/** Is a disk of the Track width at `p` clear on `sheet`? (A zero-length leg.) */
export function pointFree(layout: Layout, lattice: Lattice, sheet: number, p: Pt, profile: Profile, ignore: IgnoreSet, width = profile.width): ClearResult {
  return sweepClear(layout, lattice, sheet, { a: p, b: p }, profile, ignore, width);
}

/**
 * Would a Barrel of PadForm `candidate` centred at `at` be clear on every Sheet it has copper
 * on (and, with hole clearance, on every Sheet its drill passes)? `candidate` may be a
 * BarrelCandidate of the Profile or a PadForm id (then the Profile's barrel Kind and the form's
 * attach flag apply).
 */
export function barrelFits(layout: Layout, lattice: Lattice, at: Pt, candidate: BarrelCandidate | number, profile: Profile, ignore: IgnoreSet): ClearResult {
  const formId = typeof candidate === "number" ? candidate : candidate.form;
  const form = formOf(layout, formId);
  if (!form) return { ok: false, blocking: [] };
  const kind = typeof candidate === "number" ? profile.barrelKind : candidate.kind;
  const attach = typeof candidate === "number" ? form.attachAllowed : candidate.attach;
  const placement = { mirror: false, rotationDeg: 0, at };
  let drill: DrillDisk | undefined;
  if (form.drill && form.drill.diameter > 0) {
    const lo = Math.min(form.drill.fromSheet, form.drill.toSheet), hi = Math.max(form.drill.fromSheet, form.drill.toSheet);
    drill = { c: at, r: form.drill.diameter / 2, fromSheet: lo, toSheet: hi };
  }
  const m = margin(profile, kind, layout);
  const sheetSet = new Set<number>(form.perSheet.keys());
  if (drill && profile.holeClearance > 0) for (const s of layout.stack) if (drillSpans(drill, s.id)) sheetSet.add(s.id);
  const sheets = [...sheetSet].sort((a, b) => a - b);
  const blocking: number[] = [];
  const seen = new Set<number>();
  for (const sheet of sheets) {
    const shapes: Shape[] = [];
    for (const s of form.perSheet.get(sheet) ?? []) shapes.push(...transformShape(s, placement));
    const subject: Subject = drill ? { shapes, kind, cat: "barrel", drill } : { shapes, kind, cat: "barrel" };
    let bounds: Box | undefined = boundsOfShapes(shapes);
    if (drill && drillSpans(drill, sheet)) {
      const db = dop8OfPts([at], drill.r);
      bounds = bounds ? { x0: Math.min(bounds.x0, db.x0), y0: Math.min(bounds.y0, db.y0), x1: Math.max(bounds.x1, db.x1), y1: Math.max(bounds.y1, db.y1) } : db;
    }
    if (!bounds) continue;
    for (const ref of lattice.hits(sheet, boxExpand(bounds, m))) {
      if (seen.has(ref.id)) continue;
      if (hitBlocks(layout, lattice, sheet, ref, subject, profile, ignore, attach)) { seen.add(ref.id); blocking.push(ref.id); }
    }
  }
  blocking.sort((a, b) => a - b);
  return { ok: blocking.length === 0, blocking };
}

export { RIM_ID };
