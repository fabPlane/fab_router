/**
 * I5 router features: multilayer Barrel routing, fanout, the optimiser (contract R-6) and plane-net
 * completion, exercised on the corpus boards (skipped when a board is absent from the checkout).
 * The single invariant every case shares is R-1: `route()` never adds a DRC violation.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { readDsn, route, checkDrc, layoutStats } from "../src/api.ts";
import type { Layout } from "../spec/types/layout.ts";

const DIR = "spec/acceptance/boards/";
function load(board: string): Layout | undefined {
  if (!existsSync(DIR + board)) return undefined;
  const r = readDsn(readFileSync(DIR + board, "utf8"), { name: board });
  return r.ok ? r.layout : undefined;
}

describe("multilayer routing with Barrels", () => {
  test("Issue508-DAC2020_bm08 completes with vias, R-1 holds", () => {
    const L = load("Issue508-DAC2020_bm08.dsn");
    if (!L) return;
    const before = checkDrc(L).counts.violations;
    const rep = route(L, { maxPasses: 100, timeBudgetMs: 60_000 });
    expect(rep.violationsAdded).toBe(0);
    expect(checkDrc(L).counts.violations).toBe(before);
    expect(rep.added.barrels).toBeGreaterThan(0);
    expect(checkDrc(L).counts.incompletes).toBe(0);
    // R-3: reported additions equal the item-count difference.
    expect(rep.added.tracks).toBe(L.tracks.length);
  });

  test("R-4: viasAllowed=false adds no Barrel", () => {
    const L = load("Issue508-DAC2020_bm08.dsn");
    if (!L) return;
    const rep = route(L, { viasAllowed: false, maxPasses: 100, timeBudgetMs: 60_000 });
    expect(rep.added.barrels).toBe(0);
    expect(rep.violationsAdded).toBe(0);
  });
});

describe("plane-net completion (K-07)", () => {
  test("Issue269-NoViasOnPowerPlanes routes across power planes, R-1 holds", () => {
    const L = load("Issue269-NoViasOnPowerPlanes-Issue269-NoViasOnPowerPlanes.dsn");
    if (!L) return;
    const rep = route(L, { maxPasses: 100, timeBudgetMs: 60_000 });
    expect(rep.violationsAdded).toBe(0);
    expect(checkDrc(L).counts.incompletes).toBe(0);
  });
});

describe("fanout pre-pass", () => {
  test("fanout raises escaped SMD pads and adds Barrels, R-1 holds", () => {
    const L = load("Issue508-DAC2020_bm08.dsn");
    if (!L) return;
    const escBefore = layoutStats(L).fanout.escaped;
    const rep = route(L, { fanoutEnabled: true, routerEnabled: false, optimizerEnabled: false, timeBudgetMs: 60_000 });
    expect(rep.passes).toBe(0);
    expect(rep.violationsAdded).toBe(0);
    expect(rep.added.barrels).toBeGreaterThan(0);
    expect(layoutStats(L).fanout.escaped).toBeGreaterThan(escBefore);
  });
});

describe("optimiser monotonicity (R-6)", () => {
  for (const board of ["Issue508-DAC2020_bm08.dsn", "Issue269-min_fr_test-min_fr_test.dsn"]) {
    test(board, () => {
      const off = load(board), on = load(board);
      if (!off || !on) return;
      const rOff = route(off, { optimizerEnabled: false, maxPasses: 100, timeBudgetMs: 60_000 });
      const rOn = route(on, { optimizerEnabled: true, maxPasses: 100, timeBudgetMs: 60_000 });
      const sOff = layoutStats(off), sOn = layoutStats(on);
      // R-6: Barrel count and total Track length never increase; no complete connection lost; R-1.
      expect(sOn.items.barrels).toBeLessThanOrEqual(sOff.items.barrels);
      expect(sOn.tracks.totalLengthLu).toBeLessThanOrEqual(sOff.tracks.totalLengthLu);
      expect(sOn.connections.incomplete).toBeLessThanOrEqual(sOff.connections.incomplete);
      expect(rOn.violationsAdded).toBe(0);
      expect(rOff.violationsAdded).toBe(0);
    });
  }
});
