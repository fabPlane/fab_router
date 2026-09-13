/**
 * Consistency of the router's clearance queries with DRC semantics (spec/rules/drc.md DR-01..
 * DR-08, DR-06a, DR-11, keepouts.md, vias.md V-08). `checkDrc` is still a stub in this checkout,
 * so the oracle is a brute-force DRC written here: every Track leg and Barrel is compared against
 * every other item on its Sheet(s) with no spatial index and its own rule code. For every leg and
 * Barrel:
 *   - violation-free per the oracle  ⇒ `sweepClear` / `barrelFits` report clear with the item's
 *     own id in `ignore`;
 *   - involved in a violation        ⇒ reported blocked, and `blocking` names exactly the
 *     partners the oracle found.
 * Runs over several synthetic boards, with and without hole / copper-to-edge clearance, in 45°
 * and any-angle modes, plus hand-built edge cases (equal distance is clear, one LU closer is
 * blocked, same-net exemption, Kind-null Fence walls, Fence scopes, Pours, attach, DR-06a hole
 * scope, DR-11 copper off the board).
 */
import { describe, expect, test } from "bun:test";
import type { Barrel, Fence, Layout, Pad, Pt, Track } from "../spec/types/layout.ts";
import { DEFAULT_ROUTE_SETTINGS, type RouteSettings } from "../spec/types/settings.ts";
import type { Shape } from "../src/geom/index.ts";
import { coreOf, dist2Pts, orient, pointInConvex, pointInRing } from "../src/geom/index.ts";
import type { DrillDisk } from "../src/lattice/index.ts";
import {
  barrelShapesOn, barrelSheets, buildLattice, drillOfBarrel, drillOfPad, fenceShape, formOf, padShapesOn, RIM_ID,
  rimLegCount, rimLegShape, trackLegCount, trackLegShape,
} from "../src/lattice/index.ts";
import { makeSpacingTable } from "../src/layout/index.ts";
import { barrelFits, ignoreOf, pointFree, resolveProfile, sweepClear, type Profile } from "../src/route/index.ts";
import { KIND_DEFAULT, KIND_NULL, rect, synthLayout } from "./helpers/synth.ts";

// ---- the brute-force oracle -------------------------------------------------------------------

/** dist(a, b) < required, in the exact squared form (never blocked for required ≤ 0). */
function closer(a: Shape, b: Shape, required: number): boolean {
  if (required <= 0) return false;
  if (a.kind === "pieces") return a.parts.some((p) => closer(p, b, required));
  if (b.kind === "pieces") return b.parts.some((p) => closer(a, p, required));
  const ca = coreOf(a), cb = coreOf(b);
  const need = required + ca.r + cb.r;
  return dist2Pts(ca.pts, cb.pts) < need * need;
}
function touches(a: Shape, b: Shape): boolean {
  if (a.kind === "pieces") return a.parts.some((p) => touches(p, b));
  if (b.kind === "pieces") return b.parts.some((p) => touches(a, p));
  const ca = coreOf(a), cb = coreOf(b);
  const need = ca.r + cb.r;
  return dist2Pts(ca.pts, cb.pts) <= need * need;
}
const anyCloser = (as: readonly Shape[], bs: readonly Shape[], req: number) => as.some((a) => bs.some((b) => closer(a, b, req)));
const anyTouch = (as: readonly Shape[], bs: readonly Shape[]) => as.some((a) => bs.some((b) => touches(a, b)));
const disk = (d: DrillDisk): Shape => ({ kind: "disk", c: d.c, r: d.r });
const spans = (d: DrillDisk, s: number) => s >= d.fromSheet && s <= d.toSheet;

/** DR-11, brute force: the copper's interior meets the zero-width edge a–b. */
function crossesEdge(s: Shape, a: Pt, b: Pt): boolean {
  if (s.kind === "pieces") return s.parts.some((p) => crossesEdge(p, a, b));
  const { pts, r } = coreOf(s);
  if (pts.length === 0) return false;
  const point = a.x === b.x && a.y === b.y;
  if (r > 0) return dist2Pts(pts, point ? [a] : [a, b]) < r * r;
  if (pts.length < 2) return false;
  const proper = (p: Pt, q: Pt) => orient(p, q, a) * orient(p, q, b) < 0 && orient(a, b, p) * orient(a, b, q) < 0;
  if (pts.length === 2) return !point && proper(pts[0]!, pts[1]!);
  if (!point) for (let i = 0; i < pts.length; i++) if (proper(pts[i]!, pts[(i + 1) % pts.length]!)) return true;
  return pointInConvex(pts, a) === "inside" || pointInConvex(pts, b) === "inside";
}

/** DR-11, brute force: every core point of every part inside the outline and outside each cut-out. */
function onBoard(layout: Layout, shapes: readonly Shape[]): boolean {
  const rim = layout.rim;
  if (!rim) return true;
  const parts = shapes.flatMap((s) => (s.kind === "pieces" ? s.parts : [s]));
  for (const part of parts) {
    for (const p of coreOf(part).pts) {
      if (rim.outline.length >= 3 && pointInRing(rim.outline, p) === "outside") return false;
      for (const c of rim.cutouts) if (c.length >= 3 && pointInRing(c, p) === "inside") return false;
    }
  }
  return true;
}

interface Opts { holeClearance: number; edgeClearance?: number }

interface CopperItem { id: number; cat: "pad" | "barrel" | "track"; net: number | null; kind: number; shapes: Shape[]; drill?: DrillDisk }

