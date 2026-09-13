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
 * Routing cases whose completion bound (an `incomplete` metric) can only be reached with Barrels,
 * which task I4 does not insert (single-Sheet, `viasAllowed: false` semantics; see the task file's
 * "Done when" and src/QUESTIONS.md "Deferred to I5"). These are allowed to miss their `incomplete`
 * bound, but the hard R-1 gate is still enforced below: no router-added violation and no Barrel
 * added. The moment I5 adds vias these should pass outright and can be removed from the set.
 */
const DEFERRED_TO_I5 = new Map<string, string>([
  ["routing-fast-dac2020-bm08-complete", "needs vias to reach 0 incomplete (novia refs leave 1)"],
  ["routing-fast-issue026-j2-default", "needs vias to reach ≤3 incomplete (novia refs leave 5–11)"],
  ["routing-fast-issue026-j2-maxpasses2", "needs vias to reach ≤6 incomplete in 2 passes"],
  ["routing-fast-issue269-no-vias-on-planes-planes", "needs vias to reach 0 incomplete (novia refs leave 1–2)"],
]);

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
