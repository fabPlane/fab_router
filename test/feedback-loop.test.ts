/**
 * Task I16 (M10d/M10e) — the global↔detailed congestion-feedback loop (`globalPlan:"plan"`).
 *
 * The feedback loop rips the whole board's planned copper each iteration, re-realises every Segment
 * against an escalating-history re-negotiated Plan, and keeps the fewest-incomplete DRC-clean state.
 * The hard guarantees must still hold identically to M9 (the exact `clear.ts` predicate stays the
 * sole gate; a Corridor causes only a miss):
 *   - R-1: `report.violationsAdded === 0` under the loop, at any iteration cap / budget.
 *   - R-2: `held`/`locked` copper is byte-for-byte unmoved.
 *   - determinism: two identical runs produce identical copper.
 *   - termination: the loop always returns under a small iteration cap and a tight budget.
 *   - `globalPlan:"off"` is byte-identical to the default (never enters the M10d/e path).
 *   - keepHistory: re-negotiating with the Mesh's history preserved responds to bumped Bridges.
 */
import { describe, expect, test } from "bun:test";
import type { Layout, Net, NetGroup, Pad, PadForm, Part, Rim, Sheet, Track } from "../spec/types/layout.ts";
import { makeSpacingTable } from "../src/layout/index.ts";
import { route, checkDrc } from "../src/api.ts";
import { buildLattice } from "../src/lattice/index.ts";
import { buildMesh } from "../src/route/mesh.ts";
import { steinerDecompose } from "../src/route/steiner.ts";
import { negotiate } from "../src/route/negotiate.ts";

const LU_PER_UM = 10;

function copperFingerprint(layout: Layout): string {
  const tracks = layout.tracks
    .filter((t) => t.origin === "router")
    .map((t) => `T ${t.net} ${t.sheet} ${t.width} ${t.pts.map((p) => `${p.x},${p.y}`).join(";")}`)
    .sort();
  const barrels = layout.barrels
    .filter((b) => b.origin === "router")
    .map((b) => `B ${b.net} ${b.at.x},${b.at.y} ${b.fromSheet}-${b.toSheet} ${b.form}`)
    .sort();
  return JSON.stringify({ tracks, barrels });
}

function fixedFingerprint(layout: Layout): string {
  return JSON.stringify({
    pads: layout.pads.map((p) => ({ id: p.id, at: p.at, net: p.net, hold: p.hold })),
    rim: layout.rim,
    fixedTracks: layout.tracks
      .filter((t) => t.hold !== "free" || t.origin === "prior")
      .map((t) => ({ id: t.id, net: t.net, pts: t.pts, hold: t.hold })),
  });
}

