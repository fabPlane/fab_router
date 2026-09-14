/**
 * Task I13 (M10a) — the coarse global Mesh, Bridge capacities and the congestion report.
 *
 * Capacity is checked against an independent brute-force raster of the same conservative model
 * (fixed-blockage AABBs expanded by `margin = halfWidth + spacing`, projected onto the Bin
 * boundary, `floor(free / pitch)`): the module merges intervals, the oracle marks 1-LU cells, and
 * the two must agree. Also: a boundary a locked Track fully spans has capacity 0; two builds of the
 * same board produce byte-identical capacities across every Bridge; a hand-set overflow shows up in
 * `meshCongestion`; and `route(globalPlan:"off")` is byte-identical to the default run (the M10a
 * safety property — nothing is wired to the Mesh yet, so no acceptance number can move).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Layout, NetGroup, Track } from "../spec/types/layout.ts";
import { makeSpacingTable } from "../src/layout/index.ts";
import { buildLattice } from "../src/lattice/index.ts";
import { buildMesh, meshCongestion } from "../src/route/index.ts";
import { routeDsn } from "../src/api.ts";
import { synthLayout } from "./helpers/synth.ts";

const BOARDS_DIR = new URL("../spec/acceptance/boards/", import.meta.url).pathname;

const WIDTH = 2000, SPACING = 1000;
const PITCH = WIDTH + SPACING;            // 3000
const MARGIN = Math.ceil(WIDTH / 2 + SPACING); // 2000

/** A one-signal-Sheet board over [0,100000]² with the given blockage Tracks and free anchors. */
function board(blockage: Track[]): Layout {
  const spacing = makeSpacingTable(["", "default"], 1, [], (a, b) => (a === 1 && b === 1 ? SPACING : 0));
  const netGroups: NetGroup[] = [{
    id: 0, name: "default", nets: [], trackWidth: WIDTH, kind: 1,
    categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 },
  }];
  // A free (net null) anchor Track pins the board bounding box to [0,100000]²; being free it is
  // congestion, never blockage, so it does not reduce any capacity.
  const anchor: Track = { id: 1, net: null, sheet: 0, pts: [{ x: 0, y: 0 }, { x: 100000, y: 100000 }], width: WIDTH, kind: 1, hold: "free" };
  return {
    name: "mesh-small",
    frame: { luPerUnit: 10, offset: { x: 0, y: 0 }, fileUnit: "um", luPerUm: 10 },
    angleMode: "45",
    stack: [{ id: 0, name: "F.Cu", role: "signal", active: true, preferDir: null }],
    padForms: [], parts: [], pads: [], barrels: [],
    tracks: [anchor, ...blockage],
    pours: [], fences: [], rim: null,
    nets: [], netGroups, spacing, viaRules: [],
    pinEdgeToTurnLu: 0, warnings: [],
  };
}

/** A horizontal locked Track at `y`, x in [x0,x1], of `w` width — a fixed-blockage segment. */
function hLock(id: number, y: number, x0: number, x1: number, w = 1000): Track {
  return { id, net: null, sheet: 0, pts: [{ x: x0, y }, { x: x1, y }], width: w, kind: 1, hold: "locked" };
}
/** A vertical locked Track at `x`, y in [y0,y1], of `w` width. */
function vLock(id: number, x: number, y0: number, y1: number, w = 1000): Track {
  return { id, net: null, sheet: 0, pts: [{ x, y: y0 }, { x, y: y1 }], width: w, kind: 1, hold: "locked" };
}

/**
 * Brute-force capacity of the vertical Bin boundary at x = `c`, y in [a0,a1): mark every 1-LU cell
 * a blockage's AABB (grown by MARGIN) covers when its grown box straddles x = `c`, then count the
 * free cells and divide by the pitch. An independent raster of the module's conservative model.
 */
