import type { Layout, Net, NetGroup, Pad, PadForm, Part, Pt, Rim, Sheet, Track } from "../../spec/types/layout.ts";
import { makeSpacingTable } from "../../src/layout/index.ts";
const LU_PER_UM = 10;

/** A one-signal-Sheet board with two same-net Pads and a rectangular Rim; optional obstacle Pads. */
export function board(opts: { gap?: number; obstacle?: Pt } = {}): Layout {
  const stack: Sheet[] = [{ id: 0, name: "F.Cu", role: "signal", active: true, preferDir: null }];
  const kinds = ["", "default"];
  const spacing = makeSpacingTable(kinds, stack.length, [], (a, b) => (a === 0 || b === 0 ? 0 : 2000));
  const padForms: PadForm[] = [
    { id: 100, name: "smd", perSheet: new Map([[0, [{ kind: "box", box: { x0: -5000, y0: -5000, x1: 5000, y1: 5000 } }]]]), attachAllowed: false },
  ];
  const gap = opts.gap ?? 200_000;
  const parts: Part[] = [
    { id: 1, ref: "U1", package: "p", side: "front", at: { x: -gap / 2, y: 0 }, rotationDeg: 0 },
    { id: 2, ref: "U2", package: "p", side: "front", at: { x: gap / 2, y: 0 }, rotationDeg: 0 },
  ];
  const pads: Pad[] = [
    { id: 10, part: 1, pinName: "A", net: 0, form: 100, at: { x: -gap / 2, y: 0 }, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" },
    { id: 11, part: 2, pinName: "B", net: 0, form: 100, at: { x: gap / 2, y: 0 }, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" },
  ];
  if (opts.obstacle) {
    pads.push({ id: 12, part: 2, pinName: "X", net: 1, form: 100, at: opts.obstacle, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" });
  }
  const nets: Net[] = [
    { id: 0, name: "SIG", group: 0, pads: [10, 11] },
    { id: 1, name: "OTHER", group: 0, pads: opts.obstacle ? [12] : [] },
  ];
  const netGroups: NetGroup[] = [
    { id: 0, name: "default", nets: [0, 1], trackWidth: 4000, kind: 1, categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 } },
  ];
  const rim: Rim = { outline: [{ x: -400_000, y: -200_000 }, { x: 400_000, y: -200_000 }, { x: 400_000, y: 200_000 }, { x: -400_000, y: 200_000 }], cutouts: [], kind: 1 };
  return {
    name: "t", frame: { luPerUnit: 1, offset: { x: 0, y: 0 }, fileUnit: "um", luPerUm: LU_PER_UM },
    angleMode: "45", stack, padForms, parts, pads, barrels: [], tracks: [], pours: [], fences: [], rim,
    nets, netGroups, spacing, viaRules: [], pinEdgeToTurnLu: 0, warnings: [],
  };
}

export function fanoutBoard(attachAllowed = false): Layout {
  const L = board();
  L.stack = [...L.stack, { ...L.stack[0]!, id: 1, name: "B.Cu" }];
  L.padForms = [...L.padForms, { id: 101, name: "via", attachAllowed,
    perSheet: new Map([0, 1].map(s => [s, [{ kind: "disk" as const, c: { x: 0, y: 0 }, r: 3000 }]])) }];
  L.viaRules = [{ id: 0, name: "default", forms: [101], entries: [] }];
  return L;
}

/** First pad needs a stub; the later pad's net permits a directly attached via. */
export function mixedFanoutBoard(): Layout {
  const L = fanoutBoard();
  L.pads = L.pads.map(p => p.id === 11 ? { ...p, net: 1 } : p);
  L.nets = L.nets.map(n => ({ ...n, group: n.id, pads: [n.id === 0 ? 10 : 11] }));
  L.netGroups = [
    { ...L.netGroups[0]!, nets: [0], viaRule: 0 },
    { ...L.netGroups[0]!, id: 1, name: "attach", nets: [1], viaRule: 1 },
  ];
  L.viaRules = [...L.viaRules, { id: 1, name: "attach", forms: [101], entries: [{ form: 101, kind: 1, attach: true }] }];
  return L;
}
