/**
 * Unit tests for the acceptance runner's own machinery: the JSON-schema validator, the session
 * canonicaliser (ses.md F-S50) checked against the spec's own expected trees, case loading and
 * glob matching, settings mapping and resolution (settings.md), and the API stub envelopes.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { deepEqual, firstDifference, validate } from "../tools/acceptance/schema.ts";
import { canon, lex, normaliseSession, toTree, type Node } from "../tools/acceptance/sexp.ts";
import { ACCEPT, caseSettings, loadCases, matchGlob } from "../tools/acceptance/cases.ts";
import { runCase } from "../tools/acceptance/run-case.ts";
import { resolveSettings } from "../src/pipeline/index.ts";
import { emptyLayout, makeSpacingTable } from "../src/layout/index.ts";
import * as api from "../src/api.ts";

describe("schema validator", () => {
  const schema = JSON.parse(readFileSync(join(ACCEPT, "schema", "case.schema.json"), "utf8"));
  test("accepts a minimal valid case and rejects bad ones", () => {
    expect(validate(schema, { id: "a-1", kind: "parse", origin: "new", tier: "fast", expect: {} })).toEqual([]);
    expect(validate(schema, { id: "A", kind: "parse", origin: "new", tier: "fast", expect: {} })[0]).toContain("does not match");
    expect(validate(schema, { id: "a", kind: "nope", origin: "new", tier: "fast", expect: {} })[0]).toContain("not one of");
    expect(validate(schema, { id: "a", kind: "parse", origin: "new", tier: "fast" })[0]).toContain("missing required");
    expect(validate(schema, { id: "a", kind: "parse", origin: "new", tier: "fast", expect: {}, extra: 1 })[0]).toContain("unexpected property");
    expect(validate(schema, { id: "a", kind: "parse", origin: "new", tier: "fast", expect: { x: { max: "3" } } })[0]).toContain("expected number");
    expect(validate(schema, { id: "a", kind: "parse", origin: "new", tier: "fast", expect: {}, settings: { maxPasses: -1 } })[0]).toContain("minimum");
    expect(validate(schema, { id: "a", kind: "parse", origin: "new", tier: "fast", expect: {}, settings: { maxPasses: 1.5 } })[0]).toContain("integer");
  });
  test("every schema under spec/acceptance/schema is itself readable and $refs resolve", () => {
    const ref = JSON.parse(readFileSync(join(ACCEPT, "schema", "reference.schema.json"), "utf8"));
    expect(validate(ref, { board: "b", boardSha256: "x", profile: "default", settings: {}, _generated: "g", refA: { vias: 1 } })).toEqual([]);
    expect(validate(ref, { board: "b", boardSha256: "x", profile: "default", settings: {}, _generated: "g", refA: { vias: 1.5 } })[0]).toContain("integer");
  });
  test("deepEqual and firstDifference", () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(firstDifference({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe("$.a[1].b: 2 vs 3");
    expect(firstDifference([1, 2], [1, 2, 3])).toBe("$: length 2 vs 3");
  });
});

/** Serialise a canonical tree back to session text (the inverse of normalisation for round-trips). */
function toText(node: Node): string {
  // The canonical `parser` node lists entry heads; re-expand them into scopes for the round trip.
  if (node[0] === "parser") return "(parser " + node.slice(1).map((h) => `(${String(h)} x)`).join(" ") + ")";
  return "(" + node.map((x) => (Array.isArray(x) ? toText(x as Node) : typeof x === "number" ? String(x) : /[\s()"]/.test(String(x)) || x === "" ? `"${x}"` : String(x))).join(" ") + ")";
}

describe("session canonicalisation (F-S50)", () => {
  test("lexer: quotes, string_quote exception, numbers, glued tokens", () => {
    const lx = lex(`(a "b c" 'd' 1 -2.5 .5 x)(string_quote ")`);
    expect(lx.map((l) => l.kind + ":" + l.text)).toEqual(["open:(", "ident:a", "string:b c", "ident:'d'", "number:1", "number:-2.5", "number:.5", "ident:x", "close:)", "open:(", "ident:string_quote", "ident:\"", "close:)"]);
    // F-4 / Q-I1-29: only the declared character quotes, from its declaration onward.
    const sw = lex(`(string_quote ') (a 'b c' "d e")`);
    expect(sw.map((l) => l.kind + ":" + l.text)).toEqual(["open:(", "ident:string_quote", "ident:'", "close:)", "open:(", "ident:a", "string:b c", "ident:\"d", "ident:e\"", "close:)"]);
    expect(toTree(lex("(a (b 1) c) )"))).toEqual([["a", ["b", "1"], "c"]]);
  });

  test("re-normalising the spec's expected trees is the identity", () => {
    const dir = join(ACCEPT, "ses");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sexp.json")).sort();
    expect(files.length).toBeGreaterThan(100);
    let checked = 0;
    for (const f of files) {
      const { tree } = JSON.parse(readFileSync(join(dir, f), "utf8")) as { tree: Node };
      const text = toText(tree);
      const again = normaliseSession(text);
      const diff = firstDifference(again, tree);
      if (diff) throw new Error(`${f}: ${diff}`);
      checked++;
    }
    expect(checked).toBe(files.length);
  });

  test("normalisation sorts, merges, simplifies paths and canonicalises polygons", () => {
    const text = `(session S (base_design B)
      (placement (resolution um 10) (component IMG2 (place R2 1 2 front 0)) (component IMG1 (place R9 0 0 back 90)) (component IMG2 (place R1 5 5 front 0)) (junk))
      (was_is)
      (routes (resolution um 10) (parser (host_version 1) (host_cad k))
        (library_out (padstack "Via B" (attach off) (shape (circle F.Cu 800))) (padstack "Via A" (shape (rect B.Cu -1 -1 1 1))))
        (network_out (net N2 (wire (path F.Cu 10 0 0 5 0 5 0 10 0 10 5))) (net N1 (wire (polygon F.Cu 0 0 0 0 10 10 10 10 0 0 0)) (via V 1 2)))))`;
    const t = normaliseSession(text)!;
    expect(t[0]).toBe("session");
    expect(t[1]).toBe("S");
    expect(t[2]).toEqual(["base_design", "B"]);
    expect(t[3]).toEqual(["placement", ["resolution", "um", 10], ["component", "IMG1", ["place", "R9", 0, 0, "back", 90]], ["component", "IMG2", ["place", "R1", 5, 5, "front", 0], ["place", "R2", 1, 2, "front", 0]]]);
    expect(t[4]).toEqual(["was_is"]);
    const routes = t[5] as Node;
    expect(routes[1]).toEqual(["resolution", "um", 10]);
    expect(routes[2]).toEqual(["parser", "host_cad", "host_version"]);
    expect(routes[3]).toEqual(["library_out",
      ["padstack", "Via A", ["shape", ["rect", "B.Cu", -1, -1, 1, 1]]],
      ["padstack", "Via B", ["shape", ["circle", "F.Cu", 800, 0, 0]], ["attach", "off"]]]);
    const nets = routes[4] as Node;
    expect(nets[0]).toBe("network_out");
    expect(nets[1]).toEqual(["net", "N1", ["via", "V", 1, 2], ["wire", ["polygon", "F.Cu", 0, 0, 0, 10, 0, 10, 10, 0, 10]]]);
    expect(nets[2]).toEqual(["net", "N2", ["wire", ["path", "F.Cu", 10, 0, 0, 10, 0, 10, 5]]]);
    expect(canon(["a", 1])).toBe('["a",1]');
  });
});

describe("case loading", () => {
  test("every case in the corpus validates and ids are unique", () => {
    const l = loadCases();
    expect(l.invalid).toEqual([]);
    expect(l.cases.length).toBeGreaterThan(300);
    expect(new Set(l.cases.map((c) => c.id)).size).toBe(l.cases.length);
    expect(l.cases.every((c) => c.file.endsWith(".json"))).toBe(true);
  });
  test("glob matching", () => {
    expect(matchGlob("parse-*", "parse-lex-x")).toBe(true);
    expect(matchGlob("parse-*", "settings-x")).toBe(false);
    expect(matchGlob("a?c", "abc")).toBe(true);
    expect(matchGlob("a.c", "abc")).toBe(false);
  });
  test("short setting names map to RouteSettings", () => {
    expect(caseSettings({ router: false, optimizer: true, fanout: true, timeoutSeconds: 2, optimizerMaxPasses: 3, maxPasses: 4 }))
      .toEqual({ routerEnabled: false, optimizerEnabled: true, fanoutEnabled: true, timeBudgetMs: 2000, optimizerPasses: 3, maxPasses: 4 });
  });
});

describe("settings resolution (settings.md)", () => {
  test("defaults ← file (only with useFileSettings) ← caller, per Sheet and per field", () => {
    const file = { viaCost: 50, optimizerEnabled: false, layers: { "F.Cu": { active: true, preferDir: "h" as const, alongCost: 1, againstCost: 2.1 }, "B.Cu": { active: true, preferDir: "v" as const, alongCost: 1, againstCost: 1.9 } } };
    const noFile = resolveSettings({ routerEnabled: false }, file, "45");
    expect(noFile.viaCost).toBe(50);
    expect(noFile.optimizerEnabled).toBe(true);
    expect(noFile.layers).toEqual({});
    expect(noFile.angleMode).toBe("45");
    const withFile = resolveSettings({ routerEnabled: false, useFileSettings: true, viaCost: 77, optimizerEnabled: true, layers: { "B.Cu": { active: false } } }, file, "90");
    expect(withFile.viaCost).toBe(77);
    expect(withFile.optimizerEnabled).toBe(true);
    expect(withFile.routerEnabled).toBe(false);
    expect(withFile.layers["F.Cu"]).toEqual({ active: true, preferDir: "h", alongCost: 1, againstCost: 2.1 });
    expect(withFile.layers["B.Cu"]).toEqual({ active: false, preferDir: "v", alongCost: 1, againstCost: 1.9 });
    expect(withFile.angleMode).toBe("90");
    expect(withFile.planeViaCost).toBe(5);
    expect(withFile.startRipupCost).toBe(100);
    expect(resolveSettings({ angleMode: "any" }, undefined, "90").angleMode).toBe("any");
    expect(resolveSettings(undefined, undefined, undefined).angleMode).toBe("45");
    // no clamping
    expect(resolveSettings({ viaCost: -3 }, undefined, undefined).viaCost).toBe(-3);
  });
});

describe("API stubs", () => {
  test("every contract function exists and returns a well-typed value", () => {
    const L = emptyLayout("x");
    expect(api.readDsn("not a design file").ok).toBe(false);
    const read = api.readDsn("(pcb x (structure (layer F.Cu (type signal)) (boundary (rect pcb 0 0 1 1))))");
    expect(read.ok).toBe(true);
    if (read.ok) expect(api.readDsn(api.writeDsn(read.document)).ok).toBe(true);
    expect(api.writeSes(L)).toContain("(session x.ses");
    expect(api.applySes(L, "").ok).toBe(false);
    expect(api.readRules("").ok).toBe(false);
    expect(api.applyRules(L, { name: "x", body: [] })).toBe(L);
    expect(api.checkDrc(L).counts).toEqual({ violations: 0, incompletes: 0 });
    expect(api.layoutStats(L).items.pads).toBe(0);
    expect(api.requiredConnections(L)).toEqual([]);
    const report = api.route(L, { viaCost: 7 });
    expect(report.effectiveSettings.viaCost).toBe(7);
    expect(report.effectiveSettings.angleMode).toBe("45");
    expect(report.added).toEqual({ tracks: 0, barrels: 0 });
    expect(api.routeDsn("not a design file").ok).toBe(false);
    // routeSrj is implemented (task I6): a valid board with nothing to route succeeds and echoes
    // an empty `traces` array; the result carries a report and the (unchanged) srj document.
    const srjRes = api.routeSrj({ layerCount: 2, minTraceWidth: 0.2, bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 }, obstacles: [], connections: [] });
    expect(srjRes.ok).toBe(true);
    expect(srjRes.srj.traces).toEqual([]);
    expect(srjRes.report.effectiveSettings.angleMode).toBe("45");
  });
  test("SpacingTable is symmetric, per Sheet and per pair type, with a max per Kind", () => {
    const t = makeSpacingTable(["", "default", "smd"], 2, ["smd_smd"], (a, b, s, p) => (a === 0 || b === 0 ? 0 : (p === "smd_smd" ? 5 : 10) + s + a + b));
    expect(t.get(1, 2, 0)).toBe(13);
    expect(t.get(2, 1, 0)).toBe(13);
    expect(t.get(1, 2, 1)).toBe(14);
    expect(t.get(1, 2, 0, "smd_smd")).toBe(8);
    expect(t.get(1, 2, 0, "unknown")).toBe(13);
    expect(t.get(0, 2, 1)).toBe(0);
    expect(t.max(2)).toBe(15);
    expect(t.max(0)).toBe(0);
  });
  test("a case whose resources are absent is a stub, failing unless FAB_ROUTER_ACCEPT_STUBS=1", () => {
    const prev = process.env.FAB_ROUTER_ACCEPT_STUBS;
    try {
      const c = { id: "x", kind: "parse" as const, origin: "new", tier: "fast" as const, board: "no-such-board.dsn", expect: { status: { exact: "ok" } }, file: "x.json" };
      process.env.FAB_ROUTER_ACCEPT_STUBS = "0";
      const r1 = runCase(c);
      expect(r1.stub).toBe(true);
      expect(r1.pass).toBe(false);
      process.env.FAB_ROUTER_ACCEPT_STUBS = "1";
      const r2 = runCase(c);
      expect(r2.stub).toBe(true);
      expect(r2.pass).toBe(true);
      expect(r2.reason).toContain("board corpus file missing");
    } finally {
      if (prev === undefined) delete process.env.FAB_ROUTER_ACCEPT_STUBS; else process.env.FAB_ROUTER_ACCEPT_STUBS = prev;
    }
  });
});
