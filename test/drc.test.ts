/**
 * DRC, connectivity and statistics (spec/rules/drc.md, spec/rules/connectivity.md,
 * spec/api/contract.md "Checking and measuring").
 *
 * Part 1 — a brute-force oracle: every copper pair on every Sheet of the synthetic boards of
 * test/helpers/synth.ts is compared with `dist2` from src/geom (no Lattice, no exact.ts) under
 * DR-01 … DR-06a and DR-11 (whose predicates come from the router's src/route/clear.ts, the
 * independent statement of ruling Q-I3b-43); the multiset of `(rule, a, b, sheet)` keys must
 * equal `checkDrc`'s, with and without hole / copper-to-edge clearance, in 45° and any-angle mode.
 *
 * Part 2 — hand-built boards for the clauses one at a time: K-01 joins (end in Pad, Track
 * through a Pad, Track crossing a Barrel, coincident Pads), K-03 Pours with thermal-relief holes,
 * K-04 plane Sheets, K-08 dangling stubs, K-09/K-10 counts, K-11 tie-breaking, DR-01 strictness
 * at equality, DR-02 same-net exemption, DR-03 Fence scopes and Kind-null walls, DR-04 counting
 * per Sheet, DR-06 holes, C-15 hole Fences, DR-10 purity, N-07 ignoreNetGroups, and the
 * LayoutStats fields (spans, bends, fanout).
 */
import { describe, expect, test } from "bun:test";
import type { Barrel, Fence, Layout, Pad, PadForm, Pour, Pt, Rim, Track } from "../spec/types/layout.ts";
import type { Violation } from "../spec/types/results.ts";
import type { Shape } from "../src/geom/index.ts";
import { dist2 } from "../src/geom/index.ts";
import type { DrillDisk } from "../src/lattice/index.ts";
import { barrelShapesOn, barrelSheets, drillOfBarrel, drillOfPad, fenceShape, padShapesOn, rimLegCount, rimLegShape, trackLegCount, trackLegShape } from "../src/lattice/index.ts";
import { crossesEdge, withinRim } from "../src/route/index.ts";
import { checkDrc, layoutStats, requiredConnections } from "../src/drc/index.ts";
import { makeSpacingTable } from "../src/layout/index.ts";
import { KIND_NULL, rect, synthLayout } from "./helpers/synth.ts";

// ---- part 1: the brute-force oracle -----------------------------------------------------------

const dist = (a: Shape, b: Shape): number => Math.sqrt(dist2(a, b));
const minDist = (as: readonly Shape[], bs: readonly Shape[]): number => Math.min(...as.flatMap((a) => bs.map((b) => dist(a, b))));
const disk = (d: DrillDisk): Shape => ({ kind: "disk", c: d.c, r: d.r });
const spans = (d: DrillDisk, s: number) => s >= d.fromSheet && s <= d.toSheet;
const sameNet = (a: number | null, b: number | null) => a !== null && b !== null && a === b;

interface Copper { id: number; cat: "pad" | "barrel" | "track"; net: number | null; kind: number; shapes: Shape[]; drill?: DrillDisk; hold: string }

function copperOn(layout: Layout, sheet: number, hc: number): Copper[] {
  const out: Copper[] = [];
  for (const p of layout.pads) {
    const shapes = padShapesOn(layout, p, sheet);
    const d = drillOfPad(layout, p);
    if (shapes.length === 0 && !(d && hc > 0 && spans(d, sheet))) continue;
    out.push(d ? { id: p.id, cat: "pad", net: p.net, kind: p.kind, shapes, drill: d, hold: p.hold } : { id: p.id, cat: "pad", net: p.net, kind: p.kind, shapes, hold: p.hold });
  }
  for (const b of layout.barrels) {
    const shapes = barrelShapesOn(layout, b, sheet);
    const d = drillOfBarrel(layout, b);
    if (shapes.length === 0 && !(d && hc > 0 && spans(d, sheet))) continue;
    out.push(d ? { id: b.id, cat: "barrel", net: b.net, kind: b.kind, shapes, drill: d, hold: b.hold } : { id: b.id, cat: "barrel", net: b.net, kind: b.kind, shapes, hold: b.hold });
  }
  for (const t of layout.tracks) {
    if (t.sheet !== sheet || t.pts.length === 0) continue;
    const shapes: Shape[] = [];
    for (let leg = 0; leg < trackLegCount(t); leg++) shapes.push(trackLegShape(t, leg));
    out.push({ id: t.id, cat: "track", net: t.net, kind: t.kind, shapes, hold: t.hold });
  }
  return out;
}

