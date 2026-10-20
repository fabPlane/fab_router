/**
 * Synthetic Layouts for tests that need a board before the DSN reader lands: a seeded generator
 * producing a 4-Sheet board (two outer signal Sheets, one plane, one inner signal) with Pads of
 * several PadForms on rotated / back-side Parts (one form has a through drill but copper on the
 * outer Sheets only), Barrels of through, blind and disjoint-span forms, Tracks, Pours, Fences of
 * every scope and Kind, and a Rim whose outline has a notch and one cut-out, with a few items
 * deliberately off the board (in the notch, in the cut-out, across the outline) so that DR-11 is
 * exercised. Ids are unique across every item category. Coordinates are LU at 10 LU per µm
 * (0.1 µm), board 50 × 40 mm centred on the origin.
 */
import type {
  Barrel, Fence, Layout, Net, NetGroup, Pad, PadForm, Part, Pour, Pt, Rim, ShapeOnSheet, Sheet, Track,
} from "../../spec/types/layout.ts";
import { makeSpacingTable } from "../../src/layout/index.ts";
import { rotatePt } from "../../src/lattice/index.ts";

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const LU_PER_UM = 10;
export const BOARD_W = 500_000; // 50 mm
export const BOARD_H = 400_000; // 40 mm

export const KIND_NULL = 0, KIND_DEFAULT = 1, KIND_POWER = 2, KIND_AREA = 3;
export const GROUP_DEFAULT = 0, GROUP_POWER = 1;
export const NET_GND = 0;

export interface SynthOptions {
  seed?: number;
  parts?: number;
  tracks?: number;
  barrels?: number;
  /** Angle mode of the generated Tracks: "45" makes octilinear legs, "any" random directions. */
  angleMode?: "45" | "any";
}

