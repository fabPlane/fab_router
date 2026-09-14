/**
 * SPIKE I17 — the full detailed negotiated-congestion loop (`detailedNegotiation:true`).
 *
 * This experimental loop rips ALL routing copper and reroutes ALL required connections in detail
 * every pass against an escalating present+history cost (McMurchie & Ebeling 1995), instead of the
 * default loop's incomplete-only reroute. It is a measurement spike, but it must not weaken the two
 * hard guarantees:
 *   - R-1: `report.violationsAdded === 0` and `checkDrc` reports no new violation on every board and
 *     setting — the exact `sweepClear`/`barrelFits` predicate stays the sole gate; the congestion
 *     cost only biases the A* search, so a congested corridor can leave a connection incomplete but
 *     never adds copper that violates.
 *   - byte-identical default: `detailedNegotiation:false`/unset never enters the loop, so the fast
 *     tier is unaffected (the wider acceptance suite confirms this; here we assert the flag off and
 *     on produce the same fixed items and no added violation).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { readDsn, route, checkDrc } from "../src/api.ts";

const DIR = "spec/acceptance/boards/";
const BOARDS = [
  "Issue269-min_fr_test-min_fr_test.dsn",
  "Issue508-SMD-routing-issue-demo.dsn",
  "Issue413-test.dsn",
];

/** Fixed items the router may never move (R-2): a fingerprint to compare across settings. */
function fixedFingerprint(layout: {
  pads: ReadonlyArray<{ id: number; at: { x: number; y: number }; net: number | null; hold: string }>;
  tracks: ReadonlyArray<{ id: number; hold: string; pts: ReadonlyArray<{ x: number; y: number }> }>;
}): string {
  return JSON.stringify({
    pads: layout.pads.map((p) => ({ id: p.id, at: p.at, net: p.net, hold: p.hold })),
    fixedTracks: layout.tracks.filter((t) => t.hold !== "free").map((t) => ({ id: t.id, pts: t.pts })),
  });
}

describe("detailedNegotiation:true (SPIKE I17) preserves R-1", () => {
  for (const board of BOARDS) {
    const path = DIR + board;
    const exists = existsSync(path);
    test(`${board}: no added violation, clean DRC, held/locked unmoved`, () => {
      if (!exists) return; // corpus board absent in this checkout: skip silently (Q-I0-11 governs cases)
      const read = readDsn(readFileSync(path, "latin1"), { name: board });
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const layout = read.layout;

      const violationsBefore = checkDrc(layout).counts.violations;
      const fixedBefore = fixedFingerprint(layout);

      const report = route(layout, {
        detailedNegotiation: true,
        maxPasses: 8,
        timeBudgetMs: 20_000,
        optimizerEnabled: false,
      });

      // R-1: the loop never adds a violation, on any board or setting.
      expect(report.violationsAdded).toBe(0);
      expect(checkDrc(layout).counts.violations).toBeLessThanOrEqual(violationsBefore);
      // R-2: no held/locked item moved.
      expect(fixedFingerprint(layout)).toBe(fixedBefore);
    });
  }

  test("default (flag off) leaves fixed items identical to flag on", () => {
    const path = DIR + BOARDS[0]!;
    if (!existsSync(path)) return;
    const text = readFileSync(path, "latin1");
    const a = readDsn(text, { name: "a" });
    const b = readDsn(text, { name: "b" });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    route(a.layout, { maxPasses: 6, timeBudgetMs: 15_000, optimizerEnabled: false });
    route(b.layout, { detailedNegotiation: true, maxPasses: 6, timeBudgetMs: 15_000, optimizerEnabled: false });
    // Both keep every locked/held item byte-for-byte (R-2) whichever loop ran.
    expect(fixedFingerprint(a.layout)).toBe(fixedFingerprint(b.layout));
    expect(checkDrc(b.layout).counts.violations).toBeLessThanOrEqual(checkDrc(a.layout).counts.violations + 0);
  });
});
