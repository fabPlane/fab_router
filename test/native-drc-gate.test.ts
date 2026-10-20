import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkNativeBoards, compareNativeReports } from "../tools/native-drc-gate.ts";

test.skipIf(!Bun.which("kicad-cli"))("native gate rejects a changed embedded board rule even with clean reports", async () => {
  const directory = await mkdtemp(join(tmpdir(), "native-embedded-rules-"));
  try {
    const before = join(directory, "before.kicad_pcb"), after = join(directory, "after.kicad_pcb");
    const board = (clearance: number) => `(kicad_pcb (version 20260206) (generator "pcbnew")
      (general (thickness 1.6)) (paper "A4")
      (layers (0 "F.Cu" signal) (2 "B.Cu" signal) (25 "Edge.Cuts" user))
      (setup (pad_to_mask_clearance ${clearance}))
      (gr_rect (start 0 0) (end 10 10) (stroke (width 0.05) (type default))
        (fill none) (layer "Edge.Cuts") (uuid "00000000-0000-0000-0000-000000000001")))`;
    await writeFile(before, board(0.2)); await writeFile(after, board(0));
    for (const path of [before, after]) await writeFile(path.replace(".kicad_pcb", ".kicad_pro"), "{}");
    await expect(checkNativeBoards(before, after)).rejects.toThrow("Candidate embedded board rules differ");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

const item = (x = 1) => ({ description: "Pad 1 [GND] of U1 on F.Cu", pos: { x, y: 2 }, uuid: "pad" });
const error = (type = "starved_thermal", x = 1) => ({ type, severity: "error", description: "Native finding", items: [item(x)] });
const report = (violations: unknown[] = [], opens = 0) => ({ coordinate_units: "mm", kicad_version: "10.0.6", included_severities: ["error", "warning", "exclusion"], violations, unconnected_items: Array.from({ length: opens }, () => ({ ...error("unconnected_items"), items: [item(), item(3)] })), ignored_checks: [] });

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

// A bogus inherited open must not authorize a newly disconnected candidate.
test("rejects malformed connectivity findings in either report", () => {
  const valid = report([], 1).unconnected_items[0]!;
  for (const malformed of [null, {}, { ...valid, type: "clearance" }, { ...valid, severity: "warning" }, { ...valid, items: [] }, { ...valid, items: [item()] }, { ...valid, items: [item(), { description: "pad", pos: { x: NaN, y: 2 } }] }]) {
    expect(() => compareNativeReports({ ...report(), unconnected_items: [malformed] }, report([], 1))).toThrow();
    expect(() => compareNativeReports(report([], 1), { ...report(), unconnected_items: [malformed] })).toThrow();
  }
});

 test("native gate blocks deletion of original copper before native execution", async () => {
  const directory = await mkdtemp(join(tmpdir(), "native-source-copper-"));
  try {
    const before = join(directory, "before.kicad_pcb"), after = join(directory, "after.kicad_pcb");
    const shell = (items: string) => `(kicad_pcb (version 20260206) (generator "pcbnew")
      (general (thickness 1.6)) (paper "A4")
      (layers (0 "F.Cu" signal) (2 "B.Cu" signal) (25 "Edge.Cuts" user)) (setup)
      (gr_rect (start 0 0) (end 10 10) (stroke (width 0.05) (type default))
        (fill none) (layer "Edge.Cuts") (uuid "00000000-0000-0000-0000-000000000001")) ${items})`;
    await writeFile(before, shell('(segment (start 2 2) (end 4 2) (width 0.25) (layer "F.Cu") (net 0) (uuid "00000000-0000-0000-0000-000000000002"))'));
    await writeFile(after, shell(''));
    for (const path of [before, after]) await writeFile(path.replace(".kicad_pcb", ".kicad_pro"), "{}");
    await expect(checkNativeBoards(before, after)).rejects.toThrow("Candidate source copper differs");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

// Identical numeric copper nets do not imply identical electrical ownership.
test.skipIf(!Bun.which("kicad-cli"))("native gate blocks renamed net ownership even when native reports are clean", async () => {
  const directory = await mkdtemp(join(tmpdir(), "native-net-ownership-"));
  try {
    const before = join(directory, "before.kicad_pcb"), after = join(directory, "after.kicad_pcb");
    const board = (name: string) => `(kicad_pcb (version 20260206) (generator "pcbnew")
      (general (thickness 1.6)) (paper "A4")
      (layers (0 "F.Cu" signal) (2 "B.Cu" signal) (25 "Edge.Cuts" user)) (setup)
      (net 1 "${name}")
      (segment (start 2 2) (end 4 2) (width 0.25) (layer "F.Cu") (net 1)
        (uuid "00000000-0000-0000-0000-000000000002"))
      (gr_rect (start 0 0) (end 10 10) (stroke (width 0.05) (type default))
        (fill none) (layer "Edge.Cuts") (uuid "00000000-0000-0000-0000-000000000001")))`;
    await writeFile(before, board("GND")); await writeFile(after, board("VCC"));
    for (const path of [before, after]) await writeFile(path.replace(".kicad_pcb", ".kicad_pro"), "{}");
    await expect(checkNativeBoards(before, after)).rejects.toThrow("Candidate net table differs");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

// A refill can stay clean after a thermal-rule change; report comparison cannot
// establish that the candidate preserved the source zone definition.
test.skipIf(!Bun.which("kicad-cli"))("native gate blocks changed zone thermal rules even with clean reports", async () => {
  const directory = await mkdtemp(join(tmpdir(), "native-zone-rules-"));
  try {
    const before = join(directory, "before.kicad_pcb"), after = join(directory, "after.kicad_pcb");
    const board = `(kicad_pcb (version 20260206) (generator "pcbnew")
      (general (thickness 1.6)) (paper "A4")
      (layers (0 "F.Cu" signal) (2 "B.Cu" signal) (25 "Edge.Cuts" user)) (setup)
      (net 1 "GND")
      (gr_rect (start 0 0) (end 10 10) (stroke (width 0.05) (type default))
        (fill none) (layer "Edge.Cuts") (uuid "00000000-0000-0000-0000-000000000001"))
      (zone (net 1) (net_name "GND") (layer "F.Cu")
        (uuid "00000000-0000-0000-0000-000000000002")
        (hatch edge 0.5) (connect_pads (clearance 0.2)) (min_thickness 0.25)
        (fill yes (thermal_gap 0.3) (thermal_bridge_width 0.3))
        (polygon (pts (xy 1 1) (xy 9 1) (xy 9 9) (xy 1 9)))))`;
    await writeFile(before, board);
    await writeFile(after, board.replace('(thermal_gap 0.3)', '(thermal_gap 0.1)'));
    for (const path of [before, after]) await writeFile(path.replace(".kicad_pcb", ".kicad_pro"), "{}");
    await expect(checkNativeBoards(before, after)).rejects.toThrow("Candidate zone definitions differ");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

// Native DRC cannot prove that a disconnected source pad was retained.
test.skipIf(!Bun.which("kicad-cli"))("native gate blocks removed source pads even with clean reports", async () => {
  const directory = await mkdtemp(join(tmpdir(), "native-source-pads-"));
  try {
    const before = join(directory, "before.kicad_pcb"), after = join(directory, "after.kicad_pcb");
    const pad = '(pad "1" smd rect (at 0 0) (size 1 1) (layers "F.Cu" "F.Paste" "F.Mask") (thermal_gap 0.3))';
    const board = `(kicad_pcb (version 20260206) (generator "pcbnew")
      (general (thickness 1.6)) (paper "A4")
      (layers (0 "F.Cu" signal) (2 "B.Cu" signal) (25 "Edge.Cuts" user)) (setup)
      (footprint "control" (layer "F.Cu") (at 5 5) ${pad})
      (gr_rect (start 0 0) (end 10 10) (stroke (width 0.05) (type default))
        (fill none) (layer "Edge.Cuts") (uuid "00000000-0000-0000-0000-000000000001")))`;
    await writeFile(before, board); await writeFile(after, board.replace(pad, ''));
    for (const path of [before, after]) await writeFile(path.replace(".kicad_pcb", ".kicad_pro"), "{}");
    await expect(checkNativeBoards(before, after)).rejects.toThrow("Candidate source pads differ");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