/** Multiset of violation keys the oracle expects. */
function oracle(layout: Layout, opts: { hc: number; edge?: number }): Map<string, number> {
  const keys = new Map<string, number>();
  const add = (k: string) => keys.set(k, (keys.get(k) ?? 0) + 1);
  const table = layout.spacing;
  const signal = layout.stack.filter((s) => s.role === "signal").map((s) => s.id);
  const rim = layout.rim;
  const rimEdges: Shape[] = [];
  if (rim) for (let e = 0; e < rimLegCount(rim); e++) { const s = rimLegShape(rim, e); if (s) rimEdges.push(s); }
  const holePairs = new Set<string>();
  for (const sheet of layout.stack.map((s) => s.id)) {
    const items = copperOn(layout, sheet, opts.hc);
    for (let i = 0; i < items.length; i++) {
      const a = items[i]!;
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j]!;
        if (sameNet(a.net, b.net)) continue;
        const lo = Math.min(a.id, b.id), hi = Math.max(a.id, b.id);
        if (a.shapes.length && b.shapes.length && a.kind !== 0 && b.kind !== 0) {
          const req = table.get(a.kind, b.kind, sheet);
          if (req > 0 && minDist(a.shapes, b.shapes) < req) add(`spacing:${lo}:${hi}:${sheet}`);
        }
        if (opts.hc > 0) {
          const hc = opts.hc;
          if (b.drill && spans(b.drill, sheet) && a.shapes.length && minDist(a.shapes, [disk(b.drill)]) < hc) holePairs.add(`${b.id}:${a.id}`);
          if (a.drill && spans(a.drill, sheet) && b.shapes.length && minDist(b.shapes, [disk(a.drill)]) < hc) holePairs.add(`${a.id}:${b.id}`);
          if (a.drill && b.drill && dist(disk(a.drill), disk(b.drill)) < hc) holePairs.add(`${lo}:${hi}`);
        }
      }
      if (a.shapes.length === 0) continue;
      // Fences (owner-less in the synthetic boards: checked against Pads too).
      for (const f of layout.fences) {
        const on = f.sheet === "all-signal" ? signal.includes(sheet) : f.sheet === sheet;
        if (!on || f.scope === "place" || (f.scope === "barrel" && a.cat !== "barrel")) continue;
        const fs = fenceShape(f);
        if (f.kind === 0) { if (minDist(a.shapes, fs) <= 0) add(`fence:${a.id}:${sheet}`); continue; }
        if (a.kind === 0) continue;
        const req = table.get(f.kind, a.kind, sheet);
        if (req > 0 && minDist(a.shapes, fs) < req) add(`fence:${a.id}:${sheet}`);
      }
      // Rim: DR-03 spacing, then DR-11 for free Tracks and Barrels.
      if (rim && a.kind !== 0) {
        const req = opts.edge ?? table.get(rim.kind, a.kind, sheet);
        let bad = req > 0 && minDist(a.shapes, rimEdges) < req;
        if (!bad && a.cat !== "pad" && a.hold === "free") {
          for (const e of rimEdges) {
            if (e.kind !== "capsule" && e.kind !== "disk") continue;
            const p = e.kind === "disk" ? e.c : e.a, q = e.kind === "disk" ? e.c : e.b;
            if (a.shapes.some((s) => crossesEdge(s, p, q))) { bad = true; break; }
          }
          if (!bad && !withinRim(rim, a.shapes)) bad = true;
        }
        if (bad) add(`rim:${a.id}:${sheet}`);
      }
    }
  }
  for (const k of holePairs) add(`hole:${k.split(":")[0]}`);
  return keys;
}

function keysOf(vs: readonly Violation[]): Map<string, number> {
  const keys = new Map<string, number>();
  for (const v of vs) {
    const k = v.rule === "spacing" ? `spacing:${Math.min(v.a, v.b as number)}:${Math.max(v.a, v.b as number)}:${v.sheet}`
      : v.rule === "hole" ? `hole:${v.a}` : `${v.rule}:${v.a}:${v.sheet}`;
    keys.set(k, (keys.get(k) ?? 0) + 1);
  }
  return keys;
}

function diffKeys(a: Map<string, number>, b: Map<string, number>): string[] {
  const out: string[] = [];
  for (const [k, n] of a) if (b.get(k) !== n) out.push(`${k} oracle ${n} drc ${b.get(k) ?? 0}`);
  for (const [k, n] of b) if (!a.has(k)) out.push(`${k} oracle 0 drc ${n}`);
  return out;
}

