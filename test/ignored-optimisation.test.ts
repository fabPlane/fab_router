import { describe, expect, test } from "bun:test";
import { checkDrc, route } from "../src/api.ts";
import { buildLattice } from "../src/lattice/index.ts";
import { createJournal } from "../src/route/journal.ts";
import { runOptimise } from "../src/route/optimise.ts";
import { resolveSettings } from "../src/pipeline/index.ts";
import { ignoredOptimisationBoard } from "./helpers/ignored-optimisation.ts";

function optimise(ignored: ReadonlySet<number>) {
  const layout = ignoredOptimisationBoard();
  const before = structuredClone({ tracks: layout.tracks, barrels: layout.barrels });
  expect(checkDrc(layout).counts.incompletes).toBe(0);
  const lattice = buildLattice(layout);
  const journal = createJournal(layout, lattice);
  const result = runOptimise(layout, lattice, journal, resolveSettings({ optimizerPasses: 2 }, undefined, layout.angleMode), ignored);
  return { layout, before, result };
}

describe("ignored net optimisation", () => {
  test("preserves the essential via and terminal connectivity of an ignored net", () => {
    const { layout, before, result } = optimise(new Set([0]));
    expect(layout.barrels).toEqual(before.barrels);
    expect(checkDrc(layout).counts.incompletes).toBe(0);
    expect(result.barrelsRemoved).toBe(0);
  });

  test("preserves exact ignored track geometry and ids", () => {
    const { layout, before, result } = optimise(new Set([0]));
    expect(layout.tracks).toEqual(before.tracks);
    expect(result.tracksShortened).toBe(0);
  });

  test("still shortens active tracks while retaining their essential via", () => {
    const { layout, before, result } = optimise(new Set());
    expect(result.tracksShortened).toBe(1);
    expect(layout.tracks.find(t => t.sheet === 0)!.pts).toEqual([{ x: -50000, y: 0 }, { x: 0, y: 0 }]);
    expect(layout.barrels).toEqual(before.barrels);
    expect(checkDrc(layout).counts.incompletes).toBe(0);
    expect(checkDrc(layout).counts.violations).toBe(0);
  });

  test("the public route API leaves a previously routed ignored group untouched", () => {
    const layout = ignoredOptimisationBoard();
    const before = structuredClone({ tracks: layout.tracks, barrels: layout.barrels });
    const report = route(layout, { ignoreNetGroups: ["preserve"], fanoutEnabled: false, maxPasses: 1 });
    expect(report.attempted).toBe(0);
    expect({ tracks: layout.tracks, barrels: layout.barrels }).toEqual(before);
    // Unfiltered check is necessary: the route report excludes the ignored net.
    expect(checkDrc(layout).counts.incompletes).toBe(0);
    expect(report.violationsAdded).toBe(0);
  });
});
