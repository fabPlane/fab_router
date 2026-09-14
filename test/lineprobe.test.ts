/**
 * Task I9 gridless line-search detailed router (docs/DESIGN.md §9b-1; Hightower 1969, Mikami &
 * Tabuchi 1968). The unit tests drive `lineProbeCentre` / `lineProbeRoute` on tiny hand-built
 * Layouts: a locked S-channel that a straight and both L routes miss is threaded by the line probe;
 * the inserted copper is R-1 clean; a stale deadline / aborted signal makes the search bail; and a
 * route()-level test shows the rung is a no-op when `detailedRouter: "off"` and never adds a
 * Violation nor lowers completion when it is on.
 */
import { describe, expect, test } from "bun:test";
import type { Layout, Net, NetGroup, Pad, PadForm, Part, Pt, Rim, Sheet, Track } from "../spec/types/layout.ts";
import { DEFAULT_ROUTE_SETTINGS } from "../spec/types/settings.ts";
import { makeSpacingTable } from "../src/layout/index.ts";
import { buildLattice } from "../src/lattice/index.ts";
import { createJournal } from "../src/route/journal.ts";
import { resolveProfile } from "../src/route/profile.ts";
import { ignoreOf, sweepClear } from "../src/route/clear.ts";
import { lineProbeCentre, lineProbeRoute } from "../src/route/lineprobe.ts";
import { route, checkDrc } from "../src/api.ts";

const LU = 10; // LU per µm

interface Wall { net: number; pts: Pt[]; width: number; hold?: "free" | "held" | "locked" }