describe("checkDrc against a brute-force oracle", () => {
  const variants: Array<{ name: string; hc: number; edge?: number; um: { holeClearanceUm?: number; copperToEdgeClearanceUm?: number } }> = [
    { name: "file rules", hc: 0, um: {} },
    { name: "hole 250 µm", hc: 2500, um: { holeClearanceUm: 250 } },
    { name: "edge 300 µm", hc: 0, edge: 3000, um: { copperToEdgeClearanceUm: 300 } },
    { name: "hole 250 µm + edge 150.1 µm", hc: 2500, edge: 1502, um: { holeClearanceUm: 250, copperToEdgeClearanceUm: 150.1 } },
  ];
  for (const seed of [1, 2, 3]) {
    for (const angleMode of ["45", "any"] as const) {
      for (const v of variants) {
        test(`seed ${seed} ${angleMode} ${v.name}`, () => {
          const layout = synthLayout({ seed, angleMode });
          const want = oracle(layout, v.hc > 0 || v.edge !== undefined ? { hc: v.hc, ...(v.edge !== undefined ? { edge: v.edge } : {}) } : { hc: 0 });
          const got = checkDrc(layout, v.um);
          expect(diffKeys(want, keysOf(got.violations))).toEqual([]);
          expect(got.counts.violations).toBe(got.violations.length);
          let total = 0;
          for (const n of want.values()) total += n;
          expect(got.violations.length).toBe(total);
          expect(got.violations.length).toBeGreaterThan(20);
          for (const x of got.violations) {
            expect(x.actual).toBeLessThan(Math.max(x.required, 1e-9));
            expect(Number.isInteger(x.at.x) && Number.isInteger(x.at.y)).toBe(true);
          }
        });
      }
    }
  }
});

// ---- part 2: hand-built boards --------------------------------------------------------------

interface Build { pads?: readonly Pad[]; barrels?: readonly Barrel[]; tracks?: readonly Track[]; pours?: readonly Pour[]; fences?: readonly Fence[]; rim?: Rim | null; planeNet?: number; spacing?: number }

const FORM_SMD = 0, FORM_TH = 1, FORM_VIA = 2, FORM_NPTH_SIZED = 3;

/** A two-Sheet board (Sheet 1 optionally a plane) with one net group, Kind 1, spacing 2000 LU, LU = 0.1 µm. */
function board(b: Build): Layout {
  const padForms: PadForm[] = [
    { id: FORM_SMD, name: "smd", perSheet: new Map([[0, [{ kind: "box", box: { x0: -5000, y0: -3000, x1: 5000, y1: 3000 } }]]]), attachAllowed: false },
    { id: FORM_TH, name: "th", perSheet: new Map([[0, [{ kind: "disk", c: { x: 0, y: 0 }, r: 8000 }]], [1, [{ kind: "disk", c: { x: 0, y: 0 }, r: 8000 }]]]), drill: { diameter: 8000, fromSheet: 0, toSheet: 1 }, attachAllowed: false },
    { id: FORM_VIA, name: "via", perSheet: new Map([[0, [{ kind: "disk", c: { x: 0, y: 0 }, r: 4000 }]], [1, [{ kind: "disk", c: { x: 0, y: 0 }, r: 4000 }]]]), drill: { diameter: 4000, fromSheet: 0, toSheet: 1 }, attachAllowed: true },
    { id: FORM_NPTH_SIZED, name: "big", perSheet: new Map([[0, [{ kind: "disk", c: { x: 0, y: 0 }, r: 12000 }]], [1, [{ kind: "disk", c: { x: 0, y: 0 }, r: 12000 }]]]), drill: { diameter: 12000, fromSheet: 0, toSheet: 1 }, attachAllowed: false },
  ];
  const nets = [0, 1, 2].map((i) => ({ id: i, name: `N${i}`, group: i === 2 ? 1 : 0, pads: [] as number[] }));
  for (const p of b.pads ?? []) if (p.net !== null) nets[p.net]!.pads.push(p.id);
  const sp = b.spacing ?? 2000;
  return {
    name: "hand",
    frame: { luPerUnit: 10, offset: { x: 0, y: 0 }, fileUnit: "um", luPerUm: 10 },
    angleMode: "45",
    stack: [
      { id: 0, name: "F.Cu", role: "signal", active: true, preferDir: null },
      b.planeNet !== undefined ? { id: 1, name: "B.Cu", role: "plane", active: true, preferDir: null, planeNet: b.planeNet } : { id: 1, name: "B.Cu", role: "signal", active: true, preferDir: null },
    ],
    padForms,
    parts: [{ id: 0, ref: "U1", package: "pkg", side: "front", at: { x: 0, y: 0 }, rotationDeg: 0 }],
    pads: b.pads ?? [],
    barrels: b.barrels ?? [],
    tracks: b.tracks ?? [],
    pours: b.pours ?? [],
    fences: b.fences ?? [],
    rim: b.rim === undefined ? { outline: rect(-500000, -500000, 500000, 500000), cutouts: [], kind: 1 } : b.rim,
    nets,
    netGroups: [
      { id: 0, name: "default", nets: [0, 1], trackWidth: 2500, kind: 1, categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 } },
      { id: 1, name: "ignored", nets: [2], trackWidth: 2500, kind: 1, categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 } },
    ],
    spacing: makeSpacingTable(["", "default"], 2, [], (a, c) => (a === 0 || c === 0 ? 0 : sp)),
    viaRules: [],
    pinEdgeToTurnLu: 0,
    warnings: [],
  };
}

