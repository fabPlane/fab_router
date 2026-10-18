import type { Layout } from "../../spec/types/layout.ts";
import { makeSpacingTable } from "../../src/layout/index.ts";

/** Completed two-layer route from an earlier route() call; all dimensions are LU. */
export function ignoredOptimisationBoard(): Layout {
  const disk = { kind: "disk" as const, c: { x: 0, y: 0 }, r: 3000 };
  return {
    name: "ignored-completed-route",
    frame: { luPerUnit: 10, offset: { x: 0, y: 0 }, fileUnit: "um", luPerUm: 10 },
    angleMode: "45",
    stack: [0, 1].map(id => ({ id, name: id ? "B.Cu" : "F.Cu", role: "signal", active: true, preferDir: null })),
    padForms: [
      { id: 0, name: "smd", perSheet: new Map([[0, [disk]]]), attachAllowed: false },
      { id: 1, name: "via", perSheet: new Map([[0, [disk]], [1, [disk]]]), attachAllowed: false,
        drill: { diameter: 2000, fromSheet: 0, toSheet: 1 } },
    ],
    parts: [
      { id: 0, ref: "P1", package: "pad", side: "front", at: { x: -50000, y: 0 }, rotationDeg: 0 },
      { id: 1, ref: "P2", package: "pad", side: "back", at: { x: 50000, y: 0 }, rotationDeg: 0 },
    ],
    pads: [
      { id: 10, part: 0, pinName: "1", net: 0, form: 0, at: { x: -50000, y: 0 }, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" },
      { id: 11, part: 1, pinName: "1", net: 0, form: 0, at: { x: 50000, y: 0 }, rotationDeg: 0, side: "back", sheets: [1], kind: 1, hold: "locked" },
    ],
    tracks: [
      { id: 20, net: 0, sheet: 0, pts: [{ x: -50000, y: 0 }, { x: -30000, y: 20000 }, { x: -20000, y: 20000 }, { x: 0, y: 0 }], width: 2000, kind: 1, hold: "free", origin: "router" },
      { id: 21, net: 0, sheet: 1, pts: [{ x: 0, y: 0 }, { x: 50000, y: 0 }], width: 2000, kind: 1, hold: "free", origin: "router" },
    ],
    barrels: [{ id: 22, net: 0, at: { x: 0, y: 0 }, form: 1, fromSheet: 0, toSheet: 1, kind: 1, hold: "free", origin: "router" }],
    nets: [{ id: 0, name: "KEEP", group: 0, pads: [10, 11] }],
    netGroups: [{ id: 0, name: "preserve", nets: [0], trackWidth: 2000, kind: 1,
      categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 } }],
    spacing: makeSpacingTable(["", "default"], 2, [], () => 0),
    pours: [], fences: [], viaRules: [], pinEdgeToTurnLu: 0, warnings: [],
    rim: { outline: [{ x: -100000, y: -50000 }, { x: 100000, y: -50000 }, { x: 100000, y: 50000 }, { x: -100000, y: 50000 }], cutouts: [], kind: 1 },
  };
}