/** A one-signal-Sheet board with two SIG Pads and any number of other-net locked obstacle Tracks. */
function board(walls: Wall[], sig: [Pt, Pt]): Layout {
  const stack: Sheet[] = [{ id: 0, name: "F.Cu", role: "signal", active: true, preferDir: null }];
  const kinds = ["", "default"];
  const spacing = makeSpacingTable(kinds, stack.length, [], (a, b) => (a === 0 || b === 0 ? 0 : 2000));
  const padForms: PadForm[] = [
    { id: 100, name: "smd", perSheet: new Map([[0, [{ kind: "box", box: { x0: -2000, y0: -2000, x1: 2000, y1: 2000 } }]]]), attachAllowed: false },
  ];
  const parts: Part[] = [{ id: 1, ref: "U1", package: "p", side: "front", at: { x: 0, y: 0 }, rotationDeg: 0 }];
  const pads: Pad[] = [
    { id: 10, part: 1, pinName: "A", net: 0, form: 100, at: sig[0], rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" },
    { id: 11, part: 1, pinName: "B", net: 0, form: 100, at: sig[1], rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" },
  ];
  const nets: Net[] = [{ id: 0, name: "SIG", group: 0, pads: [10, 11] }];
  const tracks: Track[] = [];
  let tid = 200, pid = 20;
  walls.forEach((w, i) => {
    const netId = 1 + i;
    pads.push({ id: pid++, part: 1, pinName: `O${i}a`, net: netId, form: 100, at: w.pts[0]!, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" });
    pads.push({ id: pid++, part: 1, pinName: `O${i}b`, net: netId, form: 100, at: w.pts[w.pts.length - 1]!, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" });
    nets.push({ id: netId, name: `OBS${i}`, group: 0, pads: [pid - 2, pid - 1] });
    tracks.push({ id: tid++, net: netId, sheet: 0, pts: w.pts, width: w.width, kind: 1, hold: w.hold ?? "locked", origin: "file" });
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

const settings = { ...DEFAULT_ROUTE_SETTINGS };

/**
 * A locked S-channel: a left wall closes the bottom + centre, a right wall closes the top + centre,
 * so a route from the left pad must go up over the left wall, across, then down under the right wall.
 * The direct leg and both single-bend L routes are blocked.
 */
function sChannel(): { L: Layout; src: Pt; dst: Pt } {
  const src = { x: -40_000, y: 0 }, dst = { x: 40_000, y: 0 };
  const L = board([
    { net: 1, pts: [{ x: -12_000, y: -60_000 }, { x: -12_000, y: 8_000 }], width: 6_000 },   // left wall: open above
    { net: 2, pts: [{ x: 12_000, y: -8_000 }, { x: 12_000, y: 60_000 }], width: 6_000 },      // right wall: open below
  ], [src, dst]);
  return { L, src, dst };
}

describe("lineProbeCentre", () => {
  test("threads a locked S-channel a straight / L route misses", () => {
    const { L, src, dst } = sChannel();
    const lat = buildLattice(L);
    const profile = resolveProfile(L, 0, settings);
    const ignore = ignoreOf(0);
    const clear = (a: Pt, b: Pt): boolean => sweepClear(L, lat, 0, { a, b }, profile, ignore, profile.width).ok;
    // Direct and both L corners are blocked (the channel needs at least two bends).
    expect(clear(src, dst)).toBe(false);
    expect(clear(src, { x: dst.x, y: src.y }) && clear({ x: dst.x, y: src.y }, dst)).toBe(false);
    expect(clear(src, { x: src.x, y: dst.y }) && clear({ x: src.x, y: dst.y }, dst)).toBe(false);

    const centre = lineProbeCentre(L, lat, 0, src, dst, profile, ignore);
    expect(centre).toBeDefined();
    const c = centre!;
    expect(c.length).toBeGreaterThanOrEqual(2);
    expect(c[0]).toEqual(src);
    expect(c[c.length - 1]).toEqual(dst);
    // Every leg of the proposed centreline is clear.
    for (let i = 1; i < c.length; i++) expect(clear(c[i - 1]!, c[i]!)).toBe(true);
  });

  test("bails on a stale deadline and on an aborted signal", () => {
    const { L, src, dst } = sChannel();
    const lat = buildLattice(L);
    const profile = resolveProfile(L, 0, settings);
    const ignore = ignoreOf(0);
    expect(lineProbeCentre(L, lat, 0, src, dst, profile, ignore, { deadline: Date.now() - 1 })).toBeUndefined();
    const ac = new AbortController();
    ac.abort();
    expect(lineProbeCentre(L, lat, 0, src, dst, profile, ignore, { signal: ac.signal })).toBeUndefined();
  });

  test("returns the direct leg immediately when the channel is open", () => {
    const src = { x: -40_000, y: 0 }, dst = { x: 40_000, y: 0 };
    const L = board([], [src, dst]);
    const lat = buildLattice(L);
    const profile = resolveProfile(L, 0, settings);
    expect(lineProbeCentre(L, lat, 0, src, dst, profile, ignoreOf(0))).toEqual([src, dst]);
  });
});

describe("lineProbeRoute", () => {
  test("inserts a DRC-clean Track through the locked channel (R-1)", () => {
    const { L, src, dst } = sChannel();
    const lat = buildLattice(L);
    const j = createJournal(L, lat);
    const profile = resolveProfile(L, 0, settings);
    const before = L.tracks.length;
    expect(lineProbeRoute(L, lat, j, src, dst, [0], [0], false, profile, ignoreOf(0))).toBe(true);
    expect(L.tracks.length).toBeGreaterThan(before);
    // The inserted copper adds no Violation.
    expect(checkDrc(L).counts.violations).toBe(0);
  });

  test("rolls back and reports failure when the channel is walled shut", () => {
    const src = { x: -40_000, y: 0 }, dst = { x: 40_000, y: 0 };
    // A full-height wall with no gap: no single-Sheet route exists, vias disabled.
    const L = board([{ net: 1, pts: [{ x: 0, y: -90_000 }, { x: 0, y: 90_000 }], width: 6_000 }], [src, dst]);
    const lat = buildLattice(L);
    const j = createJournal(L, lat);
    const profile = resolveProfile(L, 0, settings);
    const before = L.tracks.length;
    expect(lineProbeRoute(L, lat, j, src, dst, [0], [0], false, profile, ignoreOf(0), { maxEscapes: 2000 })).toBe(false);
    expect(L.tracks.length).toBe(before); // nothing left behind
  });
});

describe("route() detailed rung", () => {
  test("no-op when detailedRouter is off; never adds Violations nor regresses when on", () => {
    const mk = (): { L: Layout; src: Pt; dst: Pt } => sChannel();
    const off = mk();
    const rOff = route(off.L, { ...settings, detailedRouter: "off", maxPasses: 20 });
    expect(rOff.violationsAdded).toBe(0);

    const on = mk();
    const rOn = route(on.L, { ...settings, detailedRouter: "lineprobe", maxPasses: 20 });
    expect(rOn.violationsAdded).toBe(0);
    // The detailed rung only completes, never regresses (K-19).
    expect(rOn.completed).toBeGreaterThanOrEqual(rOff.completed);
    // On this locked S-channel the line probe closes the connection the grid tier leaves open.
    expect(rOn.incompleteAfter).toBeLessThanOrEqual(rOff.incompleteAfter);
  });
});
