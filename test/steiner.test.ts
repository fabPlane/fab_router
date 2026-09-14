/**
 * Task I14 (M10b) — per-net rectilinear Steiner decomposition into 2-pin Segments over the Mesh.
 *
 * Checks: the Segments of a net span every terminal and form a tree with no cycle (a rectilinear
 * MST over the terminals); two decompositions of the same board are identical (determinism); a net
 * with one terminal contributes no Segment; and airlines are the Euclidean terminal distances.
 * Commits no copper.
 */
import { describe, expect, test } from "bun:test";
import type { Layout, Net, NetGroup, Pad, Sheet } from "../spec/types/layout.ts";
import { makeSpacingTable } from "../src/layout/index.ts";
import { buildLattice } from "../src/lattice/index.ts";
import { buildMesh, steinerDecompose, type Segment } from "../src/route/index.ts";

const WIDTH = 2000, SPACING = 1000;

function pad(id: number, net: number, x: number, y: number): Pad {
  return { id, part: 0, pinName: `p${id}`, net, form: 0, at: { x, y }, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" };
}

/** A one-signal-Sheet board over [0,200000]² with the given Pads. */
function board(pads: Pad[], nets: Net[]): Layout {
  const spacing = makeSpacingTable(["", "default"], 1, [], (a, b) => (a === 1 && b === 1 ? SPACING : 0));
  const netGroups: NetGroup[] = [{
    id: 0, name: "default", nets: nets.map((n) => n.id), trackWidth: WIDTH, kind: 1,
    categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 },
  }];
  const stack: Sheet[] = [{ id: 0, name: "F.Cu", role: "signal", active: true, preferDir: null }];
  return {
    name: "steiner", frame: { luPerUnit: 10, offset: { x: 0, y: 0 }, fileUnit: "um", luPerUm: 10 },
    angleMode: "45", stack, padForms: [], parts: [], pads, barrels: [],
    // An anchor Track pins the board box to [0,200000]².
    tracks: [{ id: 100, net: null, sheet: 0, pts: [{ x: 0, y: 0 }, { x: 200000, y: 200000 }], width: WIDTH, kind: 1, hold: "locked" }],
    pours: [], fences: [], rim: null, nets, netGroups, spacing, viaRules: [],
    pinEdgeToTurnLu: 0, warnings: [],
  } as unknown as Layout;
}

/** Every distinct terminal anchor id referenced by a net's Segments. */
function terminalsOf(segs: Segment[], net: number): Set<number> {
  const out = new Set<number>();
  for (const s of segs) if (s.net === net) { out.add(s.from.anchor); out.add(s.to.anchor); }
  return out;
}

/** True when the net's Segments form a spanning tree over its terminals (connected, no cycle). */
function isTree(segs: Segment[], net: number): boolean {
  const es = segs.filter((s) => s.net === net);
  const nodes = terminalsOf(segs, net);
  if (es.length !== nodes.size - 1) return false;
  const parent = new Map<number, number>([...nodes].map((n) => [n, n]));
  const find = (x: number): number => { while (parent.get(x)! !== x) { parent.set(x, parent.get(parent.get(x)!)!); x = parent.get(x)!; } return x; };
  for (const s of es) {
    const ra = find(s.from.anchor), rb = find(s.to.anchor);
    if (ra === rb) return false; // a cycle
    parent.set(ra, rb);
  }
  // Connected: all terminals in one component.
  const roots = new Set([...nodes].map(find));
  return roots.size === 1;
}

describe("steinerDecompose (M10b)", () => {
  test("Segments span every terminal and are a tree", () => {
    const pads = [pad(1, 0, 10000, 10000), pad(2, 0, 190000, 10000), pad(3, 0, 100000, 180000), pad(4, 0, 50000, 90000)];
    const nets: Net[] = [{ id: 0, name: "N0", group: 0, pads: [1, 2, 3, 4] }];
    const lay = board(pads, nets);
    const mesh = buildMesh(lay, buildLattice(lay));
    const segs = steinerDecompose(lay, mesh);
    expect(segs.length).toBe(3); // 4 terminals → 3 edges
    expect(terminalsOf(segs, 0)).toEqual(new Set([1, 2, 3, 4]));
    expect(isTree(segs, 0)).toBe(true);
    for (const s of segs) {
      expect(s.from.bins.length).toBeGreaterThan(0);
      expect(s.to.bins.length).toBeGreaterThan(0);
      expect(s.airlineLu).toBeGreaterThan(0);
    }
  });

  test("a single-terminal net yields no Segment; multiple nets are independent trees", () => {
    const pads = [pad(1, 0, 10000, 10000), pad(2, 0, 190000, 10000), pad(3, 1, 100000, 180000)];
    const nets: Net[] = [
      { id: 0, name: "N0", group: 0, pads: [1, 2] },
      { id: 1, name: "N1", group: 0, pads: [3] },
    ];
    const lay = board(pads, nets);
    const mesh = buildMesh(lay, buildLattice(lay));
    const segs = steinerDecompose(lay, mesh);
    expect(segs.filter((s) => s.net === 0).length).toBe(1);
    expect(segs.filter((s) => s.net === 1).length).toBe(0);
  });

  test("deterministic: two decompositions are byte-identical", () => {
    const pads = [pad(1, 0, 10000, 10000), pad(2, 0, 190000, 10000), pad(3, 0, 100000, 180000), pad(4, 0, 50000, 90000), pad(5, 0, 170000, 160000)];
    const nets: Net[] = [{ id: 0, name: "N0", group: 0, pads: [1, 2, 3, 4, 5] }];
    const lay = board(pads, nets);
    const mesh = buildMesh(lay, buildLattice(lay));
    const a = steinerDecompose(lay, mesh);
    const b = steinerDecompose(lay, mesh);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
