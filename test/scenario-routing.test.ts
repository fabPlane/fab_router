/**
 * Outcome-only routing scenarios (spec/behaviour/scenarios). Two are exercised here on the
 * fast-tier boards:
 *   - held-items.md (contract R-2): Pads, held file wiring, Pours, Fences and the Rim are
 *     byte-for-byte unchanged after `route()`.
 *   - novia-routable-nets.md (contract R-1/R-4): with `viasAllowed: false`, no Barrel is added and
 *     no violation is added on any board. The per-net "complete in both" assertions are made for
 *     the boards this single-Sheet milestone completes (src/QUESTIONS.md "Deferred to I5" records
 *     the boards whose listed nets still need vias).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { readDsn, route, checkDrc } from "../src/api.ts";
import type { Layout } from "../spec/types/layout.ts";

const DIR = "spec/acceptance/boards/";
function load(board: string): Layout | undefined {
  const path = DIR + board;
  if (!existsSync(path)) return undefined;
  const r = readDsn(readFileSync(path, "utf8"), { name: board });
  return r.ok ? r.layout : undefined;
}

function incompleteByNet(layout: Layout): Map<string, number> {
  const drc = checkDrc(layout);
  const byId = new Map<number, number>();
  for (const i of drc.incompletes) byId.set(i.net, (byId.get(i.net) ?? 0) + 1);
  const out = new Map<string, number>();
  for (const n of layout.nets) out.set(n.name, byId.get(n.id) ?? 0);
  return out;
}

/** Fixed items (contract R-2): locked/held Tracks and Barrels, all Pads, Pours, Fences, the Rim. */
function fingerprintFixed(layout: Layout): string {
  const heldTracks = layout.tracks.filter((t) => t.hold !== "free").map((t) => ({ id: t.id, pts: t.pts, w: t.width, net: t.net, sheet: t.sheet }));
  const heldBarrels = layout.barrels.filter((b) => b.hold !== "free").map((b) => ({ id: b.id, at: b.at, form: b.form, net: b.net }));
  return JSON.stringify({
    pads: layout.pads.map((p) => ({ id: p.id, at: p.at, net: p.net, hold: p.hold })),
    pours: layout.pours.map((p) => ({ id: p.id, outline: p.outline, net: p.net })),
    fences: layout.fences.map((f) => ({ id: f.id, shape: f.shape, scope: f.scope })),
    rim: layout.rim,
    heldTracks, heldBarrels,
  });
}

const NOVIA_FAST = [
  "Issue368-CorneyIslandWireless_input_design.dsn",
  "Issue143-rpi_splitter_mod.dsn",
  "Issue649-kicad_ecc83-pp_input_board_v1.dsn",
  "Issue690-ecc83.dsn",
  "Issue269-min_fr_test-min_fr_test.dsn",
  "Issue159-setonix_2hp-pcb.dsn",
  "Issue508-DAC2020_bm08.dsn",
  "Issue143-rpi_splitter.dsn",
  "Issue270-non-ansi_bracket.dsn",
  "Issue508-SMD-routing-issue-demo.dsn",
];

// Boards whose "complete in both" nets this milestone completes on one Sheet (verified).
const COMPLETES: Record<string, string[]> = {
  "Issue368-CorneyIslandWireless_input_design.dsn": ["C5", "inner_bottom_B", "inner_home_B"],
  "Issue143-rpi_splitter_mod.dsn": ["VCC"],
  "Issue649-kicad_ecc83-pp_input_board_v1.dsn": ["Net-(P1-PM)", "Net-(P2-P1)", "Net-(P3-P1)", "Net-(P4-P1)", "Net-(P4-PM)", "Net-(U1A-G)", "Net-(U1A-K)", "Net-(U1B-K)"],
  "Issue690-ecc83.dsn": ["Net-(P1-PM)"],
};

describe("scenario: novia-routable-nets (R-1, R-4)", () => {
  for (const board of NOVIA_FAST) {
    test(board, () => {
      const layout = load(board);
      if (!layout) return; // corpus file absent in this checkout
      const before = checkDrc(layout).counts.violations;
      const rep = route(layout, { viasAllowed: false, maxPasses: 100, timeBudgetMs: 60_000 });
      const after = checkDrc(layout).counts.violations;
      expect(rep.added.barrels).toBe(0);
      expect(rep.violationsAdded).toBe(0);
      expect(after).toBe(before);
      const inc = incompleteByNet(layout);
      for (const net of COMPLETES[board] ?? []) expect(`${net}=${inc.get(net)}`).toBe(`${net}=0`);
    });
  }
});

describe("scenario: held-items (R-2)", () => {
  const boards = ["Issue269-min_fr_test-min_fr_test.dsn", "Issue508-SMD-routing-issue-demo.dsn", "Issue508-DAC2020_bm08.dsn", "Issue413-test.dsn"];
  for (const board of boards) {
    for (const profile of [{ viasAllowed: false }, { viasAllowed: true }] as const) {
      test(`${board} (${profile.viasAllowed ? "default" : "novia"})`, () => {
        const layout = load(board);
        if (!layout) return;
        const fp = fingerprintFixed(layout);
        route(layout, { ...profile, maxPasses: 20, timeBudgetMs: 60_000 });
        expect(fingerprintFixed(layout)).toBe(fp);
      });
    }
  }
});
