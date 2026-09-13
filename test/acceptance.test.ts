/**
 * Fast-tier acceptance: one test() per case under spec/acceptance/cases (spec/acceptance/README.md).
 * Cases the API cannot serve yet fail unless FAB_ROUTER_ACCEPT_STUBS=1, in which case they pass
 * as stubs and are counted in the console summary.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { loadCases } from "../tools/acceptance/cases.ts";
import { acceptStubs, runCase, type CaseResult } from "../tools/acceptance/run-case.ts";

const loaded = loadCases();
const fast = loaded.cases.filter((c) => c.tier === "fast");
const results: CaseResult[] = [];

/**
 * Empty since task I5 added Barrels, the multilayer search, fanout, rip-up and the optimiser: the
 * four cases that the single-Sheet I4 milestone could not complete (bm08, j2-default, j2-maxpasses2,
 * no-vias-on-planes) now meet their `incomplete` bounds outright. Kept as an (empty) allowlist so a
 * future regression can be pinned here again with the R-1 gate still enforced below.
 */
const DEFERRED_TO_I5 = new Map<string, string>([]);

/** A deferred routing case is acceptable only when every mismatch is a completion bound and R-1 holds. */
function deferredIsAcceptable(r: CaseResult): boolean {
  if (r.stub) return false;
  const onlyCompletion = r.mismatches.every((m) => /^(incomplete|completed|passes):/.test(m));
  const addedViolations = typeof r.measured.violationsAdded === "number" ? r.measured.violationsAdded : NaN;
  const addedBarrels = typeof r.measured.addedBarrels === "number" ? r.measured.addedBarrels : 0;
  return onlyCompletion && addedViolations === 0 && addedBarrels === 0;
}

describe("acceptance cases are well-formed", () => {
  test("every case file validates against case.schema.json", () => {
    expect(loaded.invalid).toEqual([]);
  });
  test("case ids are unique", () => {
    const ids = loaded.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("acceptance (fast tier)", () => {
  for (const c of fast) {
    test(`${c.kind}: ${c.id}`, () => {
      const r = runCase(c);
      results.push(r);
      if (r.pass) return;
      if (DEFERRED_TO_I5.has(c.id)) {
        // R-1 must still hold; only the completion bound may miss (deferred to task I5).
        expect(deferredIsAcceptable(r), `${c.id}: deferred to I5 but R-1 breached — ${r.mismatches.join("; ")}`).toBe(true);
        return;
      }
      throw new Error(`${r.reason ?? r.mismatches.join("; ")}\nmeasured=${JSON.stringify(r.measured).slice(0, 400)}`);
    });
  }

  afterAll(() => {
    const stubbed = results.filter((r) => r.stub).length;
    const passed = results.filter((r) => r.pass).length;
    const advisory = results.filter((r) => r.advisoryMismatches.length > 0);
    console.log(`acceptance (fast): ${results.length} case(s), ${passed} passed, ${results.length - passed} failed, ${stubbed} stubbed${acceptStubs() ? " (FAB_ROUTER_ACCEPT_STUBS=1)" : ""}`);
    for (const r of advisory) console.log(`  advisory ${r.id}: ${r.advisoryMismatches.join("; ")}`);
  });
});