/** Every item present on a Sheet: copper there, or (Pads / Barrels) a drill passing through it; each Track leg separately. */
function itemsOn(layout: Layout, sheet: number): CopperItem[] {
  const out: CopperItem[] = [];
  for (const p of layout.pads) {
    const shapes = padShapesOn(layout, p, sheet);
    const d = drillOfPad(layout, p);
    if (shapes.length === 0 && !(d && spans(d, sheet))) continue;
    out.push(d ? { id: p.id, cat: "pad", net: p.net, kind: p.kind, shapes, drill: d } : { id: p.id, cat: "pad", net: p.net, kind: p.kind, shapes });
  }
  for (const b of layout.barrels) {
    const shapes = barrelShapesOn(layout, b, sheet);
    const d = drillOfBarrel(layout, b);
    if (shapes.length === 0 && !(d && spans(d, sheet))) continue;
    out.push(d ? { id: b.id, cat: "barrel", net: b.net, kind: b.kind, shapes, drill: d } : { id: b.id, cat: "barrel", net: b.net, kind: b.kind, shapes });
  }
  for (const t of layout.tracks) {
    if (t.sheet !== sheet || t.pts.length === 0) continue;
    for (let leg = 0; leg < trackLegCount(t); leg++) out.push({ id: t.id, cat: "track", net: t.net, kind: t.kind, shapes: [trackLegShape(t, leg)] });
  }
  return out;
}

const sameNet = (a: number | null, b: number | null) => a !== null && b !== null && a === b;

interface Subject { id: number; net: number | null; kind: number; cat: "track" | "barrel"; shapes: Shape[]; drill?: DrillDisk }

/** Partners violating against `subject` on `sheet` (DR-01, DR-03, DR-06 on this Sheet, DR-11 crossings); ids sorted unique. */
function oracle(layout: Layout, sheet: number, subject: Subject, opts: Opts): number[] {
  const found = new Set<number>();
  const sp = layout.spacing;
  for (const o of itemsOn(layout, sheet)) {
    if (o.id === subject.id) continue;
    if (sameNet(o.net, subject.net)) continue;
    if (o.kind !== KIND_NULL && subject.kind !== KIND_NULL && anyCloser(subject.shapes, o.shapes, sp.get(subject.kind, o.kind, sheet))) { found.add(o.id); continue; }
    if (opts.holeClearance > 0) {
      const hc = opts.holeClearance;
      if (o.drill && spans(o.drill, sheet) && anyCloser(subject.shapes, [disk(o.drill)], hc)) { found.add(o.id); continue; }
      if (subject.drill && spans(subject.drill, sheet) && anyCloser([disk(subject.drill)], o.shapes, hc)) { found.add(o.id); continue; }
    }
  }
  for (const f of layout.fences) {
    if (f.scope === "place") continue;
    if (f.scope === "barrel" && subject.cat !== "barrel") continue;
    const on = f.sheet === "all-signal" ? layout.stack.find((s) => s.id === sheet)?.role === "signal" : f.sheet === sheet;
    if (!on) continue;
    const shapes = fenceShape(f);
    const hit = f.kind === KIND_NULL ? anyTouch(subject.shapes, shapes) : anyCloser(subject.shapes, shapes, sp.get(f.kind, subject.kind, sheet));
    if (hit) found.add(f.id);
  }
  if (layout.rim) {
    const req = opts.edgeClearance ?? sp.get(layout.rim.kind, subject.kind, sheet);
    for (let leg = 0; leg < rimLegCount(layout.rim); leg++) {
      const s = rimLegShape(layout.rim, leg)!;
      const a = s.kind === "disk" ? s.c : (s as { a: Pt }).a, b = s.kind === "disk" ? s.c : (s as { b: Pt }).b;
      if (anyCloser(subject.shapes, [s], req) || subject.shapes.some((x) => crossesEdge(x, a, b))) { found.add(RIM_ID); break; }
    }
  }
  return [...found].sort((a, b) => a - b);
}

/** DR-06a: other-net drills closer than the hole clearance to the subject's drill, on any Sheet. */
function drillBlockers(layout: Layout, subject: { id: number; net: number | null; drill: DrillDisk }, hc: number): number[] {
  const out: number[] = [];
  const consider = (id: number, net: number | null, d: DrillDisk | undefined) => {
    if (id === subject.id || !d || sameNet(net, subject.net)) return;
    if (closer(disk(subject.drill), disk(d), hc)) out.push(id);
  };
  for (const p of layout.pads) consider(p.id, p.net, drillOfPad(layout, p));
  for (const b of layout.barrels) consider(b.id, b.net, drillOfBarrel(layout, b));
  return out;
}

/** Same-net Pads a Barrel may not sit on (V-08): overlap without attach, or coincident drills. */
function attachBlockers(layout: Layout, b: Barrel): number[] {
  const form = formOf(layout, b.form)!;
  const drill = drillOfBarrel(layout, b);
  const out = new Set<number>();
  for (const sheet of barrelSheets(layout, b)) {
    const mine = barrelShapesOn(layout, b, sheet);
    for (const p of layout.pads) {
      if (!sameNet(p.net, b.net)) continue;
      const theirs = padShapesOn(layout, p, sheet);
      if (theirs.length === 0) continue;
      const smd = p.sheets.length === 1;
      if (!(form.attachAllowed && smd) && anyTouch(mine, theirs)) out.add(p.id);
      const pd = drillOfPad(layout, p);
      if (drill && pd && touches(disk(drill), disk(pd))) out.add(p.id);
    }
  }
  return [...out].sort((a, b) => a - b);
}

function settingsFor(opts: Opts): RouteSettings {
  const s: RouteSettings = { ...DEFAULT_ROUTE_SETTINGS, layers: {}, ignoreNetGroups: [] };
  if (opts.holeClearance > 0) s.holeClearanceUm = opts.holeClearance / 10;
  if (opts.edgeClearance !== undefined) s.copperToEdgeClearanceUm = opts.edgeClearance / 10;
  return s;
}