const pad = (id: number, net: number | null, at: Pt, form = FORM_SMD): Pad => ({
  id, part: 0, pinName: String(id), net, form, at, rotationDeg: 0, side: "front", sheets: form === FORM_SMD ? [0] : [0, 1], kind: 1, hold: "locked",
});
const track = (id: number, net: number | null, pts: Pt[], sheet = 0, width = 2500, hold: Track["hold"] = "free"): Track => ({ id, net, sheet, pts, width, kind: 1, hold });
const barrel = (id: number, net: number | null, at: Pt, form = FORM_VIA, hold: Barrel["hold"] = "free"): Barrel => ({ id, net, at, form, fromSheet: 0, toSheet: 1, kind: 1, hold });
const pour = (id: number, net: number | null, outline: Pt[], holes: Pt[][] = [], sheet = 0, kind = 1): Pour => ({ id, net, sheet, outline, holes, kind, hold: "locked" });

describe("connectivity (K-01 … K-11)", () => {
  test("a Track end inside a Pad and a Track passing through a Pad both join (K-01)", () => {
    const L = board({
      pads: [pad(1, 0, { x: 0, y: 0 }), pad(2, 0, { x: 100000, y: 0 }), pad(3, 0, { x: 50000, y: 0 })],
      tracks: [track(10, 0, [{ x: 0, y: 0 }, { x: 100000, y: 0 }])],
    });
    const s = layoutStats(L);
    expect(s.connections).toEqual({ maximum: 2, incomplete: 0 });
    expect(requiredConnections(L)).toEqual([]);
  });

  test("a Track end on another Track's body and a Track crossing a Barrel join; a gap does not", () => {
    const L = board({
      pads: [pad(1, 0, { x: 0, y: 0 }), pad(2, 0, { x: 200000, y: 200000 }, FORM_TH)],
      tracks: [track(10, 0, [{ x: 0, y: 0 }, { x: 100000, y: 0 }]), track(11, 0, [{ x: 50000, y: 0 }, { x: 50000, y: 100000 }]), track(12, 0, [{ x: 50000, y: 100000 }, { x: 200000, y: 100000 }], 1)],
      barrels: [barrel(20, 0, { x: 50000, y: 60000 })],
    });
    // 10 –(body)– 11 –(via 20 on both Sheets, crossed by 11 on Sheet 0)– hmm: 12 starts where 11 ends but on Sheet 1.
    // 11 crosses Barrel 20 (Sheet 0), 20 reaches Sheet 1, but 12 starts at (50000, 100000) which is 40000 from 20: no join.
    expect(layoutStats(L).connections.incomplete).toBe(1);
    const req = requiredConnections(L);
    expect(req.length).toBe(1);
    expect(req[0]!.net).toBe(0);
    // Move the Barrel onto the Sheet-1 Track: everything joins and the Pad on both Sheets is reached through the through Pad 2? No — 12 ends at 200000,100000, Pad 2 is at 200000,200000.
    const L2: Layout = { ...L, barrels: [barrel(20, 0, { x: 50000, y: 100000 })], tracks: [...L.tracks, track(13, 0, [{ x: 200000, y: 100000 }, { x: 200000, y: 200000 }], 1)] };
    expect(layoutStats(L2).connections.incomplete).toBe(0);
  });

  test("two coincident same-net Pads join and are not a violation (DR-02)", () => {
    const L = board({ pads: [pad(1, 0, { x: 0, y: 0 }), pad(2, 0, { x: 0, y: 0 }), pad(3, 1, { x: 0, y: 0 })] });
    const d = checkDrc(L);
    expect(d.counts.incompletes).toBe(0);
    // Pad 3 (net 1) overlaps both: two spacing violations on Sheet 0 (DR-04: per pair per Sheet).
    expect(d.violations.map((v) => `${v.rule}:${v.a}:${v.b}:${v.sheet}`).sort()).toEqual(["spacing:1:3:0", "spacing:2:3:0"]);
    expect(d.violations.every((v) => v.actual === 0 && v.required === 2000)).toBe(true);
  });

  test("a Pour joins what overlaps its filled area, not what lies in a hole (K-03)", () => {
    const relief = rect(-9000, -9000, 9000, 9000);
    const L = board({
      pads: [pad(1, 0, { x: 0, y: 0 }), pad(2, 0, { x: 200000, y: 0 }), pad(3, 0, { x: 400000, y: 0 })],
      pours: [pour(30, 0, rect(-100000, -100000, 300000, 100000), [relief])],
      tracks: [track(10, 0, [{ x: -4000, y: 0 }, { x: -50000, y: 0 }])], // a thermal spoke from Pad 1 into the copper
    });
    // Pad 1 sits in the relief hole but its spoke Track reaches the fill; Pad 2 is in the fill; Pad 3 is outside the Pour.
    const s = layoutStats(L);
    expect(s.connections).toEqual({ maximum: 3, incomplete: 1 });
    const req = requiredConnections(L);
    expect(req.length).toBe(1);
    expect([req[0]!.from, req[0]!.to]).toEqual([3, 30]); // Pad 3 to the nearest Pour vertex (K-11 anchors)
    expect(req[0]!.airlineLu).toBeCloseTo(Math.SQRT2 * 100000, 6);
    // Without the spoke, Pad 1 is isolated in its hole.
    const L2: Layout = { ...L, tracks: [] };
    expect(layoutStats(L2).connections.incomplete).toBe(2);
    // Touching the hole's rim counts as contact (boundary contact included).
    const L3: Layout = { ...L, tracks: [track(10, 0, [{ x: 0, y: 0 }, { x: 7750, y: 0 }])] };
    expect(layoutStats(L3).connections.incomplete).toBe(1);
    const L4: Layout = { ...L, tracks: [track(10, 0, [{ x: 0, y: 0 }, { x: 7749, y: 0 }])] };
    expect(layoutStats(L4).connections.incomplete).toBe(2);
    const L5: Layout = { ...L, tracks: [] };
    expect(layoutStats(L5).connections.incomplete).toBe(2);
  });

  test("a plane Sheet's Pour joins every same-net Barrel and through Pad reaching it (K-04); other nets pass freely (K-05)", () => {
    const L = board({
      planeNet: 0,
      pads: [pad(1, 0, { x: 0, y: 0 }, FORM_TH), pad(2, 0, { x: 300000, y: 0 }), pad(3, 1, { x: 100000, y: 100000 }, FORM_TH)],
      pours: [pour(30, 0, rect(-500000, -500000, 500000, 500000), [], 1, KIND_NULL)],
      tracks: [track(10, 0, [{ x: 300000, y: 0 }, { x: 300000, y: 50000 }])],
      barrels: [barrel(20, 0, { x: 300000, y: 50000 })],
    });
    const d = checkDrc(L);
    expect(d.counts.incompletes).toBe(0);
    expect(d.counts.violations).toBe(0);
    const s = layoutStats(L);
    expect(s.fanout).toEqual({ smdPads: 1, escaped: 1, viaEscaped: 1 });
  });

  test("dangling stubs are not terminal components (K-08) and Barrels count as anchors (K-11)", () => {
    const L = board({
      pads: [pad(1, 0, { x: 0, y: 0 }), pad(2, 0, { x: 300000, y: 0 })],
      tracks: [track(10, 0, [{ x: 100000, y: 100000 }, { x: 150000, y: 100000 }])],
      barrels: [barrel(20, 0, { x: 200000, y: 200000 })],
    });
    const s = layoutStats(L);
    expect(s.connections).toEqual({ maximum: 1, incomplete: 1 });
    const req = requiredConnections(L);
    expect(req).toEqual([{ net: 0, from: 1, to: 2, airlineLu: 300000 }]);
  });

  test("Kruskal picks the shortest edges and breaks ties by the lower id pair (K-11)", () => {
    // Four isolated Pads on a square: two equal shortest sides in x, two in y; expect a tree of three edges.
    const L = board({ pads: [pad(1, 0, { x: 0, y: 0 }), pad(2, 0, { x: 100000, y: 0 }), pad(3, 0, { x: 0, y: 100000 }), pad(4, 0, { x: 100000, y: 100000 })] });
    const req = requiredConnections(L);
    expect(req.map((c) => [c.from, c.to])).toEqual([[1, 2], [1, 3], [2, 4]]);
    expect(req.every((c) => c.airlineLu === 100000)).toBe(true);
    expect(checkDrc(L).incompletes).toEqual(req);
  });

  test("ignoreNetGroups drops a group's nets from both connection counts (N-07)", () => {
    const L = board({ pads: [pad(1, 2, { x: 0, y: 0 }), pad(2, 2, { x: 100000, y: 0 }), pad(3, 0, { x: 0, y: 200000 }), pad(4, 0, { x: 100000, y: 200000 })] });
    expect(layoutStats(L).connections).toEqual({ maximum: 2, incomplete: 2 });
    expect(layoutStats(L, { ignoreNetGroups: ["ignored"] }).connections).toEqual({ maximum: 1, incomplete: 1 });
    expect(checkDrc(L, { ignoreNetGroups: ["ignored"] }).counts.incompletes).toBe(1);
    expect(requiredConnections(L).length).toBe(2);
  });
});

