import { expect, test } from "bun:test";
import { route, checkDrc } from "../src/api.ts";
import { board } from "./helpers/ignored-routing.ts";

for (const detailedNegotiation of [false, true]) for (const shoveEnabled of [false, true]) {
  test(`routing preserves ignored obstacle records (detailed=${detailedNegotiation}, shove=${shoveEnabled})`, () => {
    const L = board([{ net: 1, pts: [{ x: 0, y: -96_000 }, { x: 0, y: 96_000 }] }]);
    L.nets[1]!.group = 1;
    L.netGroups = [...L.netGroups, { ...L.netGroups[0]!, id: 1, name: "protected", nets: [1] }];
    const before = structuredClone([...L.tracks]);
    const report = route(L, { detailedNegotiation, ignoreNetGroups: ["protected"], maxPasses: 3,
      maxStagnantPasses: 0, shoveEnabled, shoveWindowUm: 8000,
      optimizerEnabled: false, viasAllowed: false });
    expect(L.tracks.filter(t => t.net === 1)).toEqual(before);
    expect(report.incompleteAfter).toBe(1); // the fixed wall remains an obstacle
    expect(report.violationsAdded).toBe(0);
    expect(checkDrc(L).counts.violations).toBe(0);
  });
}

test("unignored free obstacle can still move to complete routing", () => {
  const L = board([{ net: 1, pts: [{ x: 0, y: -96_000 }, { x: 0, y: 96_000 }] }]);
  const report = route(L, { maxPasses: 3, maxStagnantPasses: 0, shoveEnabled: true,
    shoveWindowUm: 8000, optimizerEnabled: false, viasAllowed: false });
  expect(report.incompleteAfter).toBe(0);
  expect(report.violationsAdded).toBe(0);
  expect(L.tracks.some(t => t.id === 200)).toBe(false);
});

// Test the shared victim policy as well as the public strategy ladder. Ignoring a net
// protects its free vias too; it must not make geometry invisible to clearance checks.
import { buildLattice } from "../src/lattice/index.ts";
import { isRippable } from "../src/route/ripup.ts";
import { nudgeClear } from "../src/route/nudge.ts";
import { shoveClear } from "../src/route/shove.ts";
import { createJournal } from "../src/route/journal.ts";
import { resolveProfile } from "../src/route/profile.ts";
import { ignoreOf } from "../src/route/clear.ts";
import { DEFAULT_ROUTE_SETTINGS } from "../spec/types/settings.ts";

test("ignored free tracks and vias are hard obstacles, with unignored controls", () => {
  const L = board([{ net: 1, pts: [{ x: 0, y: -40_000 }, { x: 0, y: 40_000 }] }]);
  L.padForms = [...L.padForms, { id: 101, name: "via", perSheet: new Map([[0, [{ kind: "disk", c: { x: 0, y: 0 }, r: 2000 }]]]), attachAllowed: false }];
  L.barrels = [...L.barrels, { id: 201, net: 1, at: { x: 0, y: 60_000 }, form: 101,
    fromSheet: 0, toSheet: 0, kind: 1, hold: "free", origin: "file" }];
  const lat = buildLattice(L);
  for (const id of [200, 201]) {
    expect(isRippable(L, lat, id, 0)).toBe(true);
    expect(isRippable(L, lat, id, 0, new Set([1]))).toBe(false);
    expect(isRippable(L, lat, id, 0, new Set([2]))).toBe(true);
  }
});

test("nudge rejects an ignored victim before calling the rerouter", () => {
  const L = board([{ net: 1, pts: [{ x: 0, y: -40_000 }, { x: 0, y: 40_000 }] }]);
  const lat = buildLattice(L), journal = createJournal(L, lat);
  const snapshot = structuredClone([...L.tracks]);
  let calls = 0;
  expect(nudgeClear(L, lat, journal, 0, { a: { x: -20_000, y: 0 }, b: { x: 20_000, y: 0 } },
    resolveProfile(L, 0, DEFAULT_ROUTE_SETTINGS), ignoreOf(0), () => { calls++; return false; },
    6, new Set([1]))).toBe(false);
  expect(calls).toBe(0);
  expect(L.tracks).toEqual(snapshot);
});

test("shove cascade preserves protected neighbours while trying an alternate side", () => {
  const L = board([
    { net: 1, pts: [{ x: -40_000, y: 0 }, { x: 40_000, y: 0 }] },
    { net: 2, pts: [{ x: -40_000, y: 20_000 }, { x: 40_000, y: 20_000 }] },
  ], [{ x: 0, y: -12_000 }, { x: 0, y: 12_000 }]);
  const lat = buildLattice(L), journal = createJournal(L, lat);
  const snapshot = structuredClone([...L.tracks]).sort((a,b) => a.id-b.id);
  // Protect only the second obstacle, which is outside the initial probe's clearance.
  // The first displacement hits that neighbour; a safe shove must try the other side.
  const budget = { windowLu: 30_000, maxDepth: 4, maxMoved: 12 };
  const seg = { a: { x: 0, y: -12_000 }, b: { x: 0, y: 12_000 } };
  const profile = resolveProfile(L, 0, DEFAULT_ROUTE_SETTINGS);
  expect(shoveClear(L, lat, journal, 0, seg, profile, ignoreOf(0), budget, new Set([2]))).toBe(true);
  expect(L.tracks.find(t => t.id === 201)).toEqual(snapshot[1]);
  // A protected neighbour can force the shove to use the other side instead.
  expect(checkDrc(L).counts.violations).toBe(0);
});