interface Tally { legs: number; blockedLegs: number; barrels: number; blockedBarrels: number; offBoard: number }

function checkBoard(layout: Layout, opts: Opts): Tally {
  const lattice = buildLattice(layout);
  const settings = settingsFor(opts);
  const profiles = new Map<string, Profile>();
  const profileFor = (net: number | null, kind: number): Profile => {
    const k = `${net}:${kind}`;
    let p = profiles.get(k);
    if (!p) { p = { ...resolveProfile(layout, net, settings), trackKind: kind, barrelKind: kind }; profiles.set(k, p); }
    return p;
  };
  const tally: Tally = { legs: 0, blockedLegs: 0, barrels: 0, blockedBarrels: 0, offBoard: 0 };
  for (const t of layout.tracks) {
    const profile = profileFor(t.net, t.kind);
    const ignore = ignoreOf(t.net, [t.id]);
    for (let leg = 0; leg < trackLegCount(t); leg++) {
      const a = t.pts[leg]!, b = t.pts[leg + 1] ?? a;
      const shapes = [trackLegShape(t, leg)];
      const want = new Set(oracle(layout, t.sheet, { id: t.id, net: t.net, kind: t.kind, cat: "track", shapes }, opts));
      if (!onBoard(layout, shapes)) { want.add(RIM_ID); tally.offBoard++; }
      const got = sweepClear(layout, lattice, t.sheet, { a, b }, profile, ignore, t.width);
      const wantList = [...want].sort((x, y) => x - y);
      expect(got.ok).toBe(wantList.length === 0);
      expect(got.blocking).toEqual(wantList);
      tally.legs++;
      if (!got.ok) tally.blockedLegs++;
    }
  }
  for (const b of layout.barrels) {
    const form = formOf(layout, b.form)!;
    const profile = profileFor(b.net, b.kind);
    const ignore = ignoreOf(b.net, [b.id]);
    const drill = drillOfBarrel(layout, b);
    const want = new Set<number>();
    const sheets = new Set<number>(barrelSheets(layout, b));
    if (drill && opts.holeClearance > 0) for (const s of layout.stack) if (spans(drill, s.id)) sheets.add(s.id);
    const copper: Shape[] = [];
    for (const sheet of [...sheets]) {
      const shapes = barrelShapesOn(layout, b, sheet);
      copper.push(...shapes);
      const subject: Subject = drill ? { id: b.id, net: b.net, kind: b.kind, cat: "barrel", shapes, drill } : { id: b.id, net: b.net, kind: b.kind, cat: "barrel", shapes };
      for (const id of oracle(layout, sheet, subject, opts)) want.add(id);
    }
    if (drill && opts.holeClearance > 0) for (const id of drillBlockers(layout, { id: b.id, net: b.net, drill }, opts.holeClearance)) want.add(id);
    for (const id of attachBlockers(layout, b)) want.add(id);
    if (!onBoard(layout, copper)) { want.add(RIM_ID); tally.offBoard++; }
    const ids = [...form.perSheet.keys()].sort((x, y) => x - y);
    const candidate = { form: b.form, kind: b.kind, attach: form.attachAllowed, fromSheet: ids[0]!, toSheet: ids[ids.length - 1]! };
    const got = barrelFits(layout, lattice, b.at, candidate, profile, ignore);
    const wantList = [...want].sort((x, y) => x - y);
    expect(got.ok).toBe(wantList.length === 0);
    expect(got.blocking).toEqual(wantList);
    tally.barrels++;
    if (!got.ok) tally.blockedBarrels++;
  }
  return tally;
}

describe("sweepClear / barrelFits agree with a brute-force DRC on synthetic boards", () => {
  const variants: Array<{ name: string; opts: Opts }> = [
    { name: "file rules only", opts: { holeClearance: 0 } },
    { name: "hole clearance 600 µm", opts: { holeClearance: 6000 } },
    { name: "copper-to-edge 1 mm", opts: { holeClearance: 0, edgeClearance: 10000 } },
    { name: "both", opts: { holeClearance: 6000, edgeClearance: 10000 } },
  ];
  for (const v of variants) {
    test(v.name, () => {
      const sum: Tally = { legs: 0, blockedLegs: 0, barrels: 0, blockedBarrels: 0, offBoard: 0 };
      for (const seed of [1, 2, 3]) {
        for (const angleMode of ["45", "any"] as const) {
          const r = checkBoard(synthLayout({ seed, angleMode }), v.opts);
          sum.legs += r.legs; sum.blockedLegs += r.blockedLegs; sum.barrels += r.barrels; sum.blockedBarrels += r.blockedBarrels; sum.offBoard += r.offBoard;
        }
      }
      if (process.env.FAB_ROUTER_VERBOSE) console.log(`clear-vs-drc [${v.name}]: legs ${sum.legs} (${sum.blockedLegs} blocked), barrels ${sum.barrels} (${sum.blockedBarrels} blocked), ${sum.offBoard} items off the board`);
      // the boards are dense enough that both outcomes are exercised
      expect(sum.legs).toBeGreaterThan(1000);
      expect(sum.blockedLegs).toBeGreaterThan(50);
      expect(sum.legs - sum.blockedLegs).toBeGreaterThan(50);
      expect(sum.barrels).toBeGreaterThan(100);
      expect(sum.blockedBarrels).toBeGreaterThan(5);
      expect(sum.barrels - sum.blockedBarrels).toBeGreaterThan(5);
      expect(sum.offBoard).toBeGreaterThanOrEqual(6 * 4); // the deliberate off-board items of every board
    });
  }
});