describe("clearance (DR-01 … DR-11)", () => {
  test("distance equal to the spacing is not a violation; one LU less is (DR-01, DR-07)", () => {
    const at = (gap: number): Layout => board({ pads: [pad(1, 0, { x: 0, y: 0 }), pad(2, 1, { x: 10000 + gap, y: 0 })] });
    expect(checkDrc(at(2000)).counts.violations).toBe(0);
    const d = checkDrc(at(1999));
    expect(d.counts.violations).toBe(1);
    expect(d.violations[0]).toMatchObject({ a: 1, b: 2, sheet: 0, rule: "spacing", required: 2000, actual: 1999 });
    expect(d.violations[0]!.at.x).toBeGreaterThan(5000);
    expect(d.violations[0]!.at.x).toBeLessThan(6999);
    expect(Math.abs(d.violations[0]!.at.y)).toBeLessThanOrEqual(3000);
    expect(layoutStats(at(1999)).violations).toEqual({ total: 1, byRule: { spacing: 1 } });
  });

  test("a Track–Track pair is one Violation per Sheet however many legs; a through pair counts per Sheet (DR-04)", () => {
    const L = board({
      tracks: [track(10, 0, [{ x: 0, y: 0 }, { x: 100000, y: 0 }, { x: 100000, y: 100000 }]), track(11, 1, [{ x: 0, y: 3000 }, { x: 100000, y: 3000 }, { x: 103000, y: 100000 }])],
      pads: [pad(1, 0, { x: -200000, y: 0 }, FORM_TH), pad(2, 1, { x: -200000, y: 17000 }, FORM_TH)],
    });
    const d = checkDrc(L);
    const keys = d.violations.map((v) => `${v.a}:${v.b}:${v.sheet}`).sort();
    expect(keys).toEqual(["1:2:0", "1:2:1", "10:11:0"].sort());
  });

  test("Fences by scope, Kind-null walls, and no Pad check against a Part's own hole Fences (DR-03, KO-01, KO-05)", () => {
    const fences: Fence[] = [
      { id: 40, sheet: 0, scope: "track", shape: { kind: "box", box: { x0: 0, y0: 0, x1: 50000, y1: 50000 } }, kind: 1 },
      { id: 41, sheet: 0, scope: "barrel", shape: { kind: "box", box: { x0: 100000, y0: 0, x1: 150000, y1: 50000 } }, kind: 1 },
      { id: 42, sheet: 0, scope: "place", shape: { kind: "box", box: { x0: 200000, y0: 0, x1: 250000, y1: 50000 } }, kind: 1 },
      { id: 43, sheet: 0, scope: "track", shape: { kind: "box", box: { x0: 300000, y0: 0, x1: 350000, y1: 50000 } }, kind: KIND_NULL },
    ];
    const L = board({
      fences,
      tracks: [
        track(10, 0, [{ x: -20000, y: 25000 }, { x: -3000, y: 25000 }]),   // 1750 from Fence 40: violation (< 2000)
        track(15, 0, [{ x: -20000, y: 45000 }, { x: -3250, y: 45000 }]),   // exactly 2000 from Fence 40: clear
        track(11, 0, [{ x: 100000, y: 25000 }, { x: 150000, y: 25000 }]),  // inside a barrel Fence: no
        track(12, 0, [{ x: 200000, y: 25000 }, { x: 250000, y: 25000 }]),  // inside a place Fence: no
        track(13, 0, [{ x: 280000, y: 25000 }, { x: 298750, y: 25000 }]),  // touches the Kind-null wall: violation
        track(14, 0, [{ x: 280000, y: 60000 }, { x: 298749, y: 60000 }]),  // 1 LU short of the wall: no
      ],
      barrels: [barrel(20, 0, { x: 125000, y: 25000 }), barrel(21, 0, { x: 225000, y: 25000 })],
    });
    const d = checkDrc(L);
    expect(d.violations.map((v) => `${v.rule}:${v.a}:${String(v.b)}`).sort()).toEqual(["fence:10:fence", "fence:13:fence", "fence:20:fence"]);
    expect(d.violations.find((v) => v.a === 10)).toMatchObject({ required: 2000, actual: 1750 });
    expect(d.violations.find((v) => v.a === 13)).toMatchObject({ required: 0, actual: 0 });
  });

  test("a Part-owned hole Fence is checked against Pads only with holeClearanceUm, at max(value, spacing) (C-15, KO-07)", () => {
    const hole: Fence & { owner: string } = { id: 40, sheet: 0, scope: "track", shape: { kind: "disk", c: { x: 0, y: 0 }, r: 5000 }, kind: 1, owner: "part" };
    const L = board({ fences: [hole], pads: [pad(1, 0, { x: 12200, y: 0 })], tracks: [track(10, 0, [{ x: 0, y: 7200 }, { x: 50000, y: 7200 }])] });
    // Pad copper starts at x = 7200: 2200 LU from the hole edge; the Track's edge is 950 LU away.
    expect(checkDrc(L).violations.map((v) => `${v.rule}:${v.a}`)).toEqual(["fence:10"]);
    const d = checkDrc(L, { holeClearanceUm: 250 });
    expect(d.violations.map((v) => `${v.rule}:${v.a}`).sort()).toEqual(["fence:1", "fence:10"]);
    expect(d.violations.find((v) => v.a === 1)).toMatchObject({ required: 2500, actual: 2200 });
  });

  test("hole clearance: drill against other-net copper on every Sheet of its span and drill to drill (DR-06, DR-06a)", () => {
    const L = board({
      pads: [pad(1, 0, { x: 0, y: 0 }, FORM_TH), pad(2, 1, { x: 30000, y: 0 })],
      tracks: [track(10, 1, [{ x: 0, y: 6000 }, { x: 50000, y: 6000 }], 1)], // Sheet 1, 750 LU from the drill edge of Pad 1
      barrels: [barrel(20, 1, { x: 0, y: 7500 }, FORM_VIA)],                 // drill 1500 LU from Pad 1's drill
    });
    expect(checkDrc(L).violations.map((v) => `${v.rule}:${v.a}:${v.b}:${v.sheet}`).sort()).toEqual(["spacing:1:10:1", "spacing:1:20:0", "spacing:1:20:1"]);
    const d = checkDrc(L, { holeClearanceUm: 250 });
    const holes = d.violations.filter((v) => v.rule === "hole").map((v) => `${v.a}:${v.b}`).sort();
    expect(holes).toEqual(["1:hole", "1:hole", "20:hole"]);
    expect(d.violations.filter((v) => v.rule === "hole").every((v) => v.required === 2500 && v.actual < 2500)).toBe(true);
    expect(layoutStats(L).violations.byRule).toEqual({ spacing: 3 });
  });

  test("copper-to-edge: the Rim polylines, the setting's override, and DR-11 for free copper only", () => {
    const rim: Rim = { outline: rect(-100000, -100000, 100000, 100000), cutouts: [rect(20000, 20000, 40000, 40000)], kind: 1 };
    const L = board({
      rim,
      tracks: [
        track(10, 0, [{ x: -50000, y: 96750 }, { x: 50000, y: 96750 }]),            // 2000 from the outline: clear
        track(11, 0, [{ x: -50000, y: 96751 }, { x: 50000, y: 96751 }]),            // 1999: rim
        track(12, 0, [{ x: 150000, y: 0 }, { x: 180000, y: 0 }]),                    // wholly off the board, free: rim (DR-11)
        track(13, 0, [{ x: 150000, y: 50000 }, { x: 180000, y: 50000 }], 0, 2500, "held"), // off the board but held: not checked
        track(14, 0, [{ x: 25000, y: 30000 }, { x: 35000, y: 30000 }], 1),           // inside the cut-out, free: rim
      ],
      barrels: [barrel(20, 0, { x: 150000, y: -50000 }), barrel(21, 0, { x: 30000, y: 30000 }, FORM_VIA, "held")],
    });
    const d = checkDrc(L);
    expect(d.violations.map((v) => `${v.rule}:${v.a}:${v.sheet}`).sort()).toEqual(["rim:11:0", "rim:12:0", "rim:14:1", "rim:20:0", "rim:20:1"]);
    const e = checkDrc(L, { copperToEdgeClearanceUm: 100 });
    expect(e.violations.map((v) => `${v.rule}:${v.a}:${v.sheet}`).sort()).toEqual(["rim:12:0", "rim:14:1", "rim:20:0", "rim:20:1"]);
    expect(e.violations.every((v) => v.required === 1000)).toBe(true);
  });

  test("Pours are never part of a Violation and Kind-null items never push copper (K-05, C-01)", () => {
    const L = board({
      pours: [pour(30, 1, rect(-100000, -100000, 100000, 100000))],
      pads: [pad(1, 0, { x: 0, y: 0 }), { ...pad(2, 1, { x: 10500, y: 0 }), kind: 0 }],
      tracks: [track(10, 0, [{ x: -50000, y: 50000 }, { x: 50000, y: 50000 }])],
    });
    expect(checkDrc(L).counts.violations).toBe(0);
  });

  test("checkDrc is pure and deterministic (DR-10)", () => {
    const L = synthLayout({ seed: 7 });
    const snapshot = JSON.stringify(L);
    const a = checkDrc(L, { holeClearanceUm: 200 });
    const b = checkDrc(L, { holeClearanceUm: 200 });
    expect(JSON.stringify(L)).toBe(snapshot);
    expect(a).toEqual(b);
    expect(a.violations.length).toBeGreaterThan(0);
  });
});

