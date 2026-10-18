import { fixture } from "./helpers/optimise-terminals.ts";
import { buildLattice } from "../src/lattice/index.ts";
import { createJournal } from "../src/route/journal.ts";
import { expect, test } from "bun:test";
import { checkDrc } from "../src/api.ts";
import { connectivity, incompleteCount } from "../src/drc/index.ts";
import { runOptimise } from "../src/route/optimise.ts";
import { resolveSettings } from "../src/pipeline/index.ts";


for (const terminal of ["pad", "pour", "branch"] as const) {
  test(`shortcut must not exchange connected terminals for an isolated pad (${terminal})`, () => {
    const f = fixture();
    if (terminal === "pour") {
      const c = f.pad("C");
      f.layout.pads = f.layout.pads.filter(p => p.id !== c.id);
      f.layout.pours = [{ id: c.id, net: 0, sheet: 0, outline: [
        { x: -100, y: 3900 }, { x: 100, y: 3900 }, { x: 100, y: 4100 }, { x: -100, y: 4100 },
      ], holes: [], kind: c.kind, hold: "locked" }];
      f.lattice = buildLattice(f.layout);
      f.journal = createJournal(f.layout, f.lattice);
    } else if (terminal === "branch") {
      const c = f.pad("C");
      f.journal.addTrack({ net: 0, sheet: 0, pts: [c.at, { x: 0, y: 5000 }], width: 200, kind: c.kind, hold: "held" });
      (c as { at: { x: number; y: number } }).at = { x: 0, y: 5000 };
      f.lattice = buildLattice(f.layout);
      f.journal = createJournal(f.layout, f.lattice);
    }
    const targetId = terminal === "pour" ? f.layout.pours[0]!.id : f.pad("C").id;
    const retained = structuredClone([...f.layout.tracks]);
    const before = connectivity(f.layout, f.lattice);
    expect(incompleteCount(before, 0)).toBe(1);
    expect(before.componentOf.get(f.pad("A").id)).toBe(before.componentOf.get(targetId));
    const result = runOptimise(f.layout, f.lattice, f.journal, resolveSettings({}, undefined, "45"), new Set());
    const after = connectivity(f.layout, f.lattice);
    // Aggregate opens alone cannot detect this regression: both partitions have one open.
    expect(incompleteCount(after, 0)).toBe(1);
    expect(after.componentOf.get(f.pad("A").id)).toBe(after.componentOf.get(targetId));
    expect(result.tracksShortened).toBe(0);
    expect([...f.layout.tracks].sort((a, b) => a.id - b.id)).toEqual(retained);
    expect(checkDrc(f.layout).violations).toEqual([]);
  });
}

test("shortcut may shorten a bend when every connected terminal remains attached", () => {
  const f = fixture(false);
  // Keep C attached independently so bypassing the bend does not lose its connection.
  f.journal.addTrack({ net: 0, sheet: 0, pts: [f.pad("C").at, f.pad("A").at], width: 200, kind: f.pad("A").kind, hold: "held" });
  const result = runOptimise(f.layout, f.lattice, f.journal, resolveSettings({}, undefined, "45"), new Set());
  expect(result.tracksShortened).toBe(1);
  expect(incompleteCount(connectivity(f.layout, f.lattice), 0)).toBe(0);
  expect(checkDrc(f.layout).violations).toEqual([]);
});