// ---- hand-built cases -----------------------------------------------------------------------

function tinyLayout(): Layout {
  const kinds = ["", "default", "area"];
  const spacing = makeSpacingTable(kinds, 2, [], (a, b) => (a === 0 || b === 0 ? 0 : a === 2 || b === 2 ? 1500 : 2000));
  const viaForm = { id: 0, name: "via", perSheet: new Map([[0, [{ kind: "disk" as const, c: { x: 0, y: 0 }, r: 3000 }]], [1, [{ kind: "disk" as const, c: { x: 0, y: 0 }, r: 3000 }]]]), drill: { diameter: 3000, fromSheet: 0, toSheet: 1 }, attachAllowed: true };
  const noAttach = { ...viaForm, id: 1, name: "via-noattach", attachAllowed: false };
  const smd = { id: 2, name: "smd", perSheet: new Map([[0, [{ kind: "box" as const, box: { x0: -5000, y0: -5000, x1: 5000, y1: 5000 } }]]]), attachAllowed: false };
  return {
    name: "tiny",
    frame: { luPerUnit: 10, offset: { x: 0, y: 0 }, fileUnit: "um", luPerUm: 10 },
    angleMode: "45",
    stack: [
      { id: 0, name: "F.Cu", role: "signal", active: true, preferDir: "v" },
      { id: 1, name: "B.Cu", role: "signal", active: true, preferDir: "h" },
    ],
    padForms: [viaForm, noAttach, smd],
    parts: [{ id: 0, ref: "U1", package: "p", side: "front", at: { x: 0, y: 0 }, rotationDeg: 0 }],
    pads: [],
    barrels: [],
    tracks: [],
    pours: [],
    fences: [],
    rim: { outline: rect(-500000, -500000, 500000, 500000), cutouts: [], kind: 2 },
    nets: [{ id: 0, name: "A", group: 0, pads: [] }, { id: 1, name: "B", group: 0, pads: [] }],
    netGroups: [{ id: 0, name: "default", nets: [0, 1], trackWidth: 2000, kind: 1, categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 }, viaRule: 0 }],
    spacing,
    viaRules: [{ id: 0, name: "default", forms: [0, 1], entries: [{ form: 0, kind: 1, attach: true }, { form: 1, kind: 1, attach: false }] }],
    pinEdgeToTurnLu: 1000,
    warnings: [],
  };
}

