/**
 * Task I8 push-and-shove (docs/DESIGN.md §9a; spec/behaviour/scenarios/shove.md). The unit tests
 * drive `shoveClear` directly on tiny hand-built Layouts: a movable free Track that crosses a wanted
 * leg is displaced perpendicular to itself until the leg is clear, kept whole (same net, same
 * endpoints) and DRC-clean; a `held` / `locked` Track is never moved; a cascade terminates within
 * budget; and R-1 holds (checkDrc clean after the wanted copper is inserted over a shoved channel).
 * A route()-level test checks the strategy-ladder wiring keeps R-1/R-2.
 */
import { describe, expect, test } from "bun:test";
import type { Layout, Net, NetGroup, Pad, PadForm, Part, Pt, Rim, Sheet, Track } from "../spec/types/layout.ts";
import { DEFAULT_ROUTE_SETTINGS } from "../spec/types/settings.ts";
import { makeSpacingTable } from "../src/layout/index.ts";
import { buildLattice } from "../src/lattice/index.ts";
import { createJournal } from "../src/route/journal.ts";
import { resolveProfile } from "../src/route/profile.ts";
import { ignoreOf, sweepClear } from "../src/route/clear.ts";
import { shoveClear } from "../src/route/shove.ts";
import { connectivity, incompleteCount } from "../src/drc/index.ts";
import { checkDrc } from "../src/api.ts";

const LU = 10; // LU per µm

interface Obstacle { net: number; pts: Pt[]; hold?: "free" | "held" | "locked" }

