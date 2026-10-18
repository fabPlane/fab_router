/**
 * Minimized fan-controller J2-small geometry: 13 pads and three retained vias; no tracks/zones.
 * Derived from the MIT-licensed board; see ../fixtures/pad-escape/LICENSE.
 * Only SIG is routed. Other copper is locked and remains an obstacle.
 */
import type { Layout, PadForm, ShapeOnSheet } from "../../spec/types/layout.ts";
import { makeSpacingTable } from "../../src/layout/index.ts";

export function padEscapeBoard(reverse = false): Layout {
  const disk = (r: number): ShapeOnSheet => ({ kind: "disk", c: { x: 0, y: 0 }, r });
  const roundForm = (id: number, r: number, drill: number): PadForm => ({
    id, name: `round-${id}`, perSheet: new Map([[0, [disk(r)]], [1, [disk(r)]]]),
    drill: { diameter: drill, fromSheet: 0, toSheet: 1 }, attachAllowed: false,
  });
  const padForms: PadForm[] = [
    roundForm(0, 5080, 4572), roundForm(3, 8890, 8002), roundForm(4, 10000, 9000),
    { id: 6, name: "smd", perSheet: new Map([[0, [{ kind: "box", box: { x0: -2000, y0: -8750, x1: 2000, y1: 8750 } }]]]), attachAllowed: false },
    roundForm(16, 3000, 4000),
  ];
  // id, x, y, form, back-side. All coordinates relative to the through-hole terminal.
  const positions = [
    [8, 0, 0, 4, 0], [12, 0, -145000, 4, 0], [42, 75000, -8100, 3, 0],
    [46, 105000, -85000, 0, 0], [47, 90000, -100000, 0, 0], [48, 105000, -100000, 0, 0],
    [56, 20000, -130000, 0, 0], [65, 237250, -196000, 6, 1], [66, 230750, -196000, 6, 1],
    [67, 224250, -196000, 6, 1], [90, 224250, -124000, 6, 1],
    [91, 230750, -124000, 6, 1], [92, 237250, -124000, 6, 1],
  ];
  const pads = positions.map(([id, x, y, form, back]) => ({
    id: reverse ? id === 8 ? 66 : id === 66 ? 8 : id! : id!,
    part: 1, pinName: String(id), net: id === 8 || id === 66 ? 0 : 1, form: form!,
    at: { x: x!, y: y! }, rotationDeg: 0, side: back ? "back" as const : "front" as const,
    sheets: back ? [1] : [0, 1], kind: 1, hold: "locked" as const,
  }));
  const kinds = ["", "default", "edge"];
  const categoryKinds = { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 };
  return {
    name: "pad-escape", frame: { luPerUnit: 10, offset: { x: 0, y: 0 }, fileUnit: "um", luPerUm: 10 },
    angleMode: "45", stack: [
      { id: 0, name: "F.Cu", role: "signal", active: true, preferDir: null },
      { id: 1, name: "B.Cu", role: "signal", active: true, preferDir: null },
    ], padForms, parts: [{ id: 1, ref: "U1", package: "test", side: "front", at: { x: 0, y: 0 }, rotationDeg: 0 }], pads,
    barrels: [[368, 127000, -73000], [376, 201000, -168000], [379, 100000, -22000]].map(([id, x, y]) => ({
      id: id!, net: 1, at: { x: x!, y: y! }, form: 16, fromSheet: 0, toSheet: 1, kind: 1, hold: "locked", origin: "file",
    })), tracks: [], pours: [], fences: [],
    rim: { outline: [{ x: -105000, y: -260000 }, { x: 495000, y: -260000 }, { x: 495000, y: 110000 }, { x: -105000, y: 110000 }], cutouts: [], kind: 2 },
    nets: [
      { id: 0, name: "SIG", group: 0, pads: [8, 66] },
      { id: 1, name: "OTHER", group: 1, pads: pads.filter(p => p.net === 1).map(p => p.id) },
    ], netGroups: [
      { id: 0, name: "signal", nets: [0], trackWidth: 2500, kind: 1, categoryKinds, viaRule: 0 },
      { id: 1, name: "obstacles", nets: [1], trackWidth: 2500, kind: 1, categoryKinds, viaRule: 0 },
    ], spacing: makeSpacingTable(kinds, 2, [], (a, b) => a === 0 || b === 0 ? 0 : a === 2 || b === 2 ? 5000 : 2000),
    viaRules: [{ id: 0, name: "default", forms: [16], entries: [{ form: 16, kind: 1, attach: false }] }],
    pinEdgeToTurnLu: 0, warnings: [],
  };
}
