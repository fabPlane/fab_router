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
      if (!r.pass) {
        throw new Error(`${r.reason ?? r.mismatches.join("; ")}\nmeasured=${JSON.stringify(r.measured).slice(0, 400)}`);
      }
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