describe("layoutStats", () => {
  test("Barrel spans, Track geometry and fanout", () => {
    const L = board({
      pads: [pad(1, 0, { x: 0, y: 0 }), pad(2, 0, { x: 200000, y: 200000 }), pad(3, 1, { x: -100000, y: 0 }), pad(4, null, { x: -200000, y: 0 })],
      tracks: [
        track(10, 0, [{ x: 0, y: 0 }, { x: 100000, y: 0 }, { x: 100000, y: 100000 }, { x: 200000, y: 200000 }]), // 90° then 45° bends
        track(11, 1, [{ x: -100000, y: 0 }, { x: -100000, y: 50000 }, { x: -90000, y: 100000 }]),                // an "other" bend
      ],
      barrels: [barrel(20, 0, { x: 200000, y: 200000 })],
    });
    const s = layoutStats(L);
    expect(s.items).toEqual({ pads: 4, barrels: 1, tracks: 2, pours: 0, fences: 0 });
    expect(s.barrels).toEqual({ total: 1, through: 1, blind: 0, buried: 0 });
    expect(s.tracks.legs).toBe(5);
    expect(s.tracks.bends90).toBe(1);
    expect(s.tracks.bends45).toBe(1);
    expect(s.tracks.bendsOther).toBe(1);
    expect(s.tracks.totalLengthLu).toBeCloseTo(100000 + 100000 + Math.SQRT2 * 100000 + 50000 + Math.hypot(10000, 50000), 6);
    expect(s.tracks.totalLengthMm).toBeCloseTo(s.tracks.totalLengthLu / 10000, 9);
    expect(s.connections).toEqual({ maximum: 1, incomplete: 0 });
    // Pads 1, 2, 3 are SMD with a net; all touch a Track; 2 touches the Barrel and 1 reaches it through one Track.
    expect(s.fanout).toEqual({ smdPads: 3, escaped: 3, viaEscaped: 2 });
  });

  test("blind and buried spans follow the PadForm (V-01)", () => {
    const L = synthLayout({ seed: 2 });
    const s = layoutStats(L);
    const byForm = (id: number) => L.barrels.filter((b) => b.form === id).length;
    expect(s.barrels.through).toBe(byForm(4) + byForm(7));
    expect(s.barrels.blind).toBe(byForm(5) + byForm(8) + byForm(9));
    expect(s.barrels.total).toBe(L.barrels.length);
    expect(s.violations.total).toBe(checkDrc(L).counts.violations);
    expect(s.connections.incomplete).toBe(checkDrc(L).counts.incompletes);
  });

  test("the empty Layout", () => {
    const L = board({});
    expect(layoutStats(L)).toEqual({
      items: { pads: 0, barrels: 0, tracks: 0, pours: 0, fences: 0 },
      connections: { maximum: 0, incomplete: 0 },
      barrels: { total: 0, through: 0, blind: 0, buried: 0 },
      tracks: { totalLengthLu: 0, totalLengthMm: 0, legs: 0, bends90: 0, bends45: 0, bendsOther: 0 },
      violations: { total: 0, byRule: {} },
      fanout: { smdPads: 0, escaped: 0, viaEscaped: 0 },
    });
  });
});