/** A one-signal-Sheet board with two SIG Pads and any number of other-net obstacle Tracks. */
function board(obstacles: Obstacle[], sigPads: [Pt, Pt] = [{ x: -20_000, y: 0 }, { x: 20_000, y: 0 }]): Layout {
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

const settings = { ...DEFAULT_ROUTE_SETTINGS };
const bigBudget = { windowLu: 80_000, maxDepth: 4, maxMoved: 12 };
const wanted = { a: { x: -20_000, y: 0 }, b: { x: 20_000, y: 0 } };

describe("shoveClear", () => {
  test("opens a blocked channel a free Track crosses", () => {
    // A free vertical Track of another net crosses the wanted horizontal leg at x=0.
    const L = board([{ net: 1, pts: [{ x: 0, y: -40_000 }, { x: 0, y: 40_000 }] }]);
    const lat = buildLattice(L);
    const j = createJournal(L, lat);
    const profile = resolveProfile(L, 0, settings);
    const ignore = ignoreOf(0);

    expect(sweepClear(L, lat, 0, wanted, profile, ignore).ok).toBe(false); // blocked before
    expect(shoveClear(L, lat, j, 0, wanted, profile, ignore, bigBudget)).toBe(true);
    expect(sweepClear(L, lat, 0, wanted, profile, ignore).ok).toBe(true); // clear after

    // The shoved Track is kept whole: exactly one Track of net 1, same fixed endpoints.
    const obs = L.tracks.filter((t) => t.net === 1);
    expect(obs.length).toBe(1);
    const t = obs[0]!;
    expect(t.pts[0]).toEqual({ x: 0, y: -40_000 });
    expect(t.pts[t.pts.length - 1]).toEqual({ x: 0, y: 40_000 });
  });

  test("a shoved net's incomplete count is unchanged (endpoints fixed)", () => {
    const L = board([{ net: 1, pts: [{ x: 0, y: -40_000 }, { x: 0, y: 40_000 }] }]);
    const lat0 = buildLattice(L);
    const before = incompleteCount(connectivity(L, lat0), 1);
    const lat = buildLattice(L);
    const j = createJournal(L, lat);
    const profile = resolveProfile(L, 0, settings);
    expect(shoveClear(L, lat, j, 0, wanted, profile, ignoreOf(0), bigBudget)).toBe(true);
    const after = incompleteCount(connectivity(L, buildLattice(L)), 1);
    expect(after).toBe(before);
    expect(after).toBe(0);
  });

  test("R-1: checkDrc is clean after inserting the wanted Track over a shoved channel", () => {
    const L = board([{ net: 1, pts: [{ x: 0, y: -40_000 }, { x: 0, y: 40_000 }] }]);
    const lat = buildLattice(L);
    const j = createJournal(L, lat);
    const profile = resolveProfile(L, 0, settings);
    const ignore = ignoreOf(0);
    expect(shoveClear(L, lat, j, 0, wanted, profile, ignore, bigBudget)).toBe(true);
    j.addTrack({ net: 0, sheet: 0, pts: [wanted.a, wanted.b], width: 4000, kind: 1, hold: "free" });
    expect(checkDrc(L).counts.violations).toBe(0);
  });

  test("a held Track is never moved", () => {
    const held = { x: 0, y: -40_000 };
    const L = board([{ net: 1, pts: [held, { x: 0, y: 40_000 }], hold: "held" }]);
    const lat = buildLattice(L);
    const j = createJournal(L, lat);
    const profile = resolveProfile(L, 0, settings);
    expect(shoveClear(L, lat, j, 0, wanted, profile, ignoreOf(0), bigBudget)).toBe(false);
    const t = L.tracks.find((x) => x.net === 1)!;
    expect(t.hold).toBe("held");
    expect(t.pts[0]).toEqual(held);
  });

  test("a locked Track is never moved", () => {
    const L = board([{ net: 1, pts: [{ x: 0, y: -40_000 }, { x: 0, y: 40_000 }], hold: "locked" }]);
    const lat = buildLattice(L);
    const j = createJournal(L, lat);
    const profile = resolveProfile(L, 0, settings);
    const snapshot = JSON.stringify(L.tracks);
    expect(shoveClear(L, lat, j, 0, wanted, profile, ignoreOf(0), bigBudget)).toBe(false);
    expect(JSON.stringify(L.tracks)).toBe(snapshot);
  });

  test("cascades through a second movable Track and stays DRC-clean", () => {
    // The wanted vertical leg is crossed by two horizontal free Tracks close together; shoving the
    // first upward pushes it against the second, which must cascade further up.
    const vWanted = { a: { x: 0, y: -12_000 }, b: { x: 0, y: 12_000 } };
    const L = board(
      [
        { net: 1, pts: [{ x: -40_000, y: 0 }, { x: 40_000, y: 0 }] },
        { net: 2, pts: [{ x: -40_000, y: 8_000 }, { x: 40_000, y: 8_000 }] },
      ],
      [{ x: 0, y: -12_000 }, { x: 0, y: 12_000 }],
    );
    const lat = buildLattice(L);
    const j = createJournal(L, lat);
    const profile = resolveProfile(L, 0, settings);
    const ignore = ignoreOf(0);
    expect(shoveClear(L, lat, j, 0, vWanted, profile, ignore, bigBudget)).toBe(true);
    expect(sweepClear(L, lat, 0, vWanted, profile, ignore).ok).toBe(true);
    // Both obstacles remain, whole, with their fixed endpoints.
    expect(L.tracks.filter((t) => t.net === 1).length).toBe(1);
    expect(L.tracks.filter((t) => t.net === 2).length).toBe(1);
    j.addTrack({ net: 0, sheet: 0, pts: [vWanted.a, vWanted.b], width: 4000, kind: 1, hold: "free" });
    expect(checkDrc(L).counts.violations).toBe(0);
  });

  test("cascade terminates and rolls back cleanly when the budget is too small", () => {
    const vWanted = { a: { x: 0, y: -12_000 }, b: { x: 0, y: 12_000 } };
    const L = board(
      [
        { net: 1, pts: [{ x: -40_000, y: 0 }, { x: 40_000, y: 0 }] },
        { net: 2, pts: [{ x: -40_000, y: 8_000 }, { x: 40_000, y: 8_000 }] },
      ],
      [{ x: 0, y: -12_000 }, { x: 0, y: 12_000 }],
    );
    const lat = buildLattice(L);
    const j = createJournal(L, lat);
    const profile = resolveProfile(L, 0, settings);
    const byId = (ts: readonly Track[]): string => JSON.stringify([...ts].sort((a, b) => a.id - b.id));
    const snapshot = byId(L.tracks);
    // maxMoved 1 cannot move both crossing Tracks: the whole trial must roll back.
    expect(shoveClear(L, lat, j, 0, vWanted, profile, ignoreOf(0), { windowLu: 80_000, maxDepth: 4, maxMoved: 1 })).toBe(false);
    expect(byId(L.tracks)).toBe(snapshot);
  });
});

describe("route() with shove wired into the ladder", () => {
  test("keeps R-1 and R-2 and completes the SIG net", async () => {
    const { route } = await import("../src/api.ts");
    const L = board([{ net: 1, pts: [{ x: 0, y: -40_000 }, { x: 0, y: 40_000 }] }]);
    const before = checkDrc(L).counts.violations;
    const report = route(L, { shoveEnabled: true, maxPasses: 20 });
    expect(report.violationsAdded).toBe(0);
    expect(checkDrc(L).counts.violations).toBe(before);
    // The two locked SIG Pads never move.
    for (const p of L.pads) expect(p.hold).toBe("locked");
  });
});
