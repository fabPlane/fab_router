import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkNativeBoards, compareNativeReports } from "../tools/native-drc-gate.ts";

const item = (x = 1) => ({ description: "Pad 1 [GND] of U1 on F.Cu", pos: { x, y: 2 }, uuid: "pad" });
const error = (type = "starved_thermal", x = 1) => ({ type, severity: "error", description: "Native finding", items: [item(x)] });
const report = (violations: unknown[] = [], opens = 0) => ({ coordinate_units: "mm", kicad_version: "10.0.6", included_severities: ["error", "warning", "exclusion"], violations, unconnected_items: Array.from({ length: opens }, () => ({})), ignored_checks: [] });

describe("native DRC acceptance gate", () => {
  test("rejects the native thermal violation absent from text-router reports", () => {
    const result = compareNativeReports(report([], 55), report([error()], 0));
    expect(result.accepted).toBe(false);
    expect(result.newErrors).toEqual([error()]);
  });
  test("compares a multiset, rather than allowing a removed error to mask a new one", () => {
    expect(compareNativeReports(report([error("clearance")]), report([error()])).accepted).toBe(false);
    expect(compareNativeReports(report([error()]), report([error(), error()])).newErrors).toHaveLength(1);
  });
  test("retains inherited findings even when native item identifiers change", () => {
    const inherited = error(); inherited.items[0]!.uuid = "imported-pad";
    expect(compareNativeReports(report([error()]), report([inherited])).accepted).toBe(true);
  });
  test("a moved finding is new; item order is immaterial", () => {
    expect(compareNativeReports(report([error()]), report([error("starved_thermal", 3)])).accepted).toBe(false);
    const a = error(); a.items.push({ ...item(3), uuid: "zone" });
    const b = { ...a, items: [...a.items].reverse() };
    expect(compareNativeReports(report([a]), report([b])).accepted).toBe(true);
  });
  test("blocks increased opens but allows incomplete routes that preserve connectivity", () => {
    expect(compareNativeReports(report([], 2), report([], 3)).accepted).toBe(false);
    expect(compareNativeReports(report([], 2), report([], 1)).accepted).toBe(true);
  });
  test("does not equate warnings with inherited errors", () => {
    expect(compareNativeReports(report([{ ...error(), severity: "warning" }]), report([error()])).accepted).toBe(false);
  });
  test("rejects changed ignored-check policy", () => {
    expect(() => compareNativeReports(report(), { ...report(), ignored_checks: [{ key: "clearance", description: "ignored" }] })).toThrow();
  });
  test("requires an error-inclusive check in matching native versions and units", () => {
    for (const patch of [{ included_severities: ["warning"] }, { kicad_version: "9.0.0" }, { coordinate_units: "mil" }]) {
      expect(() => compareNativeReports(report(), { ...report(), ...patch })).toThrow();
    }
  });
  test("fails closed on truncated or malformed native output", () => {
    for (const malformed of [{}, { ...report(), violations: null }, report([{ type: "clearance" }]), report([{ ...error(), items: [{ description: "pad" }] }]), { ...report(), unconnected_items: null }]) {
      expect(() => compareNativeReports(report(), malformed)).toThrow();
    }
  });
});

// Rules failures must be detected before trying to parse/refill even these invalid boards.
test("native runner rejects missing or changed project rules without modifying sources", async () => {
  const directory = await mkdtemp(join(tmpdir(), "native-gate-test-"));
  try {
    const before = join(directory, "before.kicad_pcb"), after = join(directory, "after.kicad_pcb");
    await writeFile(before, "source bytes"); await writeFile(after, "candidate bytes");
    await expect(checkNativeBoards(before, after)).rejects.toThrow();
    await writeFile(before.replace(".kicad_pcb", ".kicad_pro"), "original rules");
    await writeFile(after.replace(".kicad_pcb", ".kicad_pro"), "changed rules");
    await expect(checkNativeBoards(before, after)).rejects.toThrow("Candidate project rules differ");
    await writeFile(after.replace(".kicad_pcb", ".kicad_pro"), "original rules");
    await writeFile(after.replace(".kicad_pcb", ".kicad_dru"), "candidate-only rules");
    await expect(checkNativeBoards(before, after)).rejects.toThrow("Candidate project rules differ");
    expect(await readFile(before, "utf8")).toBe("source bytes");
    expect(await readFile(after, "utf8")).toBe("candidate bytes");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