function bruteVerticalCap(c: number, a0: number, a1: number, blocks: Track[]): number {
  const len = a1 - a0;
  const covered = new Uint8Array(len);
  for (const t of blocks) {
    const hw = t.width / 2;
    const bx0 = Math.min(t.pts[0]!.x, t.pts[1]!.x) - hw - MARGIN, bx1 = Math.max(t.pts[0]!.x, t.pts[1]!.x) + hw + MARGIN;
    const by0 = Math.min(t.pts[0]!.y, t.pts[1]!.y) - hw - MARGIN, by1 = Math.max(t.pts[0]!.y, t.pts[1]!.y) + hw + MARGIN;
    if (bx0 > c || bx1 < c) continue;
    for (let y = Math.max(a0, by0); y < Math.min(a1, by1); y++) covered[y - a0] = 1;
  }
  let free = 0;
  for (let i = 0; i < len; i++) if (!covered[i]) free++;
  return Math.floor(free / PITCH);
}

/** The Bridge id of the East (x) Bridge of Bin (bx,by) on Sheet 0. */
function eastBridge(mesh: ReturnType<typeof buildMesh>, bx: number, by: number): number {
  const bin = mesh.binId(0, bx, by);
  for (const id of mesh.bridgesOf(bin)) {
    const b = mesh.bridge(id);
    if (b.kind === "x" && b.a === bin) return id;
  }
  throw new Error("no east bridge");
}

describe("Mesh geometry and indexing", () => {
  test("bins tile the board box and binOf/centreOf round-trip", () => {
    const mesh = buildMesh(board([]), buildLattice(board([])), { binUm: 1000 });
    expect(mesh.binLu).toBe(10000);
    expect(mesh.nx).toBe(10);
    expect(mesh.ny).toBe(10);
    expect(mesh.sheets).toEqual([0]);
    const id = mesh.binId(0, 3, 4);
    expect(mesh.binAt(id)).toEqual({ id, sheet: 0, bx: 3, by: 4 });
    // A point inside cell (3,4) resolves to it; its centre resolves back to the same Bin.
    expect(mesh.binOf(0, { x: 35000, y: 45000 })).toBe(id);
    expect(mesh.binOf(0, mesh.centreOf(id))).toBe(id);
    // Points outside clamp to the edge Bins.
    expect(mesh.binOf(0, { x: -50, y: 999999 })).toBe(mesh.binId(0, 0, 9));
    // An interior Bin has 4 in-plane Bridges (single Sheet: no via Bridges).
    expect(mesh.bridgesOf(mesh.binId(0, 5, 5))).toHaveLength(4);
    expect(mesh.bridgesOf(mesh.binId(0, 0, 0))).toHaveLength(2);
  });
});

describe("Bridge capacity from fixed blockage (R-2 baked in)", () => {
  test("a clear boundary carries floor(binLu / pitch) tracks", () => {
    const b = board([]);
    const mesh = buildMesh(b, buildLattice(b), { binUm: 1000 });
    const cap = mesh.capacityOf(eastBridge(mesh, 5, 5));
    expect(cap).toBe(Math.floor(10000 / PITCH)); // 3
  });

  test("a partial blockage reduces capacity to the brute-force count", () => {
    const block = [hLock(10, 5000, 8000, 12000)]; // straddles the x=10000 boundary of Bin (0,0)
    const b = board(block);
    const mesh = buildMesh(b, buildLattice(b), { binUm: 1000 });
    const bridge = eastBridge(mesh, 0, 0);
    const expected = bruteVerticalCap(10000, 0, 10000, block);
    expect(expected).toBe(1);
    expect(mesh.capacityOf(bridge)).toBe(expected);
  });

  test("a Track that spans the whole boundary gives capacity 0", () => {
    const block = [vLock(11, 10000, -5000, 15000, 4000)]; // covers all of y∈[0,10000] with margin
    const b = board(block);
    const mesh = buildMesh(b, buildLattice(b), { binUm: 1000 });
    expect(mesh.capacityOf(eastBridge(mesh, 0, 0))).toBe(0);
    expect(bruteVerticalCap(10000, 0, 10000, block)).toBe(0);
  });

  test("free other-net copper does NOT reduce capacity", () => {
    const free: Track = { id: 12, net: null, sheet: 0, pts: [{ x: 8000, y: 5000 }, { x: 12000, y: 5000 }], width: 1000, kind: 1, hold: "free" };
    const b = board([free]);
    const mesh = buildMesh(b, buildLattice(b), { binUm: 1000 });
    // Same geometry as the partial-blockage case, but free ⇒ full capacity.
    expect(mesh.capacityOf(eastBridge(mesh, 0, 0))).toBe(Math.floor(10000 / PITCH));
  });

  test("capacity matches the brute-force count over a swept boundary column", () => {
    const block = [hLock(20, 3000, 5000, 55000), hLock(21, 7000, 0, 25000, 3000)];
    const b = board(block);
    const mesh = buildMesh(b, buildLattice(b), { binUm: 1000 });
    for (let by = 0; by < mesh.ny; by++) {
      const bridge = eastBridge(mesh, 0, by);
      const a0 = by * 10000, a1 = Math.min((by + 1) * 10000, 100000);
      expect(mesh.capacityOf(bridge)).toBe(bruteVerticalCap(10000, a0, a1, block));
    }
  });
});

