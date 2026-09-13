/**
 * The `applied-ses` reference profile (spec/acceptance/reference/*.applied-ses.json): for every
 * recorded session, `readDsn` → `applySes` → `layoutStats` must reproduce the reference's
 * `connections`, `incompleteBefore` / `incompleteAfter`, `vias`, `tracks`, `violationsBefore` /
 * `violationsAfter` (the numbers the spec side recomputed under K-01..K-12 and DR-01..DR-11).
 *
 * Known deviations (src/QUESTIONS.md, task I2):
 *   - `Issue191-processor.Z80-processor.ses`: the reference failed to lex the 44 bare `~{…}` net
 *     names (dsn-dialects.md D-10 rules them ordinary), dropping 257 wires and 40 vias; under
 *     F-S62 every entry applies (1921 Tracks, 223 Barrels, 0 incomplete).
 *   - `Issue313-FastTest.ses`, `Issue690-ecc83.ses`: the references *added* the session to the
 *     file's `protect` / `route` wiring; F-S61 replaces it (129 / 61 Tracks, 21 / 0 Barrels).
 *   - `traceLengthMm`: the references record LU / 10⁵ on these `um 10` boards, one tenth of the
 *     true length in millimetres; the test asserts the true length against the session text.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { applySes, layoutStats, readDsn } from "../src/api.ts";

const ROOT = import.meta.dir + "/..";
const REF = `${ROOT}/spec/acceptance/reference`;
const BOARDS = `${ROOT}/spec/acceptance/boards`;

interface Side { connections: number; incompleteBefore: number; incompleteAfter: number; vias: number; tracks: number; violationsBefore: number; violationsAfter: number; traceLengthMm: number }
interface Ref { board: string; settings: { ses: string }; refA: Side; refB: Side }

const DEVIATIONS: Record<string, Partial<Side>> = {
  "Issue191-processor.Z80-processor.ses": { incompleteAfter: 0, vias: 223, tracks: 1921 },
  "Issue313-FastTest.ses": { vias: 21, tracks: 129 },
  "Issue690-ecc83.ses": { tracks: 61 },
};

/** Sum of the session's `path` leg lengths in resolution units (an independent reading of the text). */
function sessionLength(text: string): number {
  let total = 0;
  for (const m of text.matchAll(/\(path\s+\S+\s+\d+((?:\s+-?\d+)+)\s*\)/g)) {
    const nums = m[1]!.trim().split(/\s+/).map(Number);
    for (let i = 2; i + 1 < nums.length; i += 2) total += Math.hypot(nums[i]! - nums[i - 2]!, nums[i + 1]! - nums[i - 1]!);
  }
  return total;
}

const files = readdirSync(REF).filter((f) => f.endsWith(".applied-ses.json")).sort();

describe("applied-ses references", () => {
  test("there are reference files", () => { expect(files.length).toBeGreaterThan(30); });
  for (const f of files) {
    test(f, async () => {
      const ref = JSON.parse(await Bun.file(`${REF}/${f}`).text()) as Ref;
      const board = await Bun.file(`${BOARDS}/${ref.board}`).text();
      const sesText = await Bun.file(`${BOARDS}/${ref.settings.ses}`).text();
      const read = readDsn(board, { name: ref.board });
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const before = layoutStats(read.layout);
      const applied = applySes(read.layout, sesText);
      expect(applied.ok).toBe(true);
      const after = layoutStats(read.layout);
      const want: Side = { ...ref.refB, ...(DEVIATIONS[ref.settings.ses] ?? {}) };
      expect(before.connections.maximum).toBe(want.connections);
      expect(after.connections.maximum).toBe(want.connections);
      expect(before.connections.incomplete).toBe(want.incompleteBefore);
      expect(after.connections.incomplete).toBe(want.incompleteAfter);
      expect(after.items.barrels).toBe(want.vias);
      expect(after.items.tracks).toBe(want.tracks);
      expect(before.violations.total).toBe(want.violationsBefore);
      expect(after.violations.total).toBe(want.violationsAfter);
      // Length: every applied-ses board is `(resolution um 10)`, so one resolution unit is 0.1 µm.
      const lockedLu = read.layout.tracks.filter((t) => t.hold === "locked").reduce((s, t) => {
        let l = 0;
        for (let i = 1; i < t.pts.length; i++) l += Math.hypot(t.pts[i]!.x - t.pts[i - 1]!.x, t.pts[i]!.y - t.pts[i - 1]!.y);
        return s + l;
      }, 0);
      if (!DEVIATIONS[ref.settings.ses]) {
        if (applied.diagnostics.length === 0) expect(after.tracks.totalLengthLu).toBeCloseTo(sessionLength(sesText) + lockedLu, 3);
        expect(after.tracks.totalLengthMm).toBeCloseTo(after.tracks.totalLengthLu / 10000, 6);
        // The reference figure is one tenth of that (question in src/QUESTIONS.md).
        expect(after.tracks.totalLengthMm / 10).toBeCloseTo(want.traceLengthMm, 2);
      }
    });
  }
});