describe("sweepClear edge cases", () => {
  const settings: RouteSettings = { ...DEFAULT_ROUTE_SETTINGS, layers: {}, ignoreNetGroups: [] };

  test("distance equal to the spacing is clear; one LU closer is blocked; same net is exempt", () => {
    const layout = tinyLayout();
    // an other-net Track of width 2000 along y = 0
    const other: Track = { id: 10, net: 1, sheet: 0, pts: [{ x: -50000, y: 0 }, { x: 50000, y: 0 }], width: 2000, kind: 1, hold: "held" };
    (layout.tracks as Track[]).push(other);
    const lattice = buildLattice(layout);
    const profile = resolveProfile(layout, 0, settings);
    const ignore = ignoreOf(0);
    // centre lines 1000 + 2000 + 1000 = 4000 apart → exactly the required 2000 between edges
    const at = (y: number) => sweepClear(layout, lattice, 0, { a: { x: -20000, y }, b: { x: 20000, y } }, profile, ignore);
    expect(at(4000)).toEqual({ ok: true, blocking: [] });
    expect(at(3999)).toEqual({ ok: false, blocking: [10] });
    expect(at(-4000).ok).toBe(true);
    // same net: exempt however close
    expect(sweepClear(layout, lattice, 0, { a: { x: -20000, y: 0 }, b: { x: 20000, y: 0 } }, profile, ignoreOf(1)).ok).toBe(true);
    // in the ignore set: exempt
    expect(sweepClear(layout, lattice, 0, { a: { x: -20000, y: 0 }, b: { x: 20000, y: 0 } }, profile, ignoreOf(0, [10])).ok).toBe(true);
    // other Sheet: nothing there
    expect(at(0).ok).toBe(false);
    expect(sweepClear(layout, lattice, 1, { a: { x: -20000, y: 0 }, b: { x: 20000, y: 0 } }, profile, ignore).ok).toBe(true);
    // a diagonal leg crossing it
    expect(sweepClear(layout, lattice, 0, { a: { x: -10000, y: -10000 }, b: { x: 10000, y: 10000 } }, profile, ignore).blocking).toEqual([10]);
    // pointFree
    expect(pointFree(layout, lattice, 0, { x: 0, y: 4000 }, profile, ignore).ok).toBe(true);
    expect(pointFree(layout, lattice, 0, { x: 0, y: 3999 }, profile, ignore).ok).toBe(false);
    // neck width: a narrower leg fits where the full width does not
    expect(sweepClear(layout, lattice, 0, { a: { x: -20000, y: 3500 }, b: { x: 20000, y: 3500 } }, profile, ignore, 1000).ok).toBe(true);
  });

  test("Kind-null Pads and Pours never block; a net-less Pad blocks every net", () => {
    const layout = tinyLayout();
    (layout.pads as Pad[]).push({ id: 20, part: 0, pinName: "1", net: null, form: 2, at: { x: 0, y: 0 }, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" });
    (layout.pads as Pad[]).push({ id: 21, part: 0, pinName: "2", net: 1, form: 2, at: { x: 100000, y: 0 }, rotationDeg: 0, side: "front", sheets: [0], kind: 0, hold: "locked" });
    (layout.pours as Layout["pours"][number][]).push({ id: 22, net: 1, sheet: 0, outline: rect(-300000, -300000, -100000, -100000), holes: [], kind: 1, hold: "free" });
    const lattice = buildLattice(layout);
    const profile = resolveProfile(layout, 0, settings);
    const ignore = ignoreOf(0);
    expect(sweepClear(layout, lattice, 0, { a: { x: -20000, y: 0 }, b: { x: 20000, y: 0 } }, profile, ignore).blocking).toEqual([20]);
    expect(sweepClear(layout, lattice, 0, { a: { x: 80000, y: 0 }, b: { x: 120000, y: 0 } }, profile, ignore).ok).toBe(true);
    expect(sweepClear(layout, lattice, 0, { a: { x: -250000, y: -200000 }, b: { x: -150000, y: -200000 } }, profile, ignore).ok).toBe(true);
  });

  test("Fences: scope, Kind-null walls and spacing; the Rim and copper-to-edge", () => {
    const layout = tinyLayout();
    const fences = layout.fences as Fence[];
    fences.push({ id: 30, sheet: 0, scope: "track", shape: { kind: "box", box: { x0: 0, y0: 0, x1: 10000, y1: 10000 } }, kind: KIND_NULL });
    const TINY_AREA = 2; // tinyLayout's Kinds are ["", "default", "area"]
    fences.push({ id: 31, sheet: "all-signal", scope: "barrel", shape: { kind: "box", box: { x0: 50000, y0: 0, x1: 60000, y1: 10000 } }, kind: TINY_AREA });
    fences.push({ id: 32, sheet: 1, scope: "place", shape: { kind: "box", box: { x0: 0, y0: 0, x1: 10000, y1: 10000 } }, kind: TINY_AREA });
    fences.push({ id: 33, sheet: 1, scope: "track", shape: { kind: "disk", c: { x: 100000, y: 0 }, r: 5000 }, kind: TINY_AREA });
    // a Fence carrying the Kind of a named class other than area keeps that Kind's spacing (2000 here)
    fences.push({ id: 34, sheet: 1, scope: "track", shape: { kind: "disk", c: { x: -100000, y: 0 }, r: 5000 }, kind: KIND_DEFAULT });
    // a net-owned Fence (SRJ obstacle, Q-I3-25) is exempt for its own net only
    fences.push({ id: 35, sheet: 0, scope: "track", shape: { kind: "box", box: { x0: -300000, y0: 0, x1: -290000, y1: 10000 } }, kind: TINY_AREA, net: 0 });
    const lattice = buildLattice(layout);
    const profile = resolveProfile(layout, 0, settings);
    const ignore = ignoreOf(0);
    // Kind null: touching blocks, 1 LU away is fine
    expect(sweepClear(layout, lattice, 0, { a: { x: -20000, y: -1000 }, b: { x: 20000, y: -1000 } }, profile, ignore).blocking).toEqual([30]);
    expect(sweepClear(layout, lattice, 0, { a: { x: -20000, y: -1001 }, b: { x: 20000, y: -1001 } }, profile, ignore).ok).toBe(true);
    // barrel-scope Fence lets Tracks through but blocks Barrels (on both signal Sheets)
    expect(sweepClear(layout, lattice, 0, { a: { x: 40000, y: 5000 }, b: { x: 70000, y: 5000 } }, profile, ignore).ok).toBe(true);
    expect(barrelFits(layout, lattice, { x: 55000, y: 5000 }, 0, profile, ignore).blocking).toEqual([31]);
    expect(barrelFits(layout, lattice, { x: 55000, y: 5000 }, profile.barrelForms[0]!, profile, ignore).ok).toBe(false);
    // place Fence: nothing
    expect(sweepClear(layout, lattice, 1, { a: { x: -20000, y: 5000 }, b: { x: 20000, y: 5000 } }, profile, ignore).ok).toBe(true);
    // area-Kind Fence keeps spacing(area, default) = 1500: edge at x = 95000, leg end copper at 95000 − 1000 − 1500
    expect(sweepClear(layout, lattice, 1, { a: { x: 50000, y: 0 }, b: { x: 92500, y: 0 } }, profile, ignore).ok).toBe(true);
    expect(sweepClear(layout, lattice, 1, { a: { x: 50000, y: 0 }, b: { x: 92501, y: 0 } }, profile, ignore).blocking).toEqual([33]);
    // default-Kind Fence keeps spacing(default, default) = 2000: edge at x = −95000, leg end copper at −95000 + 1000 + 2000
    expect(sweepClear(layout, lattice, 1, { a: { x: -50000, y: 0 }, b: { x: -92000, y: 0 } }, profile, ignore).ok).toBe(true);
    expect(sweepClear(layout, lattice, 1, { a: { x: -50000, y: 0 }, b: { x: -92001, y: 0 } }, profile, ignore).blocking).toEqual([34]);
    // net-owned Fence: net 0 passes, net 1 is blocked
    expect(sweepClear(layout, lattice, 0, { a: { x: -300000, y: 5000 }, b: { x: -290000, y: 5000 } }, profile, ignore).ok).toBe(true);
    expect(sweepClear(layout, lattice, 0, { a: { x: -300000, y: 5000 }, b: { x: -290000, y: 5000 } }, profile, ignoreOf(1)).blocking).toEqual([35]);
    // Rim: spacing(area, default) = 1500 to the outline at x = 500000
    expect(sweepClear(layout, lattice, 0, { a: { x: 400000, y: 0 }, b: { x: 497500, y: 0 } }, profile, ignore).ok).toBe(true);
    expect(sweepClear(layout, lattice, 0, { a: { x: 400000, y: 0 }, b: { x: 497501, y: 0 } }, profile, ignore).blocking).toEqual([RIM_ID]);
    // copper-to-edge override: 300 µm = 3000 LU
    const edge = resolveProfile(layout, 0, { ...settings, copperToEdgeClearanceUm: 300 });
    expect(edge.edgeClearance).toBe(3000);
    expect(sweepClear(layout, lattice, 0, { a: { x: 400000, y: 0 }, b: { x: 496000, y: 0 } }, edge, ignore).ok).toBe(true);
    expect(sweepClear(layout, lattice, 0, { a: { x: 400000, y: 0 }, b: { x: 496001, y: 0 } }, edge, ignore).blocking).toEqual([RIM_ID]);
  });

  test("DR-11: copper must lie inside the outline and outside cut-outs, near an edge or not", () => {
    const layout = tinyLayout();
    // an L-shaped outline (the square minus its top-right quadrant) with a square cut-out
    (layout as { rim: Layout["rim"] }).rim = {
      outline: [{ x: -500000, y: -500000 }, { x: 500000, y: -500000 }, { x: 500000, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 500000 }, { x: -500000, y: 500000 }],
      cutouts: [rect(-300000, -300000, -200000, -200000)],
      kind: 2,
    };
    const lattice = buildLattice(layout);
    const profile = resolveProfile(layout, 0, settings);
    const ignore = ignoreOf(0);
    const leg = (a: Pt, b: Pt, p = profile) => sweepClear(layout, lattice, 0, { a, b }, p, ignore);
    // far outside the outline, nowhere near an edge
    expect(leg({ x: 200000, y: 200000 }, { x: 300000, y: 300000 })).toEqual({ ok: false, blocking: [RIM_ID] });
    // inside the cut-out
    expect(leg({ x: -280000, y: -250000 }, { x: -220000, y: -250000 })).toEqual({ ok: false, blocking: [RIM_ID] });
    // crossing the outline and crossing a cut-out edge
    expect(leg({ x: -100000, y: 100000 }, { x: 100000, y: 100000 }).blocking).toEqual([RIM_ID]);
    expect(leg({ x: -350000, y: -250000 }, { x: -250000, y: -250000 }).blocking).toEqual([RIM_ID]);
    // inside the board: clear
    expect(leg({ x: -100000, y: 100000 }, { x: -100000, y: 300000 }).ok).toBe(true);
    // the spacing rule still applies: 1500 from the inner corner edges (edge x = 0, copper half-width 1000)
    expect(leg({ x: -2500, y: 100000 }, { x: -2500, y: 300000 }).ok).toBe(true);
    expect(leg({ x: -2499, y: 100000 }, { x: -2499, y: 300000 }).blocking).toEqual([RIM_ID]);
    // with a zero copper-to-edge clearance, touching the outline is still on the board; crossing it is not
    const zero = resolveProfile(layout, 0, { ...settings, copperToEdgeClearanceUm: 0 });
    expect(zero.edgeClearance).toBe(0);
    expect(leg({ x: -1000, y: 100000 }, { x: -1000, y: 300000 }, zero).ok).toBe(true);
    expect(leg({ x: -999, y: 100000 }, { x: -999, y: 300000 }, zero).blocking).toEqual([RIM_ID]);
    // Barrels: in the removed quadrant, in the cut-out, on the board
    expect(barrelFits(layout, lattice, { x: 250000, y: 250000 }, 0, profile, ignore)).toEqual({ ok: false, blocking: [RIM_ID] });
    expect(barrelFits(layout, lattice, { x: -250000, y: -250000 }, 0, profile, ignore)).toEqual({ ok: false, blocking: [RIM_ID] });
    expect(barrelFits(layout, lattice, { x: -250000, y: 250000 }, 0, profile, ignore).ok).toBe(true);
    // a Barrel whose copper crosses the outline with a zero clearance: blocked; touching: clear (3000 radius, edge y = 0)
    expect(barrelFits(layout, lattice, { x: 250000, y: -3000 }, 0, zero, ignore).ok).toBe(true);
    expect(barrelFits(layout, lattice, { x: 250000, y: -2999 }, 0, zero, ignore).blocking).toEqual([RIM_ID]);
    // a Rim with a degenerate outline constrains nothing but its (zero-width) edges' spacing
    (layout as { rim: Layout["rim"] }).rim = { outline: [{ x: 0, y: 0 }, { x: 100000, y: 0 }], cutouts: [], kind: 2 };
    const lattice2 = buildLattice(layout);
    expect(sweepClear(layout, lattice2, 0, { a: { x: 200000, y: 200000 }, b: { x: 300000, y: 300000 } }, profile, ignore).ok).toBe(true);
    expect(sweepClear(layout, lattice2, 0, { a: { x: 20000, y: 2000 }, b: { x: 80000, y: 2000 } }, profile, ignore).blocking).toEqual([RIM_ID]);
  });

  test("barrelFits: attach into a same-net SMD Pad, other-net Pads, hole clearance", () => {
    const layout = tinyLayout();
    (layout.pads as Pad[]).push({ id: 40, part: 0, pinName: "1", net: 0, form: 2, at: { x: 0, y: 0 }, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" });
    (layout.pads as Pad[]).push({ id: 41, part: 0, pinName: "2", net: 1, form: 2, at: { x: 100000, y: 0 }, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" });
    (layout.barrels as Barrel[]).push({ id: 42, net: 1, at: { x: -100000, y: 0 }, form: 0, fromSheet: 0, toSheet: 1, kind: 1, hold: "free" });
    const lattice = buildLattice(layout);
    const profile = resolveProfile(layout, 0, settings);
    const ignore = ignoreOf(0, [40]);
    const attach = profile.barrelForms[0]!, noAttach = profile.barrelForms[1]!;
    expect(attach.attach).toBe(true);
    expect(noAttach.attach).toBe(false);
    // into the own-net SMD Pad: allowed with attach, blocked without
    expect(barrelFits(layout, lattice, { x: 0, y: 0 }, attach, profile, ignore).ok).toBe(true);
    expect(barrelFits(layout, lattice, { x: 0, y: 0 }, noAttach, profile, ignore)).toEqual({ ok: false, blocking: [40] });
    // beside it the no-attach form is fine once the copper no longer touches (5000 + 3000 from the centre; touching counts as overlap)
    expect(barrelFits(layout, lattice, { x: 8001, y: 0 }, noAttach, profile, ignore).ok).toBe(true);
    expect(barrelFits(layout, lattice, { x: 8000, y: 0 }, noAttach, profile, ignore).blocking).toEqual([40]);
    // the other-net Pad: spacing 2000 → centre distance ≥ 5000 + 2000 + 3000 = 10000
    expect(barrelFits(layout, lattice, { x: 90000, y: 0 }, attach, profile, ignore).ok).toBe(true);
    expect(barrelFits(layout, lattice, { x: 90001, y: 0 }, attach, profile, ignore).blocking).toEqual([41]);
    // the other-net Barrel: 3000 + 2000 + 3000 = 8000
    expect(barrelFits(layout, lattice, { x: -92000, y: 0 }, attach, profile, ignore).ok).toBe(true);
    expect(barrelFits(layout, lattice, { x: -92001, y: 0 }, attach, profile, ignore).blocking).toEqual([42]);
    // hole clearance 400 µm (4000 LU): my drill edge (r 1500) to the other-net Barrel copper (r 3000): 1500 + 4000 + 3000 = 8500
    const hole = resolveProfile(layout, 0, { ...settings, holeClearanceUm: 400 });
    expect(hole.holeClearance).toBe(4000);
    expect(barrelFits(layout, lattice, { x: -91500, y: 0 }, attach, hole, ignore).ok).toBe(true);
    expect(barrelFits(layout, lattice, { x: -91501, y: 0 }, attach, hole, ignore).blocking).toEqual([42]);
    // a Track next to an other-net drill: copper edge to drill edge ≥ 4000 → centre line at 1500 + 4000 + 1000 = 6500
    expect(sweepClear(layout, lattice, 0, { a: { x: -120000, y: 6500 }, b: { x: -80000, y: 6500 } }, hole, ignore).ok).toBe(true);
    expect(sweepClear(layout, lattice, 0, { a: { x: -120000, y: 6499 }, b: { x: -80000, y: 6499 } }, hole, ignore).blocking).toEqual([42]);
    // without the setting only the copper spacing applies (3000 + 2000 + 1000 = 6000)
    expect(sweepClear(layout, lattice, 0, { a: { x: -120000, y: 6000 }, b: { x: -80000, y: 6000 } }, profile, ignore).ok).toBe(true);
    expect(sweepClear(layout, lattice, 0, { a: { x: -120000, y: 5999 }, b: { x: -80000, y: 5999 } }, profile, ignore).ok).toBe(false);
    // an unknown PadForm never fits
    expect(barrelFits(layout, lattice, { x: 0, y: 0 }, 99, profile, ignore).ok).toBe(false);
  });

  test("DR-06a: the hole is checked on every Sheet of its span, copper or not, and drill-to-drill on any Sheet", () => {
    const layout = tinyLayout();
    // a form with a through drill (r 2000) but copper on Sheet 0 only; a form with copper and drill on Sheet 1 only
    const forms = layout.padForms as Layout["padForms"][number][];
    forms.push({ id: 3, name: "top-only", perSheet: new Map([[0, [{ kind: "disk" as const, c: { x: 0, y: 0 }, r: 5000 }]]]), drill: { diameter: 4000, fromSheet: 0, toSheet: 1 }, attachAllowed: false });
    forms.push({ id: 4, name: "bottom-only", perSheet: new Map([[1, [{ kind: "disk" as const, c: { x: 0, y: 0 }, r: 3000 }]]]), drill: { diameter: 2000, fromSheet: 1, toSheet: 1 }, attachAllowed: false });
    (layout.pads as Pad[]).push({ id: 50, part: 0, pinName: "1", net: 1, form: 3, at: { x: 0, y: 0 }, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" });
    const lattice = buildLattice(layout);
    const hole = resolveProfile(layout, 0, { ...settings, holeClearanceUm: 400 }); // 4000 LU
    const plain = resolveProfile(layout, 0, settings);
    const ignore = ignoreOf(0);
    // Sheet 1 has no copper of the Pad: a leg there is clear without the setting, and with it must keep 4000 from the hole edge
    const onSheet1 = (y: number, p: Profile) => sweepClear(layout, lattice, 1, { a: { x: -20000, y }, b: { x: 20000, y } }, p, ignore);
    expect(onSheet1(0, plain).ok).toBe(true);
    expect(onSheet1(2000 + 4000 + 1000, hole).ok).toBe(true);
    expect(onSheet1(2000 + 4000 + 999, hole).blocking).toEqual([50]);
    // a Barrel of the bottom-only form on Sheet 1: its copper (r 3000) against the Pad's hole edge there (2000 + 4000 + 3000 = 9000)
    expect(barrelFits(layout, lattice, { x: 9000, y: 0 }, 4, hole, ignore).ok).toBe(true);
    expect(barrelFits(layout, lattice, { x: 8999, y: 0 }, 4, hole, ignore).blocking).toEqual([50]);
    expect(barrelFits(layout, lattice, { x: 8999, y: 0 }, 4, plain, ignore).ok).toBe(true);
    // drill-to-drill regardless of Sheet: shrink the Pad's drill to Sheet 0 only, so the two drills never share a Sheet
    // and the Pad has neither copper nor hole on Sheet 1 (2000 + 4000 + 1000 = 7000 between drill centres)
    forms[3] = { ...forms[3]!, drill: { diameter: 4000, fromSheet: 0, toSheet: 0 } };
    const lattice2 = buildLattice(layout);
    expect(sweepClear(layout, lattice2, 1, { a: { x: -20000, y: 0 }, b: { x: 20000, y: 0 } }, hole, ignore).ok).toBe(true); // no hole on Sheet 1 any more
    expect(barrelFits(layout, lattice2, { x: 7000, y: 0 }, 4, hole, ignore).ok).toBe(true);
    expect(barrelFits(layout, lattice2, { x: 6999, y: 0 }, 4, hole, ignore).blocking).toEqual([50]);
    expect(barrelFits(layout, lattice2, { x: 6999, y: 0 }, 4, plain, ignore).ok).toBe(true);
  });
});

describe("resolveProfile", () => {
  test("width, Kinds, usable Sheets, Barrel candidates, neck width and plane nets", () => {
    const layout = synthLayout({ seed: 1 });
    const settings: RouteSettings = { ...DEFAULT_ROUTE_SETTINGS, layers: {}, ignoreNetGroups: [] };
    const dflt = resolveProfile(layout, 5, settings);
    expect(dflt.width).toBe(2500);
    expect(dflt.halfWidth).toBe(1250);
    expect(dflt.neckWidth).toBe(2500);
    expect(dflt.trackKind).toBe(KIND_DEFAULT);
    expect(dflt.barrelKind).toBe(KIND_DEFAULT);
    expect(dflt.sheets).toEqual([0, 2, 3]); // the plane Sheet is never usable
    expect(dflt.barrelForms.map((c) => c.form)).toEqual([4, 5]);
    expect(dflt.barrelForms[1]).toEqual({ form: 5, kind: KIND_DEFAULT, attach: false, fromSheet: 0, toSheet: 2 });
    expect(dflt.spacingByKind).toEqual([0, 2200, 3000, 1500]); // max over usable Sheets (Sheet 3 raises default-default)
    expect(dflt.maxSpacing).toBe(3000);
    expect(dflt.planeNet).toBe(false);
    expect(dflt.angleMode).toBe("45");
    expect(dflt.holeClearance).toBe(0);
    expect(dflt.edgeClearance).toBeUndefined();

    const power = resolveProfile(layout, 0, settings);
    expect(power.width).toBe(5000);
    expect(power.trackKind).toBe(2);
    expect(power.barrelKind).toBe(2);
    expect(power.sheets).toEqual([0, 3]); // use_layer
    expect(power.barrelForms).toEqual([{ form: 4, kind: 2, attach: true, fromSheet: 0, toSheet: 3 }]);
    expect(power.planeNet).toBe(true);

    const tuned = resolveProfile(layout, 5, { ...settings, neckWidthUm: 150.1, viasAllowed: false, angleMode: "90", layers: { "B.Cu": { active: false } }, holeClearanceUm: 25.05, copperToEdgeClearanceUm: 20 });
    expect(tuned.neckWidth).toBe(1502); // half 750.5 → 751, doubled
    expect(tuned.barrelForms).toEqual([]);
    expect(tuned.angleMode).toBe("90");
    expect(tuned.sheets).toEqual([0, 2]);
    expect(tuned.holeClearance).toBe(252); // 250.5 → 251 → even 252
    expect(tuned.edgeClearance).toBe(200);
    // a neck wider than the width is clamped to the width
    expect(resolveProfile(layout, 5, { ...settings, neckWidthUm: 1000 }).neckWidth).toBe(2500);
    // a net-less connection uses the default group
    expect(resolveProfile(layout, null, settings).width).toBe(2500);
  });

  test("category Kinds and via-definition Kinds are read from the Layout, not from NetGroup.kind", () => {
    const layout = synthLayout({ seed: 1 });
    const settings: RouteSettings = { ...DEFAULT_ROUTE_SETTINGS, layers: {}, ignoreNetGroups: [] };
    const groups = layout.netGroups as Layout["netGroups"][number][];
    groups[0] = { ...groups[0]!, categoryKinds: { track: 3, barrel: 2, pin: 1, smd: 1, area: 1 } };
    const rules = layout.viaRules as Layout["viaRules"][number][];
    // the same PadForm twice under different via definitions is two candidates; an unknown PadForm is dropped
    rules[0] = { id: 0, name: "default", forms: [4, 4, 99, 5], entries: [{ form: 4, kind: 2, attach: true }, { form: 4, kind: 1, attach: false }, { form: 99, kind: 1, attach: false }, { form: 5, kind: 3, attach: true }] };
    const p = resolveProfile(layout, 5, settings);
    expect(p.trackKind).toBe(3);
    expect(p.barrelKind).toBe(2);
    expect(p.spacingByKind).toEqual([0, 1500, 2500, 0]); // row of Kind 3 (area)
    expect(p.barrelForms).toEqual([
      { form: 4, kind: 2, attach: true, fromSheet: 0, toSheet: 3 },
      { form: 4, kind: 1, attach: false, fromSheet: 0, toSheet: 3 },
      { form: 5, kind: 3, attach: true, fromSheet: 0, toSheet: 2 },
    ]);
    // a rule with forms but no entries (a hand-built Layout) falls back to the group's barrel Kind and the PadForm's attach flag
    rules[0] = { id: 0, name: "default", forms: [5, 4], entries: [] };
    expect(resolveProfile(layout, 5, settings).barrelForms).toEqual([
      { form: 5, kind: 2, attach: false, fromSheet: 0, toSheet: 2 },
      { form: 4, kind: 2, attach: true, fromSheet: 0, toSheet: 3 },
    ]);
  });
});
