/**
 * Clearance DRC (docs/DESIGN.md §5 `spacing.ts`; spec/rules/drc.md DR-01 … DR-11,
 * spec/rules/keepouts.md KO-01/KO-05/KO-07, spec/rules/clearance.md C-11/C-15).
 *
 * For every copper subject — a Pad on each Sheet of its span, a Barrel on each Sheet it has
 * copper on, each Track leg on its Sheet — the Lattice is queried with the subject's bounds
 * expanded by the largest spacing of its Kind (plus the hole and copper-to-edge clearances of the
 * run), and every candidate is decided with the exact squared comparison of exact.ts:
 *   spacing  other-net Pad / Barrel / Track copper closer than `spacing(kindA, kindB, sheet)`
 *            (DR-01; same-net pairs exempt, DR-02; Kind-null items never take part, C-01);
 *   fence    a `track` Fence against Pads, Barrels and Tracks, a `barrel` Fence against Barrels
 *            (DR-03, KO-01): closer than `spacing(kind(Fence), kind(item))`, or merely touching
 *            for a Kind-null Fence. A Part-owned Fence (an image keepout: the footprint's own
 *            non-plated holes) is not checked against Pads — unless the run sets a hole clearance,
 *            which turns a Part-owned circular Fence into a `hole_edge` Fence (C-15, KO-07) with
 *            max(table value, holeClearance) against everything, Pads included;
 *   rim      copper closer than `spacing(kind(Rim), kind(item))` — or the run's
 *            copperToEdgeClearance (C-15, ruling Q-I3-21) — to the outline / cut-out polylines
 *            (DR-03), plus a free Track leg or Barrel (copper the router adds) that crosses an
 *            outline edge or lies outside the outer ring or inside a cut-out (DR-11, Q-I3b-43);
 *   hole     with holeClearance > 0: a drill enlarged by the clearance against other-net copper on
 *            the Sheets of the drill's span and against other-net drills (DR-06, DR-06a).
 * Counting (DR-04): one Violation per unordered item pair per Sheet (a Track–Track pair once per
 * Sheet whatever the number of legs, the closest legs reported); fence and rim Violations once per
 * (item, Fence, Sheet) and (item, Sheet); hole Violations once per (drill, item) pair with `a` the
 * item whose drill it is. Pours are never part of a Violation (K-05). `at` is a point in the gap
 * (or overlap), `actual` the exact Euclidean distance.
 *
 * Public surface: SpacingOptions, checkSpacing.
 */
import type { Barrel, Fence, Layout, Pad, Pt, Rim, Track } from "../../spec/types/layout.ts";
import type { Violation } from "../../spec/types/results.ts";
import type { Box, Shape } from "../geom/index.ts";
import { boxExpand } from "../geom/index.ts";
import type { DrillDisk, Lattice, LatticeItemRef } from "../lattice/index.ts";
import { RIM_ID, barrelSheets, boundsOfShapes, drillOfBarrel, drillOfPad, trackLegCount } from "../lattice/index.ts";
import { anyCloser, closer, crossesEdge, distance, gapPoint, touching, withinRim } from "./exact.ts";

export interface SpacingOptions {
  /** DR-06 hole clearance in LU; 0 = off. */
  holeClearance: number;
  /** C-15 copper-to-edge clearance in LU; undefined = the Rim's table value. */
  edgeClearance?: number;
}

type CopperCat = "pad" | "barrel" | "track";
interface Subject { id: number; cat: CopperCat; net: number | null; kind: number; sheet: number; leg?: number; shapes: readonly Shape[]; drill?: DrillDisk; free?: boolean }

const drillShape = (d: DrillDisk): Shape => ({ kind: "disk", c: d.c, r: d.r });
const spans = (d: DrillDisk, sheet: number): boolean => sheet >= d.fromSheet && sheet <= d.toSheet;
const sameNet = (a: number | null, b: number | null): boolean => a !== null && b !== null && a === b;

