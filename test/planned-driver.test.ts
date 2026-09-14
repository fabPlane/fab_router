/**
 * Task I15 (M10c) — the corridor-guided planned driver (`globalPlan:"plan"`).
 *
 * The planned driver realises a negotiated global Plan through the *unchanged* detailed path, so the
 * hard guarantees must hold identically to M9:
 *   - R-1: `report.violationsAdded === 0` and no DRC violation is added — the Corridor only feeds
 *     `region`/`stepCost`; the exact `sweepClear`/`barrelFits` predicate stays the sole gate, so a
 *     Corridor can cause a miss, never a Violation (docs/DESIGN.md §10.5).
 *   - R-2: `held`/`locked`/Prior copper is byte-for-byte unmoved.
 *   - determinism: two `globalPlan:"plan"` runs produce identical copper.
 *   - no regression: `globalPlan:"plan"` never completes fewer connections than the legacy loop
 *     (the planned driver keeps the better of the two trials — docs/DESIGN.md §10.4).
 *   - `globalPlan:"off"` is byte-identical to the default (it never enters the M10c code path), so
 *     the fast tier is unaffected (the 401-case fast acceptance tier confirms the wider invariance).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import type { Layout, Net, NetGroup, Pad, PadForm, Part, Pt, Rim, Sheet, Track } from "../spec/types/layout.ts";
import { makeSpacingTable } from "../src/layout/index.ts";
import { readDsn, route, checkDrc } from "../src/api.ts";

const LU_PER_UM = 10;

/** Fingerprint the router-inserted copper (Tracks + Barrels), order-independent and deterministic. */
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

/** Fingerprint the fixed items that R-2 forbids the router from moving. */
function fixedFingerprint(layout: Layout): string {
  const fixedTracks = layout.tracks
    .filter((t) => t.hold !== "free" || t.origin === "prior")
    .map((t) => ({ id: t.id, net: t.net, sheet: t.sheet, w: t.width, pts: t.pts, hold: t.hold, origin: t.origin }));
  const fixedBarrels = layout.barrels
    .filter((b) => b.hold !== "free" || b.origin === "prior")
    .map((b) => ({ id: b.id, net: b.net, at: b.at, form: b.form, hold: b.hold, origin: b.origin }));
  return JSON.stringify({
    pads: layout.pads.map((p) => ({ id: p.id, at: p.at, net: p.net, hold: p.hold })),
    pours: layout.pours.map((p) => ({ id: p.id, outline: p.outline, net: p.net })),
    rim: layout.rim,
    fixedTracks, fixedBarrels,
  });
}

function incompleteAfter(layout: Layout): number {
  return checkDrc(layout).counts.incompletes;
}

/**
 * A deliberately congested single-Sheet board: a locked copper wall runs down the middle with one
 * gap, and `nets` same-net left↔right Pad pairs at spread heights must all cross through that one
 * gap. With vias off and the wall locked, they funnel and contend — a few complete, the rest stay
 * incomplete, which forces the planned driver's negotiation, corridor-guided routing and whole-net
 * rip-reroute to actually run and to insert corridor-guided copper through the exact predicate (fast).
 */
function congestedBoard(nets: number): Layout {
  const stack: Sheet[] = [{ id: 0, name: "F.Cu", role: "signal", active: true, preferDir: null }];
  const spacing = makeSpacingTable(["", "default"], stack.length, [], (a, b) => (a === 1 && b === 1 ? 3000 : 0));
  const padForms: PadForm[] = [
    { id: 100, name: "smd", perSheet: new Map([[0, [{ kind: "box", box: { x0: -2000, y0: -2000, x1: 2000, y1: 2000 } }]]]), attachAllowed: false },
  ];
  const wallX = 200_000, gapY0 = 88_000, gapY1 = 112_000, wallW = 8000;
  // A locked vertical wall with one ~24 000 LU gap at y∈[88 000,112 000] (fits a few 3 000 tracks).
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

const SLOW = { maxPasses: 30, timeBudgetMs: 20_000 } as const;

describe("planned driver (M10c) — congested synthetic board", () => {
  test("R-1: globalPlan:'plan' adds no violation and never bypasses the predicate", () => {
    const l = congestedBoard(6);
    const before = checkDrc(l).counts.violations;
    const rep = route(l, { globalPlan: "plan", viasAllowed: false, ...SLOW });
    expect(rep.violationsAdded).toBe(0);
    expect(checkDrc(l).counts.violations).toBe(before);
    // The board is congested but not empty: the planned driver realises at least one Segment through
    // the gap, so the corridor-guided insertion path (region + stepCost) is genuinely exercised.
    expect(l.tracks.filter((t) => t.origin === "router").length).toBeGreaterThan(0);
    expect(rep.incompleteAfter).toBeGreaterThan(0);
  });

  test("R-2: locked wall and Pads are byte-for-byte unmoved", () => {
    const l = congestedBoard(6);
    const fixed = fixedFingerprint(l);
    route(l, { globalPlan: "plan", viasAllowed: false, ...SLOW });
    expect(fixedFingerprint(l)).toBe(fixed);
  });

  test("determinism: two planned runs produce identical copper", () => {
    const a = congestedBoard(6); route(a, { globalPlan: "plan", viasAllowed: false, ...SLOW });
    const b = congestedBoard(6); route(b, { globalPlan: "plan", viasAllowed: false, ...SLOW });
    expect(copperFingerprint(a)).toBe(copperFingerprint(b));
  });

  test("no regression: planned completes at least as much as the legacy loop", () => {
    const off = congestedBoard(6); route(off, { globalPlan: "off", viasAllowed: false, ...SLOW });
    const plan = congestedBoard(6); route(plan, { globalPlan: "plan", viasAllowed: false, ...SLOW });
    expect(incompleteAfter(plan)).toBeLessThanOrEqual(incompleteAfter(off));
  });
});

const DIR = "spec/acceptance/boards/";
function load(board: string): Layout | undefined {
  const path = DIR + board;
  if (!existsSync(path)) return undefined;
  const r = readDsn(readFileSync(path, "utf8"), { name: board });
  return r.ok ? r.layout : undefined;
}

// A handful of small real boards: the planned driver must be R-1-clean, deterministic, and never
// regress on real DSN too, and `globalPlan:"off"` must reproduce the default byte-for-byte.
const REAL = [
  "Issue269-min_fr_test-min_fr_test.dsn",
  "Issue143-rpi_splitter.dsn",
  "Issue270-non-ansi_bracket.dsn",
];

describe("planned driver (M10c) — real boards", () => {
  for (const board of REAL) {
    test(`${board}: R-1, no regression, and off == default`, () => {
      const l = load(board);
      if (!l) return; // board absent in this checkout: skip
      const opts = { maxPasses: 20, timeBudgetMs: 15_000 } as const;

      const off = load(board)!; const offRep = route(off, { globalPlan: "off", ...opts });
      const def = load(board)!; route(def, { ...opts });
      // globalPlan:"off" is byte-identical to the default (never enters the M10c path).
      expect(copperFingerprint(off)).toBe(copperFingerprint(def));

      const plan = load(board)!; const planRep = route(plan, { globalPlan: "plan", ...opts });
      expect(planRep.violationsAdded).toBe(0);
      expect(incompleteAfter(plan)).toBeLessThanOrEqual(incompleteAfter(off));
      void offRep;

      const plan2 = load(board)!; route(plan2, { globalPlan: "plan", ...opts });
      expect(copperFingerprint(plan)).toBe(copperFingerprint(plan2));
    });
  }
});
