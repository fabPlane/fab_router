import type { Layout, Net, NetGroup, Pad, PadForm, Part, Pt, Rim, Sheet, Track } from "../../spec/types/layout.ts";
import { makeSpacingTable } from "../../src/layout/index.ts";
const LU = 10; // LU per µm

interface Obstacle { net: number; pts: Pt[]; hold?: "free" | "held" | "locked" }

/** A one-signal-Sheet board with two SIG Pads and any number of other-net obstacle Tracks. */
export function board(obstacles: Obstacle[], sigPads: [Pt, Pt] = [{ x: -20_000, y: 0 }, { x: 20_000, y: 0 }]): Layout {
  const stack: Sheet[] = [{ id: 0, name: "F.Cu", role: "signal", active: true, preferDir: null }];
  const kinds = ["", "default"];
  const spacing = makeSpacingTable(kinds, stack.length, [], (a, b) => (a === 0 || b === 0 ? 0 : 2000));
  const padForms: PadForm[] = [
    { id: 100, name: "smd", perSheet: new Map([[0, [{ kind: "box", box: { x0: -2000, y0: -2000, x1: 2000, y1: 2000 } }]]]), attachAllowed: false },
  ];
  const parts: Part[] = [{ id: 1, ref: "U1", package: "p", side: "front", at: { x: 0, y: 0 }, rotationDeg: 0 }];
  const pads: Pad[] = [
    { id: 10, part: 1, pinName: "A", net: 0, form: 100, at: sigPads[0], rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" },
    { id: 11, part: 1, pinName: "B", net: 0, form: 100, at: sigPads[1], rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" },
  ];
  const nets: Net[] = [{ id: 0, name: "SIG", group: 0, pads: [10, 11] }];
  const tracks: Track[] = [];
  let tid = 200, pid = 20;
  obstacles.forEach((o, i) => {
    const netId = 1 + i;
    // Pads at the obstacle endpoints so the obstacle net has a real, complete connection.
    pads.push({ id: pid++, part: 1, pinName: `O${i}a`, net: netId, form: 100, at: o.pts[0]!, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" });
    pads.push({ id: pid++, part: 1, pinName: `O${i}b`, net: netId, form: 100, at: o.pts[o.pts.length - 1]!, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" });
    nets.push({ id: netId, name: `OBS${i}`, group: 0, pads: [pid - 2, pid - 1] });
    tracks.push({ id: tid++, net: netId, sheet: 0, pts: o.pts, width: 4000, kind: 1, hold: o.hold ?? "free", origin: "file" });
  });
  const netGroups: NetGroup[] = [
    { id: 0, name: "default", nets: nets.map((n) => n.id), trackWidth: 4000, kind: 1, categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 } },
  ];
  const rim: Rim = { outline: [{ x: -100_000, y: -100_000 }, { x: 100_000, y: -100_000 }, { x: 100_000, y: 100_000 }, { x: -100_000, y: 100_000 }], cutouts: [], kind: 1 };
  return {
    name: "t", frame: { luPerUnit: 1, offset: { x: 0, y: 0 }, fileUnit: "um", luPerUm: LU },
    angleMode: "any", stack, padForms, parts, pads, barrels: [], tracks, pours: [], fences: [], rim,
    nets, netGroups, spacing, viaRules: [], pinEdgeToTurnLu: 0, warnings: [],
  };
}

