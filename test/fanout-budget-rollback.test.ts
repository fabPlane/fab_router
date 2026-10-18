import { expect, test } from "bun:test";
import { checkDrc, route } from "../src/api.ts";
import { buildLattice } from "../src/lattice/index.ts";
import { createJournal } from "../src/route/journal.ts";
import { runFanout } from "../src/route/fanout.ts";
import { resolveSettings } from "../src/pipeline/index.ts";
import { fanoutBoard, mixedFanoutBoard } from "./helpers/fanout-budget.ts";

test("an oversized escape does not prevent a later affordable escape", () => {
  const L = mixedFanoutBoard();
  const report = route(L, { fanoutEnabled: true, routerEnabled: false, optimizerEnabled: false, fanoutMaxItems: 1 });
  expect(L.tracks).toHaveLength(0);
  expect(L.barrels).toHaveLength(1);
  expect(L.barrels[0]!.net).toBe(1);
  expect(L.barrels[0]!.at).toEqual(L.pads[1]!.at);
  expect(report.added).toEqual({ tracks: 0, barrels: 1 });
  expect(checkDrc(L).counts.violations).toBe(0);
});

test("budget rollback clears the live index and permits a subsequent fanout", () => {
  const L = fanoutBoard();
  const lattice = buildLattice(L);
  const journal = createJournal(L, lattice);
  const initial = lattice.stats();
  const firstId = Math.max(...L.pads.map(p => p.id)) + 1;
  const hits = () => L.stack.map(s => lattice.hits(s.id, { x0: -400000, y0: -200000, x1: 400000, y1: 200000 }));
  const initialHits = hits();
  const settings = resolveSettings({ fanoutEnabled: true, fanoutMaxItems: 1 }, undefined, L.angleMode);
  expect(runFanout(L, lattice, journal, settings, new Set())).toEqual({ escaped: 0, addedItems: 0 });
  expect(L.tracks).toHaveLength(0);
  expect(L.barrels).toHaveLength(0);
  expect(journal.stats()).toEqual({ inserted: 0, removed: 0, live: 0 });
  expect(lattice.stats().items).toBe(initial.items);
  expect(lattice.stats().slots).toBe(initial.slots);
  expect(hits()).toEqual(initialHits);
  // Every allocated-but-rewound id must also be absent from the directory.
  for (let id = firstId; id < ((L as typeof L & { nextRouterId?: number }).nextRouterId ?? firstId); id++) expect(lattice.itemOf(id)).toBeUndefined();
  const mark = journal.mark();
  expect(runFanout(L, lattice, journal, { ...settings, fanoutMaxItems: 4 }, new Set())).toEqual({ escaped: 2, addedItems: 4 });
  expect(L.tracks).toHaveLength(2);
  expect(L.barrels).toHaveLength(2);
  expect(checkDrc(L).counts.violations).toBe(0);
  journal.rewind(mark);
  expect(hits()).toEqual(initialHits);
  expect(journal.stats()).toEqual({ inserted: 0, removed: 0, live: 0 });
});
