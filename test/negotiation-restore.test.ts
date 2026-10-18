import { expect, test } from "bun:test";
import { route, checkDrc } from "../src/api.ts";
import { buildLattice } from "../src/lattice/index.ts";
import { createJournal } from "../src/route/journal.ts";
import { board } from "./helpers/negotiation-restore.ts";

for (const detailedNegotiation of [false, true]) {
  test(`keep-best preserves a shoved obstacle's removal (detailed=${detailedNegotiation})`, () => {
    const L = board([{ net: 1, pts: [{ x: 0, y: -96_000 }, { x: 0, y: 96_000 }] }]);
    expect(checkDrc(L).counts).toEqual({ violations: 0, incompletes: 1 });
    const report = route(L, { detailedNegotiation, maxPasses: 3, maxStagnantPasses: 0,
      shoveEnabled: true, shoveWindowUm: 8000, optimizerEnabled: false, viasAllowed: false });
    expect(report.incompleteAfter).toBe(0);
    expect(report.violationsAdded).toBe(0);
    expect(checkDrc(L).counts).toEqual({ violations: 0, incompletes: 0 });
    expect(L.tracks.filter(t => t.net === 1)).toHaveLength(1);
    expect(L.tracks.some(t => t.id === 200)).toBe(false);
    const moved = L.tracks.find(t => t.net === 1)!;
    expect(moved.pts[0]).toEqual({ x: 0, y: -96_000 });
    expect(moved.pts.at(-1)).toEqual({ x: 0, y: 96_000 });
  });
}

test("removal capture excludes restored items and predating operations", () => {
  const L = board([{ net: 1, pts: [{ x: 0, y: -96_000 }, { x: 0, y: 96_000 }] }]);
  const lattice = buildLattice(L), journal = createJournal(L, lattice);
  const original = L.tracks[0]!;
  const mark = journal.mark();
  journal.remove(original.id);
  expect(journal.removedSince(mark)).toEqual([original.id]);
  expect(journal.removedSince(journal.mark())).toEqual([]);
  journal.rewind(mark);
  expect(journal.removedSince(mark)).toEqual([]);
  expect(lattice.itemOf(original.id)?.item).toEqual(original);
});