describe("determinism", () => {
  test("two builds of the same board give identical capacities across every Bridge", () => {
    const layout = synthLayout({ seed: 7 });
    const m1 = buildMesh(layout, buildLattice(layout));
    const m2 = buildMesh(layout, buildLattice(layout));
    expect(m2.bridgeCount).toBe(m1.bridgeCount);
    expect([m1.binLu, m1.nx, m1.ny]).toEqual([m2.binLu, m2.nx, m2.ny]);
    let sum = 0;
    for (let id = 0; id < m1.bridgeCount; id++) {
      const a = m1.capacityOf(id);
      expect(m2.capacityOf(id)).toBe(a);
      sum += a;
    }
    expect(sum).toBeGreaterThan(0); // the arena is not entirely blocked
  });
});

describe("congestion report", () => {
  test("hand-set overflow is summarised per Bridge and per Bin", () => {
    const b = board([]);
    const mesh = buildMesh(b, buildLattice(b), { binUm: 1000 });
    const bridge = eastBridge(mesh, 5, 5);
    const cap = mesh.capacityOf(bridge); // 3
    // No usage yet: nothing over capacity.
    expect(meshCongestion(mesh).totalOverflow).toBe(0);
    mesh.setUsage(bridge, cap + 2);
    const rep = meshCongestion(mesh);
    expect(rep.overCapacity).toBe(1);
    expect(rep.maxOverflow).toBe(2);
    expect(rep.totalOverflow).toBe(2);
    expect(rep.worstBridges[0]!.bridge).toBe(bridge);
    expect(rep.worstBridges[0]!.overflow).toBe(2);
    const { a, b: bb } = mesh.bridge(bridge);
    const bins = rep.worstBins.map((x) => x.bin).sort((p, q) => p - q);
    expect(bins).toEqual([a, bb].sort((p, q) => p - q));
    expect(mesh.overflowOf(bridge)).toBe(2);
  });
});

describe("R-1 safety: globalPlan:\"off\" changes no routing", () => {
  test("routing with globalPlan:\"off\" is byte-identical to the default run", () => {
    const text = readFileSync(BOARDS_DIR + "Issue690-ecc83.dsn", "utf8");
    const base = routeDsn(text, { maxPasses: 100 });
    const off = routeDsn(text, { maxPasses: 100, globalPlan: "off" });
    expect(base.ok && off.ok).toBe(true);
    if (!base.ok || !off.ok) return;
    expect(off.ses).toBe(base.ses);
    expect(off.report.incompleteAfter).toBe(base.report.incompleteAfter);
    expect(off.report.violationsAdded).toBe(base.report.violationsAdded);
    expect(off.report.added).toEqual(base.report.added);
  });
});