export function synthLayout(opts: SynthOptions = {}): Layout {
  const rnd = mulberry32(opts.seed ?? 1);
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  let nextId = 0;
  const id = () => nextId++;

  const stack: Sheet[] = [
    { id: 0, name: "F.Cu", role: "signal", active: true, preferDir: "v" },
    { id: 1, name: "In1.Cu", role: "plane", active: true, preferDir: null, planeNet: NET_GND },
    { id: 2, name: "In2.Cu", role: "signal", active: true, preferDir: "h" },
    { id: 3, name: "B.Cu", role: "signal", active: true, preferDir: "v" },
  ];
  const signal = [0, 2, 3];
  const all = [0, 1, 2, 3];

  const kinds = ["", "default", "power", "area"];
  const base: Record<string, number> = { "1:1": 2000, "1:2": 3000, "2:2": 4000, "1:3": 1500, "2:3": 2500, "3:3": 0 };
  const spacing = makeSpacingTable(kinds, stack.length, [], (a, b, sheet) => {
    if (a === 0 || b === 0) return 0;
    const k = a <= b ? `${a}:${b}` : `${b}:${a}`;
    let v = base[k] ?? 0;
    if (sheet === 3 && a === 1 && b === 1) v = 2200; // one Sheet-dependent value
    return v;
  });

  // ---- PadForms ----
  const disk = (r: number): ShapeOnSheet => ({ kind: "disk", c: { x: 0, y: 0 }, r });
  const box = (w: number, h: number): ShapeOnSheet => ({ kind: "box", box: { x0: -w / 2, y0: -h / 2, x1: w / 2, y1: h / 2 } });
  const octRing = (r: number): ShapeOnSheet => {
    const pts: Pt[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 2 * Math.PI + Math.PI / 8;
      pts.push({ x: Math.round(r * Math.cos(a)), y: Math.round(r * Math.sin(a)) });
    }
    return { kind: "ring", pts };
  };
  const capsule = (len: number, r: number): ShapeOnSheet => ({ kind: "capsule", a: { x: -len / 2, y: 0 }, b: { x: len / 2, y: 0 }, r });
  const perSheet = (sheets: number[], shape: ShapeOnSheet) => new Map(sheets.map((s) => [s, [shape]] as const));
  const padForms: PadForm[] = [
    { id: 0, name: "smd-rect", perSheet: perSheet([0], box(15000, 10000)), attachAllowed: false },
    { id: 1, name: "smd-oct", perSheet: perSheet([0], octRing(7000)), attachAllowed: true },
    { id: 2, name: "th-round", perSheet: perSheet(all, disk(8000)), drill: { diameter: 8000, fromSheet: 0, toSheet: 3 }, attachAllowed: false },
    { id: 3, name: "th-oval", perSheet: perSheet(all, capsule(8000, 6000)), drill: { diameter: 9000, fromSheet: 0, toSheet: 3 }, attachAllowed: false },
    { id: 4, name: "via-through", perSheet: perSheet(all, disk(3000)), drill: { diameter: 3000, fromSheet: 0, toSheet: 3 }, attachAllowed: true },
    { id: 5, name: "via-blind", perSheet: perSheet([0, 1, 2], disk(2500)), drill: { diameter: 2000, fromSheet: 0, toSheet: 2 }, attachAllowed: false },
    { id: 6, name: "smd-path", perSheet: perSheet([0], { kind: "path", pts: [{ x: -6000, y: -3000 }, { x: 0, y: 3000 }, { x: 6000, y: -3000 }], halfWidth: 2000 }), attachAllowed: false },
    // a through drill with copper on the outer Sheets only: the hole alone is on Sheets 1 and 2 (DR-06a)
    { id: 7, name: "th-outer", perSheet: perSheet([0, 3], disk(7000)), drill: { diameter: 7000, fromSheet: 0, toSheet: 3 }, attachAllowed: false },
    // two blind forms with disjoint spans: their drills never share a Sheet (DR-06a drill-to-drill)
    { id: 8, name: "via-top", perSheet: perSheet([0, 1], disk(2500)), drill: { diameter: 2000, fromSheet: 0, toSheet: 1 }, attachAllowed: false },
    { id: 9, name: "via-bottom", perSheet: perSheet([2, 3], disk(2500)), drill: { diameter: 2000, fromSheet: 2, toSheet: 3 }, attachAllowed: false },
  ];

  // ---- nets and groups ----
  const netCount = 12;
  const nets: Net[] = [];
  for (let i = 0; i < netCount; i++) nets.push({ id: i, name: i === NET_GND ? "GND" : `N${i}`, group: i < 3 ? GROUP_POWER : GROUP_DEFAULT, pads: [] });
  const allKinds = (k: number) => ({ track: k, barrel: k, pin: k, smd: k, area: k });
  const netGroups: NetGroup[] = [
    { id: GROUP_DEFAULT, name: "default", nets: nets.filter((n) => n.group === 0).map((n) => n.id), trackWidth: 2500, kind: KIND_DEFAULT, categoryKinds: allKinds(KIND_DEFAULT), viaRule: 0 },
    { id: GROUP_POWER, name: "power", nets: nets.filter((n) => n.group === 1).map((n) => n.id), trackWidth: 5000, kind: KIND_POWER, categoryKinds: allKinds(KIND_POWER), viaRule: 1, usableSheets: [0, 3] },
  ];
  const kindOfNet = (net: number | null) => (net === null ? KIND_DEFAULT : netGroups[nets[net]!.group]!.kind);
  const widthOfNet = (net: number | null) => (net === null ? 2500 : netGroups[nets[net]!.group]!.trackWidth);

  // ---- parts, pads, part-owned hole Fences ----
  const parts: Part[] = [];
  const pads: Pad[] = [];
  const fences: Fence[] = [];
  const partCount = opts.parts ?? 40;
  const rotations = [0, 90, 180, 270, 37.5, 123];
  for (let i = 0; i < partCount; i++) {
    const side = rnd() < 0.3 ? "back" : "front";
    const R = pick(rotations);
    const at: Pt = { x: int(-BOARD_W / 2 + 20000, BOARD_W / 2 - 20000), y: int(-BOARD_H / 2 + 20000, BOARD_H / 2 - 20000) };
    const part: Part = { id: id(), ref: `U${i}`, package: "pkg", side, at, rotationDeg: R };
    parts.push(part);
    const pinCount = int(2, 4);
    const form = pick([0, 1, 2, 3, 6, 7]);
    for (let p = 0; p < pinCount; p++) {
      const off: Pt = { x: (p - (pinCount - 1) / 2) * 20000, y: 0 };
      const m = side === "back" ? { x: -off.x, y: off.y } : off;
      const r = rotatePt(m, R);
      const net = rnd() < 0.15 ? null : int(0, netCount - 1);
      const pf = padForms[form]!;
      const smd = pf.perSheet.size === 1;
      const sheets = smd ? [side === "back" ? 3 : 0] : [...pf.perSheet.keys()].sort((a, b) => a - b);
      const pad: Pad = { id: id(), part: part.id, pinName: `${p + 1}`, net, form, at: { x: at.x + r.x, y: at.y + r.y }, rotationDeg: R, side, sheets, kind: kindOfNet(net), hold: "locked" };
      pads.push(pad);
      if (net !== null) (nets[net]!.pads as number[]).push(pad.id);
    }
    if (rnd() < 0.25) {
      // a mounting hole: a circular track Fence per copper Sheet (KO-07)
      const c: Pt = { x: at.x + 30000, y: at.y };
      for (const s of all) fences.push({ id: id(), sheet: s, scope: "track", shape: { kind: "disk", c, r: 3200 }, kind: KIND_AREA });
    }
  }

  // ---- board-owned Fences ----
  fences.push({ id: id(), sheet: "all-signal", scope: "track", shape: { kind: "box", box: { x0: -240000, y0: 150000, x1: -160000, y1: 190000 } }, kind: KIND_AREA });
  fences.push({ id: id(), sheet: 0, scope: "barrel", shape: { kind: "disk", c: { x: 150000, y: -120000 }, r: 30000 }, kind: KIND_AREA });
  fences.push({ id: id(), sheet: 2, scope: "track", shape: { kind: "ring", pts: [{ x: 100000, y: 100000 }, { x: 200000, y: 100000 }, { x: 200000, y: 140000 }, { x: 150000, y: 120000 }, { x: 100000, y: 140000 }] }, kind: KIND_NULL });
  fences.push({ id: id(), sheet: 3, scope: "place", shape: { kind: "box", box: { x0: -100000, y0: -100000, x1: 100000, y1: 100000 } }, kind: KIND_AREA });
  fences.push({ id: id(), sheet: 0, scope: "track", shape: { kind: "path", pts: [{ x: -200000, y: -150000 }, { x: -150000, y: -100000 }, { x: -100000, y: -150000 }], halfWidth: 1500 }, kind: KIND_AREA });

  // ---- Tracks ----
  const tracks: Track[] = [];
  const trackCount = opts.tracks ?? 120;
  const angleMode = opts.angleMode ?? "45";
  for (let i = 0; i < trackCount; i++) {
    const net = rnd() < 0.05 ? null : int(0, netCount - 1);
    const sheet = pick(signal);
    const n = int(1, 3);
    const pts: Pt[] = [{ x: int(-BOARD_W / 2 + 60000, BOARD_W / 2 - 60000), y: int(-BOARD_H / 2 + 60000, BOARD_H / 2 - 60000) }];
    for (let k = 0; k < n; k++) {
      const prev = pts[pts.length - 1]!;
      const len = int(10000, 40000);
      let dx: number, dy: number;
      if (angleMode === "45") {
        const dir = int(0, 7);
        const dxs = [1, 1, 0, -1, -1, -1, 0, 1], dys = [0, 1, 1, 1, 0, -1, -1, -1];
        dx = dxs[dir]! * len; dy = dys[dir]! * len;
      } else {
        const a = rnd() * 2 * Math.PI;
        dx = Math.round(len * Math.cos(a)); dy = Math.round(len * Math.sin(a));
      }
      pts.push({ x: prev.x + dx, y: prev.y + dy });
    }
    const hold = pick(["free", "free", "held", "locked"] as const);
    tracks.push({ id: id(), net, sheet, pts, width: widthOfNet(net), kind: kindOfNet(net), hold });
  }

  // ---- Barrels ----
  const barrels: Barrel[] = [];
  const barrelCount = opts.barrels ?? 40;
  for (let i = 0; i < barrelCount; i++) {
    const net = rnd() < 0.05 ? null : int(0, netCount - 1);
    const form = rnd() < 0.6 ? 4 : pick([5, 8, 9]);
    const pf = padForms[form]!;
    const sheets = [...pf.perSheet.keys()];
    let at: Pt;
    if (rnd() < 0.15 && pads.length) {
      const pad = pick(pads); // a via dropped onto (or right next to) a Pad
      at = { x: pad.at.x + int(-6000, 6000), y: pad.at.y + int(-6000, 6000) };
    } else {
      at = { x: int(-BOARD_W / 2, BOARD_W / 2), y: int(-BOARD_H / 2, BOARD_H / 2) };
    }
    barrels.push({ id: id(), net, at, form, fromSheet: Math.min(...sheets), toSheet: Math.max(...sheets), kind: kindOfNet(net), hold: pick(["free", "held"] as const) });
  }

  // ---- Pours ----
  const pours: Pour[] = [
    { id: id(), net: NET_GND, sheet: 1, outline: rect(-BOARD_W / 2, -BOARD_H / 2, BOARD_W / 2, BOARD_H / 2), holes: [], kind: KIND_NULL, hold: "locked" },
    { id: id(), net: 5, sheet: 2, outline: rect(-200000, -150000, 0, 0), holes: [rect(-150000, -100000, -100000, -50000)], kind: KIND_DEFAULT, hold: "free" },
  ];

  // The outline is the board rectangle with a 10 × 10 mm notch out of its top-right corner
  // (x > 150000, y > 100000 is off the board) and a 4 × 4 mm cut-out near the middle right.
  const rim: Rim = {
    outline: [
      { x: -BOARD_W / 2, y: -BOARD_H / 2 }, { x: BOARD_W / 2, y: -BOARD_H / 2 }, { x: BOARD_W / 2, y: 100000 },
      { x: 150000, y: 100000 }, { x: 150000, y: BOARD_H / 2 }, { x: -BOARD_W / 2, y: BOARD_H / 2 },
    ],
    cutouts: [rect(180000, 20000, 220000, 60000)],
    kind: KIND_AREA,
  };

  // ---- items deliberately off the board (DR-11) ----
  // a Track inside the cut-out, one inside the notch, one crossing the outline, one crossing a cut-out edge
  tracks.push({ id: id(), net: 4, sheet: 0, pts: [{ x: 190000, y: 30000 }, { x: 210000, y: 50000 }], width: 2500, kind: KIND_DEFAULT, hold: "free" });
  tracks.push({ id: id(), net: 6, sheet: 2, pts: [{ x: 170000, y: 120000 }, { x: 230000, y: 180000 }], width: 2500, kind: KIND_DEFAULT, hold: "free" });
  tracks.push({ id: id(), net: 7, sheet: 3, pts: [{ x: 100000, y: 150000 }, { x: 200000, y: 150000 }], width: 2500, kind: KIND_DEFAULT, hold: "held" });
  tracks.push({ id: id(), net: 8, sheet: 0, pts: [{ x: 160000, y: 40000 }, { x: 200000, y: 40000 }], width: 2500, kind: KIND_DEFAULT, hold: "free" });
  // a Barrel in the notch, one inside the cut-out, one straddling a cut-out edge
  barrels.push({ id: id(), net: 9, at: { x: 200000, y: 150000 }, form: 4, fromSheet: 0, toSheet: 3, kind: KIND_DEFAULT, hold: "free" });
  barrels.push({ id: id(), net: 10, at: { x: 200000, y: 40000 }, form: 5, fromSheet: 0, toSheet: 2, kind: KIND_DEFAULT, hold: "free" });
  barrels.push({ id: id(), net: 11, at: { x: 180000, y: 40000 }, form: 4, fromSheet: 0, toSheet: 3, kind: KIND_DEFAULT, hold: "free" });

  return {
    name: `synth-${opts.seed ?? 1}`,
    frame: { luPerUnit: LU_PER_UM, offset: { x: 0, y: 0 }, fileUnit: "um", luPerUm: LU_PER_UM },
    angleMode,
    stack,
    padForms,
    parts,
    pads,
    barrels,
    tracks,
    pours,
    fences,
    rim,
    nets,
    netGroups,
    spacing,
    viaRules: [
      { id: 0, name: "default", forms: [4, 5], entries: [{ form: 4, kind: KIND_DEFAULT, attach: true }, { form: 5, kind: KIND_DEFAULT, attach: false }] },
      { id: 1, name: "power", forms: [4], entries: [{ form: 4, kind: KIND_POWER, attach: true }] },
    ],
    pinEdgeToTurnLu: 1250,
    warnings: [],
  };
}

export function rect(x0: number, y0: number, x1: number, y1: number): Pt[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}
