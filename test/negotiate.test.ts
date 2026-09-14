/**
 * Task I14 (M10b) — the coarse negotiated global routing loop.
 *
 * Checks: negotiation drives a genuinely congested (but feasible) Mesh to Overflow 0 within the
 * iteration cap; a Mesh with less capacity than demand reports the residual Overflow honestly
 * (never a false 0) with every Segment still realised; layer bias lands an axis-aligned Segment on
 * the Sheet whose preferred direction matches; and two runs are byte-identical (determinism). The
 * negotiation writes only Mesh usage/history and the Plan's Corridors — it commits no copper.
 */
import { describe, expect, test } from "bun:test";
import type { Layout, NetGroup, Sheet, Track } from "../spec/types/layout.ts";
import { makeSpacingTable } from "../src/layout/index.ts";
import { buildLattice } from "../src/lattice/index.ts";
import { buildMesh, negotiate, type Mesh, type Segment, type Terminal } from "../src/route/index.ts";

const WIDTH = 2000, SPACING = 1000; // pitch 3000

/** A board with `sheetCount` signal Sheets over [0,W]×[0,H] and no blockage. */
function board(w: number, h: number, sheetCount: number, blockage: Track[] = []): Layout {
  const spacing = makeSpacingTable(["", "default"], sheetCount, [], (a, b) => (a === 1 && b === 1 ? SPACING : 0));
  const netGroups: NetGroup[] = [{
    id: 0, name: "default", nets: [], trackWidth: WIDTH, kind: 1,
    categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 },
  }];
  const stack: Sheet[] = [];
  for (let i = 0; i < sheetCount; i++) stack.push({ id: i, name: `S${i}`, role: "signal", active: true, preferDir: null });
  const anchor: Track = { id: 1, net: null, sheet: 0, pts: [{ x: 0, y: 0 }, { x: w, y: h }], width: WIDTH, kind: 1, hold: "free" };
  return {
    name: "neg", frame: { luPerUnit: 10, offset: { x: 0, y: 0 }, fileUnit: "um", luPerUm: 10 },
    angleMode: "45", stack, padForms: [], parts: [], pads: [], barrels: [],
    tracks: [anchor, ...blockage], pours: [], fences: [], rim: null,
    nets: [], netGroups, spacing, viaRules: [], pinEdgeToTurnLu: 0, warnings: [],
  } as unknown as Layout;
}

/** A terminal seeded on the given Sheets at the Bin column of (bx,by). */
function term(mesh: Mesh, bx: number, by: number, sheets: number[], anchor: number): Terminal {
  const bins = sheets.map((s) => mesh.binId(s, bx, by)).filter((b) => b >= 0).sort((a, b) => a - b);
  const c = mesh.centreOf(bins[0]!);
  return { point: c, bx, by, sheets, bins, anchor };
}

function seg(id: number, from: Terminal, to: Terminal): Segment {
  const dx = from.point.x - to.point.x, dy = from.point.y - to.point.y;
  return { id, net: id, from, to, airlineLu: Math.sqrt(dx * dx + dy * dy) };
}

describe("negotiate (M10b)", () => {
  test("drives a congested but feasible Mesh to Overflow 0 within the cap", () => {
    // 50×50 grid, bin 6000 LU → capacity floor(6000/3000)=2 per Bridge, no blockage.
    const lay = board(300_000, 300_000, 1);
    const mesh = buildMesh(lay, buildLattice(lay), { binUm: 600 });
    expect(mesh.nx).toBe(50);
    expect(mesh.capacityOf(mesh.bridgesOf(mesh.binId(0, 10, 25))[0]!)).toBe(2);
    // Three Segments between the same two Bins on one row (cap 2) — one must be negotiated aside.
    const a = term(mesh, 0, 25, [0], 1), b = term(mesh, 49, 25, [0], 2);
    const segs = [seg(0, a, b), seg(1, a, b), seg(2, a, b)];
    const plan = negotiate(mesh, segs, { maxIterations: 40 });
    expect(plan.unrealised).toBe(0);
    expect(plan.overflow).toBe(0);
    expect(plan.iterations).toBeLessThanOrEqual(40);
    // Every Corridor is a real Bin run.
    for (const c of plan.corridors) expect(c.bins.length).toBeGreaterThan(1);
  });

  test("reports residual Overflow honestly on an over-capacity Mesh", () => {
    // A one-row Mesh (ny = 1): no detour exists, capacity 1 per Bridge.
    const lay = board(300_000, 4_000, 1);
    const mesh = buildMesh(lay, buildLattice(lay), { binUm: 400 }); // bin 4000 → cap floor(4000/3000)=1
    expect(mesh.ny).toBe(1);
    const a = term(mesh, 0, 0, [0], 1), b = term(mesh, mesh.nx - 1, 0, [0], 2);
    const segs = [seg(0, a, b), seg(1, a, b)]; // both must share every x-Bridge (cap 1)
    const plan = negotiate(mesh, segs, { maxIterations: 20, maxStagnant: 0 });
    expect(plan.unrealised).toBe(0);           // both still realised
    expect(plan.overflow).toBe(mesh.nx - 1);   // every one of the (nx−1) x-Bridges is 2/1
    expect(plan.iterations).toBe(20);          // never converges → runs to the cap (stagnation off)
  });

  test("layer bias lands axis-aligned Segments on the matching Sheet", () => {
    const lay = board(300_000, 300_000, 2);
    const mesh = buildMesh(lay, buildLattice(lay), { binUm: 600 });
    const preferDir: ("h" | "v")[] = ["h", "v"]; // Sheet 0 prefers horizontal, Sheet 1 vertical
    // A horizontal Segment: same row, seeded on both Sheets — must pick the h-Sheet (0).
    const hFrom = term(mesh, 5, 25, [0, 1], 1), hTo = term(mesh, 45, 25, [0, 1], 2);
    const hPlan = negotiate(mesh, [seg(0, hFrom, hTo)], { maxIterations: 10, preferDir });
    expect(hPlan.corridors[0]!.sheet).toBe(0);
    // A vertical Segment: same column — must pick the v-Sheet (1).
    const vFrom = term(mesh, 25, 5, [0, 1], 1), vTo = term(mesh, 25, 45, [0, 1], 2);
    const vPlan = negotiate(mesh, [seg(0, vFrom, vTo)], { maxIterations: 10, preferDir });
    expect(vPlan.corridors[0]!.sheet).toBe(1);
  });

  test("deterministic: two negotiations produce identical Corridors", () => {
    const lay = board(300_000, 300_000, 1);
    const mesh1 = buildMesh(lay, buildLattice(lay), { binUm: 600 });
    const mesh2 = buildMesh(lay, buildLattice(lay), { binUm: 600 });
    const mk = (m: Mesh) => {
      const a = term(m, 0, 25, [0], 1), b = term(m, 49, 25, [0], 2), c = term(m, 5, 5, [0], 3), d = term(m, 40, 44, [0], 4);
      return [seg(0, a, b), seg(1, a, b), seg(2, c, d)];
    };
    const p1 = negotiate(mesh1, mk(mesh1), { maxIterations: 40 });
    const p2 = negotiate(mesh2, mk(mesh2), { maxIterations: 40 });
    expect(JSON.stringify(p1.corridors)).toBe(JSON.stringify(p2.corridors));
    expect(p1.order).toEqual(p2.order);
  });
});
