import { expect, test } from "bun:test";
import { checkDrc, route } from "../src/api.ts";
import { buildLattice } from "../src/lattice/index.ts";
import { createJournal } from "../src/route/journal.ts";
import { runFanout } from "../src/route/fanout.ts";
import { resolveSettings } from "../src/pipeline/index.ts";
import { prewiredFanoutBoard } from "./helpers/fanout-budget.ts";

for (const cap of [1, 2]) test(`fanout cap ${cap} counts additions beside retained copper`, () => {
  const L = prewiredFanoutBoard();
  const retained = structuredClone({ track: L.tracks[0]!, barrel: L.barrels[0]! });
  const report = route(L, { fanoutEnabled: true, routerEnabled: false, optimizerEnabled: false, fanoutMaxItems: cap });
  const expected = cap === 1 ? 0 : 1;
  expect(report.added).toEqual({ tracks: expected, barrels: expected });
  expect(L.tracks).toHaveLength(1 + expected);
  expect(L.barrels).toHaveLength(1 + expected);
  expect(L.tracks.find(t => t.id === 20)).toEqual(retained.track);
  expect(L.barrels.find(b => b.id === 21)).toEqual(retained.barrel);
  expect(checkDrc(L).counts.violations).toBe(0);
});

test("late budget rejection preserves accepted escapes and earlier journal operations", () => {
  const L = prewiredFanoutBoard();
  const original = structuredClone({ tracks: L.tracks, barrels: L.barrels });
  const lattice = buildLattice(L), journal = createJournal(L, lattice);
  const prior = journal.addTrack({ net: 1, sheet: 0, pts: [{ x: -100000, y: 150000 }, { x: 100000, y: 150000 }],
    width: 4000, kind: 1, hold: "free" });
  journal.remove(20);
  const mark = journal.mark();
  const settings = resolveSettings({ fanoutEnabled: true, fanoutMaxItems: 3 }, undefined, L.angleMode);
  expect(runFanout(L, lattice, journal, settings, new Set())).toEqual({ escaped: 1, addedItems: 2 });
  expect(journal.insertedSince(mark)).toHaveLength(2);
  expect(journal.insertedSince(0)).toEqual([prior.id, ...journal.insertedSince(mark)]);
  expect(journal.stats()).toEqual({ inserted: 3, removed: 1, live: 4 });
  expect(L.tracks.find(t => t.id === prior.id)).toEqual(prior);
  expect(lattice.itemOf(prior.id)).toBeDefined();
  expect(lattice.itemOf(20)).toBeUndefined();
  expect(L.barrels.find(b => b.id === 21)).toEqual(original.barrels[0]);
  expect(checkDrc(L).counts.violations).toBe(0);
  journal.rewind(mark);
  expect(L.tracks).toEqual([prior]);
  expect(L.barrels).toEqual(original.barrels);
  expect(journal.stats()).toEqual({ inserted: 1, removed: 1, live: 2 });
  journal.rewind(0);
  expect(L.tracks).toEqual(original.tracks);
  expect(L.barrels).toEqual(original.barrels);
  expect(lattice.itemOf(20)).toBeDefined();
  expect(lattice.itemOf(prior.id)).toBeUndefined();
  expect(journal.stats()).toEqual({ inserted: 0, removed: 0, live: 2 });
});
