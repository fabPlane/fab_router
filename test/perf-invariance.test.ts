/**
 * Behaviour-invariance guard for the M9c per-pass speedup (task I11).
 *
 * The M9c work (typed-array A* frontier and visited store, cached per-direction step cost and leg
 * length, shared hard-mode edge result) is a pure performance change: for the same Layout, settings
 * and seed the router must emit exactly the same Tracks and Barrels, in the same order, with the same
 * incomplete count and `violationsAdded`. This test pins that: it routes a set of boards, folds the
 * report counters and the full SES text (integer coordinates, in emission order) into one SHA-256
 * fingerprint, and asserts the fingerprint equals a recorded value. Any future change that alters a
 * route — coordinate, ordering, completion — flips the hash and fails here loudly. It also routes
 * each board twice and asserts the two fingerprints match, pinning run-to-run determinism
 * (docs/DESIGN.md §7). Budgets are generous so time never truncates a run (the fingerprint would
 * otherwise be machine-dependent); every board below stops by `complete` or `stagnant`.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { routeDsn } from "../src/api.ts";

const BOARDS_DIR = new URL("../spec/acceptance/boards/", import.meta.url).pathname;

interface Board { name: string; file: string; settings: Record<string, unknown> }

// Boards chosen to exercise the changed paths: single-Sheet A* completion (bm08), rip-up with the
// soft-obstacle edge cost plus layered via search over several passes (J2), plane Sheets
// (min_fr_test), and a fanout-only escape (ecc83). All finish quickly and deterministically.
const BOARDS: Board[] = [
  { name: "dac2020-bm08", file: "Issue508-DAC2020_bm08.dsn", settings: { maxPasses: 100, timeoutSeconds: 120 } },
  { name: "issue026-j2", file: "Issue026-J2_reference.dsn", settings: { maxPasses: 100, timeoutSeconds: 120 } },
  { name: "min-fr-test", file: "Issue269-min_fr_test-min_fr_test.dsn", settings: { maxPasses: 100, timeoutSeconds: 120 } },
  { name: "ecc83", file: "Issue690-ecc83.dsn", settings: { maxPasses: 100, timeoutSeconds: 120 } },
];

// Recorded fingerprints (task I11). Regenerate deliberately only when a route is meant to change.
const RECORDED: Record<string, string> = {
  "dac2020-bm08": "a042a8fe137cbf155a5a5967c079bc42932024bd246dc54bd1ec384070908316",
  "issue026-j2": "599df5659ec39d3cb926c322a6957ad0fa7110a40c877615d8945f84683ab601",
  "min-fr-test": "50e0bb0f832803abe4563c47315ff44e85e93fe767540847565300d1c1664eb5",
  "ecc83": "6259e1577b55e2e47c86958020366794c5fc8c541325a603f4ed4f4feaedf962",
};

function fingerprint(b: Board): string {
  const text = readFileSync(BOARDS_DIR + b.file, "utf8");
  const r = routeDsn(text, b.settings);
  if (!r.ok) throw new Error(`route failed for ${b.file}`);
  const rep = r.report;
  // Guard the premise: a time-truncated run would make the fingerprint machine-dependent.
  expect(rep.timedOut).toBe(false);
  expect(rep.aborted).toBe(false);
  const head = [
    rep.incompleteAfter, rep.violationsAdded, rep.added.tracks, rep.added.barrels, rep.passes, rep.stoppedBy,
  ].join("|");
  return createHash("sha256").update(head).update("\n").update(r.ses).digest("hex");
}

describe("perf-invariance (M9c)", () => {
  for (const b of BOARDS) {
    test(`${b.name} routes are byte-identical to the recorded fingerprint`, () => {
      const fp1 = fingerprint(b);
      const fp2 = fingerprint(b);
      // Run-to-run determinism.
      expect(fp2).toBe(fp1);
      if (process.env.FAB_FP_PRINT) console.log(`FP ${b.name} ${fp1}`);
      const recorded = RECORDED[b.name]!;
      if (recorded !== "PLACEHOLDER") expect(fp1).toBe(recorded);
    }, 60_000);
  }
});