/** Keyed collection keeping, per key, the Violation with the smallest `actual`. */
class Findings {
  private map = new Map<string, Violation>();
  add(key: string, v: Violation): void {
    const cur = this.map.get(key);
    if (!cur || v.actual < cur.actual) this.map.set(key, v);
  }
  has(key: string): boolean { return this.map.has(key); }
  list(): Violation[] {
    const order = { spacing: 0, fence: 1, rim: 2, hole: 3 };
    return [...this.map.values()].sort((x, y) => x.a - y.a || cmpB(x.b, y.b) || x.sheet - y.sheet || order[x.rule] - order[y.rule]);
  }
}
function cmpB(a: Violation["b"], b: Violation["b"]): number {
  const na = typeof a === "number", nb = typeof b === "number";
  if (na && nb) return (a as number) - (b as number);
  if (na !== nb) return na ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function isPartFence(f: Fence): boolean {
  return (f as { owner?: string }).owner === "part";
}
function isPartHoleFence(f: Fence): boolean {
  return isPartFence(f) && f.shape.kind === "disk";
}

/** Run the clearance check over the whole Layout. */
export function checkSpacing(layout: Layout, lattice: Lattice, opts: SpacingOptions): Violation[] {
  const table = layout.spacing;
  const found = new Findings();
  const hc = opts.holeClearance > 0 ? opts.holeClearance : 0;
  const rim = layout.rim;

  const marginOf = (kind: number): number => Math.max(table.max(kind), hc, opts.edgeClearance ?? 0);

  /** Sheets a drilled item is a subject on: its copper Sheets plus, with hole clearance, every Sheet of the drill's span (DR-06a). */
  const drilledSheets = (copper: readonly number[], drill: DrillDisk | undefined): number[] => {
    const set = new Set<number>(copper);
    if (drill && hc > 0) for (const sh of layout.stack) if (spans(drill, sh.id)) set.add(sh.id);
    return [...set].sort((a, b) => a - b);
  };

  const subjectsOf = (): Subject[] => {
    const out: Subject[] = [];
    for (const p of layout.pads) {
      const drill = drillOfPad(layout, p);
      for (const sheet of drilledSheets(p.sheets, drill)) {
        const shapes = lattice.shapesOf(p.id, sheet);
        if (shapes.length === 0 && !(drill && hc > 0)) continue;
        out.push(drill ? { id: p.id, cat: "pad", net: p.net, kind: p.kind, sheet, shapes, drill } : { id: p.id, cat: "pad", net: p.net, kind: p.kind, sheet, shapes });
      }
    }
    for (const b of layout.barrels) {
      const drill = drillOfBarrel(layout, b);
      for (const sheet of drilledSheets(barrelSheets(layout, b), drill)) {
        const shapes = lattice.shapesOf(b.id, sheet);
        if (shapes.length === 0 && !(drill && hc > 0)) continue;
        const free = b.hold === "free";
        out.push(drill ? { id: b.id, cat: "barrel", net: b.net, kind: b.kind, sheet, shapes, drill, free } : { id: b.id, cat: "barrel", net: b.net, kind: b.kind, sheet, shapes, free });
      }
    }
    for (const t of layout.tracks) {
      if (t.pts.length === 0) continue;
      const n = trackLegCount(t);
      for (let leg = 0; leg < n; leg++) {
        const shapes = lattice.shapesOf(t.id, t.sheet, leg);
        if (shapes.length === 0) continue;
        out.push({ id: t.id, cat: "track", net: t.net, kind: t.kind, sheet: t.sheet, leg, shapes, free: t.hold === "free" });
      }
    }
    return out;
  };

  const report = (key: string, a: number, b: Violation["b"], sheet: number, rule: Violation["rule"], required: number, as: readonly Shape[], bs: readonly Shape[]) => {
    let best = Infinity;
    let pick: [Shape, Shape] | undefined;
    for (const x of as) for (const y of bs) { const d = distance(x, y); if (d < best) { best = d; pick = [x, y]; } }
    if (!pick) return;
    const at: Pt = gapPoint(pick[0], pick[1]);
    found.add(key, { a, b, sheet, required, actual: best, at, rule });
  };

  const evaluateCopper = (s: Subject, ref: LatticeItemRef, cat: CopperCat, item: Pad | Barrel | Track) => {
    if (item.id === s.id) return;
    if (item.id < s.id) return; // each unordered pair once, from the lower id
    const other = lattice.shapesOf(ref.id, s.sheet, ref.leg);
    if (sameNet(item.net, s.net)) return;
    if (s.shapes.length > 0 && other.length > 0 && s.kind !== 0 && item.kind !== 0) {
      const required = table.get(s.kind, item.kind, s.sheet);
      if (anyCloser(s.shapes, other, required)) report(`s:${s.id}:${item.id}:${s.sheet}`, s.id, item.id, s.sheet, "spacing", required, s.shapes, other);
    }
    if (hc > 0) {
      // DR-06 / DR-06a: drills against copper on every Sheet of the drill's span; drill-to-drill on any Sheet.
      const drill = cat === "pad" ? drillOfPad(layout, item as Pad) : cat === "barrel" ? drillOfBarrel(layout, item as Barrel) : undefined;
      if (drill && spans(drill, s.sheet) && s.shapes.length > 0 && anyCloser(s.shapes, [drillShape(drill)], hc)) {
        report(`h:${item.id}:${s.id}`, item.id, "hole", s.sheet, "hole", hc, s.shapes, [drillShape(drill)]);
      }
      if (s.drill && spans(s.drill, s.sheet) && other.length > 0 && anyCloser([drillShape(s.drill)], other, hc)) {
        report(`h:${s.id}:${item.id}`, s.id, "hole", s.sheet, "hole", hc, other, [drillShape(s.drill)]);
      }
      if (s.drill && drill && closer(drillShape(s.drill), drillShape(drill), hc)) {
        report(`h:${s.id}:${item.id}`, s.id, "hole", s.sheet, "hole", hc, [drillShape(drill)], [drillShape(s.drill)]);
      }
    }
  };

  const evaluateFence = (s: Subject, f: Fence) => {
    if (f.scope === "place") return;
    if (f.scope === "barrel" && s.cat !== "barrel") return;
    if (f.net !== undefined && sameNet(f.net, s.net)) return;
    // A Part-owned Fence (an image keepout: the footprint's own non-plated holes) is not checked
    // against Pads — unless the run's hole clearance turns it into a `hole_edge` Fence (C-15, KO-07).
    if (s.cat === "pad" && isPartFence(f) && !(hc > 0 && isPartHoleFence(f))) return;
    const shapes = lattice.shapesOf(f.id, s.sheet);
    if (shapes.length === 0) return;
    const key = `f:${s.id}:${f.id}:${s.sheet}`;
    if (f.kind === 0) {
      if (s.shapes.some((a) => shapes.some((b) => touching(a, b)))) report(key, s.id, "fence", s.sheet, "fence", 0, s.shapes, shapes);
      return;
    }
    if (s.kind === 0) return;
    let required = table.get(f.kind, s.kind, s.sheet);
    if (hc > 0 && isPartHoleFence(f)) required = Math.max(required, hc);
    if (anyCloser(s.shapes, shapes, required)) report(key, s.id, "fence", s.sheet, "fence", required, s.shapes, shapes);
  };

  const evaluateRim = (s: Subject, ref: LatticeItemRef, r: Rim) => {
    if (s.kind === 0 || s.shapes.length === 0) return;
    const required = opts.edgeClearance ?? table.get(r.kind, s.kind, s.sheet);
    const leg = lattice.shapesOf(RIM_ID, s.sheet, ref.leg);
    if (leg.length === 0) return;
    if (anyCloser(s.shapes, leg, required)) { report(`r:${s.id}:${s.sheet}`, s.id, "rim", s.sheet, "rim", required, s.shapes, leg); return; }
    if (!s.free) return;
    // DR-11 step 1 (ruling Q-I3b-43): a free Track leg's or Barrel's interior may not cross an outline / cut-out edge.
    for (const e of leg) {
      if (e.kind !== "capsule" && e.kind !== "disk") continue;
      const a = e.kind === "disk" ? e.c : e.a, b = e.kind === "disk" ? e.c : e.b;
      if (s.shapes.some((x) => crossesEdge(x, a, b))) { report(`r:${s.id}:${s.sheet}`, s.id, "rim", s.sheet, "rim", required, s.shapes, leg); return; }
    }
  };

  for (const s of subjectsOf()) {
    if (s.kind === 0 && hc === 0) continue;
    const bounds = boundsOfShapes(s.shapes);
    let box: Box | undefined = bounds ? boxExpand(bounds, marginOf(s.kind)) : undefined;
    if (s.drill && hc > 0 && spans(s.drill, s.sheet)) {
      const d = s.drill;
      const db: Box = { x0: d.c.x - d.r - hc, y0: d.c.y - d.r - hc, x1: d.c.x + d.r + hc, y1: d.c.y + d.r + hc };
      box = box ? { x0: Math.min(box.x0, db.x0), y0: Math.min(box.y0, db.y0), x1: Math.max(box.x1, db.x1), y1: Math.max(box.y1, db.y1) } : db;
    }
    if (!box) continue;
    for (const ref of lattice.hits(s.sheet, box)) {
      const entry = lattice.itemOf(ref.id);
      if (!entry) continue;
      switch (entry.cat) {
        case "pour": break;
        case "pad": case "barrel": case "track": evaluateCopper(s, ref, entry.cat, entry.item as Pad | Barrel | Track); break;
        case "fence": evaluateFence(s, entry.item as Fence); break;
        case "rim": evaluateRim(s, ref, entry.item as Rim); break;
      }
    }
  }

  // DR-11 step 2 (ruling Q-I3b-43): free Track legs and Barrels must lie inside the outline and outside
  // cut-outs. DR-11 is stated for copper the router adds (Hold `free`); held and locked copper is the
  // file's and is measured by DR-03 only (the `ses-apply-issue555-bbd-mars-64-*` cases).
  if (rim) {
    const offBoard = (id: number, sheet: number, at: Pt, kind: number) => {
      const key = `r:${id}:${sheet}`;
      if (found.has(key) || kind === 0) return;
      const required = opts.edgeClearance ?? table.get(rim.kind, kind, sheet);
      found.add(key, { a: id, b: "rim", sheet, required, actual: 0, at, rule: "rim" });
    };
    for (const t of layout.tracks) {
      if (t.pts.length === 0 || t.kind === 0 || t.hold !== "free" || found.has(`r:${t.id}:${t.sheet}`)) continue;
      const n = trackLegCount(t);
      for (let leg = 0; leg < n; leg++) {
        const shapes = lattice.shapesOf(t.id, t.sheet, leg);
        if (shapes.length > 0 && !withinRim(rim, shapes)) { offBoard(t.id, t.sheet, t.pts[leg]!, t.kind); break; }
      }
    }
    for (const b of layout.barrels) {
      if (b.kind === 0 || b.hold !== "free") continue;
      for (const sheet of barrelSheets(layout, b)) {
        if (found.has(`r:${b.id}:${sheet}`)) continue;
        const shapes = lattice.shapesOf(b.id, sheet);
        if (shapes.length > 0 && !withinRim(rim, shapes)) offBoard(b.id, sheet, b.at, b.kind);
      }
    }
  }

  return found.list();
}