/** A congested single-Sheet board: same-net L↔R pairs must funnel through one gap in a locked wall. */
function congestedBoard(nets: number): Layout {
  const stack: Sheet[] = [{ id: 0, name: "F.Cu", role: "signal", active: true, preferDir: null }];
  const spacing = makeSpacingTable(["", "default"], stack.length, [], (a, b) => (a === 1 && b === 1 ? 3000 : 0));
  const padForms: PadForm[] = [
    { id: 100, name: "smd", perSheet: new Map([[0, [{ kind: "box", box: { x0: -2000, y0: -2000, x1: 2000, y1: 2000 } }]]]), attachAllowed: false },
  ];
  const wallX = 200_000, gapY0 = 88_000, gapY1 = 112_000, wallW = 8000;
  const tracks: Track[] = [
    { id: 1, net: 900, sheet: 0, pts: [{ x: wallX, y: 0 }, { x: wallX, y: gapY0 }], width: wallW, kind: 1, hold: "locked" },
    { id: 2, net: 900, sheet: 0, pts: [{ x: wallX, y: gapY1 }, { x: wallX, y: 200_000 }], width: wallW, kind: 1, hold: "locked" },
  ];
  const pads: Pad[] = [];
  const nets_: Net[] = [{ id: 900, name: "WALL", group: 0, pads: [] }];
  let pid = 10;
  for (let i = 0; i < nets; i++) {
    const y = 20_000 + i * 20_000;
    const left = pid++, right = pid++;
    pads.push({ id: left, part: 1, pinName: `L${i}`, net: i, form: 100, at: { x: 20_000, y }, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" });
    pads.push({ id: right, part: 2, pinName: `R${i}`, net: i, form: 100, at: { x: 380_000, y }, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" });
    nets_.push({ id: i, name: `N${i}`, group: 0, pads: [left, right] });
  }
  const parts: Part[] = [
    { id: 1, ref: "L", package: "p", side: "front", at: { x: 20_000, y: 100_000 }, rotationDeg: 0 },
    { id: 2, ref: "R", package: "p", side: "front", at: { x: 380_000, y: 100_000 }, rotationDeg: 0 },
  ];
  const netGroups: NetGroup[] = [
    { id: 0, name: "default", nets: nets_.map((n) => n.id), trackWidth: 3000, kind: 1, categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 } },
  ];
  const rim: Rim = { outline: [{ x: 0, y: 0 }, { x: 400_000, y: 0 }, { x: 400_000, y: 200_000 }, { x: 0, y: 200_000 }], cutouts: [], kind: 1 };
  return {
    name: "congested", frame: { luPerUnit: 1, offset: { x: 0, y: 0 }, fileUnit: "um", luPerUm: LU_PER_UM },
    angleMode: "45", stack, padForms, parts, pads, barrels: [], tracks, pours: [], fences: [], rim,
    nets: nets_, netGroups, spacing, viaRules: [], pinEdgeToTurnLu: 0, warnings: [],
  } as unknown as Layout;
}

const OPTS = { viasAllowed: false, maxPasses: 20, timeBudgetMs: 15_000 } as const;

describe("global↔detailed feedback loop (M10e)", () => {
  test("R-1: no violation added under an explicit iteration cap", () => {
    const l = congestedBoard(6);
    const before = checkDrc(l).counts.violations;
    const rep = route(l, { globalPlan: "plan", globalMaxIterations: 4, ...OPTS });
    expect(rep.violationsAdded).toBe(0);
    expect(checkDrc(l).counts.violations).toBe(before);
  });

  test("R-2: locked wall and Pads are byte-for-byte unmoved", () => {
    const l = congestedBoard(6);
    const fixed = fixedFingerprint(l);
    route(l, { globalPlan: "plan", globalMaxIterations: 4, ...OPTS });
    expect(fixedFingerprint(l)).toBe(fixed);
  });

  test("termination: the loop returns under a tight budget and a large iteration cap", () => {
    const l = congestedBoard(8);
    const t0 = Date.now();
    const rep = route(l, { globalPlan: "plan", globalMaxIterations: 1000, timeBudgetMs: 4_000, viasAllowed: false, maxPasses: 20 });
    // The wall-clock budget bounds the loop even with an enormous iteration cap.
    expect(Date.now() - t0).toBeLessThan(20_000);
    expect(rep.violationsAdded).toBe(0);
  });

  test("determinism: two feedback runs produce identical copper", () => {
    const a = congestedBoard(6); route(a, { globalPlan: "plan", globalMaxIterations: 4, ...OPTS });
    const b = congestedBoard(6); route(b, { globalPlan: "plan", globalMaxIterations: 4, ...OPTS });
    expect(copperFingerprint(a)).toBe(copperFingerprint(b));
  });

  test("no regression: feedback loop never completes fewer than the legacy loop", () => {
    const off = congestedBoard(6); route(off, { globalPlan: "off", ...OPTS });
    const plan = congestedBoard(6); route(plan, { globalPlan: "plan", globalMaxIterations: 4, ...OPTS });
    expect(checkDrc(plan).counts.incompletes).toBeLessThanOrEqual(checkDrc(off).counts.incompletes);
  });

  test("globalPlan:'off' is byte-identical to the default", () => {
    const off = congestedBoard(6); route(off, { ...OPTS, globalPlan: "off" });
    const def = congestedBoard(6); route(def, { ...OPTS });
    expect(copperFingerprint(off)).toBe(copperFingerprint(def));
  });
});

describe("negotiate keepHistory (M10e feedback crux)", () => {
  test("preserved history responds to a bumped Bridge; fresh negotiation zeroes it", () => {
    const l = congestedBoard(6);
    const lattice = buildLattice(l);
    const mesh = buildMesh(l, lattice, {});
    const segments = steinerDecompose(l, mesh);
    // A fresh negotiation twice is byte-identical (history zeroed each call).
    const p1 = negotiate(mesh, segments, {});
    const p2 = negotiate(mesh, segments, {});
    expect(p1.corridors.map((c) => c.bins.join(","))).toEqual(p2.corridors.map((c) => c.bins.join(",")));
    // Bump history on some Bridges, then re-negotiate keeping it: the Mesh history is NOT reset, so
    // the accumulated bias survives into the plan (the property M10e relies on).
    for (let b = 0; b < mesh.bridgeCount; b += 7) mesh.addHistory(b, 50);
    const totalBefore = sumHistory(mesh);
    negotiate(mesh, segments, { keepHistory: true });
    expect(sumHistory(mesh)).toBeGreaterThanOrEqual(totalBefore); // preserved (and possibly grown)
    // A fresh (non-keep) negotiation zeroes history at entry.
    negotiate(mesh, segments, {});
    // After a fresh call the only history is what its own iterations accumulated, not the 50-bumps.
    expect(sumHistory(mesh)).toBeLessThan(totalBefore);
  });
});

function sumHistory(mesh: { bridgeCount: number; historyOf(id: number): number }): number {
  let s = 0;
  for (let b = 0; b < mesh.bridgeCount; b++) s += mesh.historyOf(b);
  return s;
}
