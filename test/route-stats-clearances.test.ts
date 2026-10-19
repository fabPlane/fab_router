import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDrc, readDsn, routeDsn } from "../src/api.ts";

// The track's copper edge is 200 um from the upper board edge.
const dsn = `(pcb stats
  (resolution um 1) (unit um)
  (structure (layer F.Cu (type signal))
    (boundary (rect pcb 0 0 10000 10000))
    (rule (width 200) (clearance 100)))
  (placement) (library)
  (network (net N) (class default N (rule (width 200) (clearance 100))))
  (wiring (wire (path F.Cu 200 2000 9700 8000 9700) (net N) (type protect))))`;
const settings = { maxPasses: 0, fanoutEnabled: false, optimizerEnabled: false };

describe("route statistics use effective clearance rules", () => {
  for (const [name, text, clearance, expected] of [
    ["stricter edge rule", dsn, 300, 1],
    ["explicit zero override", dsn.replaceAll("9700", "9850"), 0, 0],
  ] as const) {
    test(`routeDsn: ${name}`, () => {
      const read = readDsn(text);
      if (!read.ok) throw new Error(read.error.message);
      expect(checkDrc(read.layout, { copperToEdgeClearanceUm: clearance }).counts.violations).toBe(expected);
      const result = routeDsn(text, { ...settings, copperToEdgeClearanceUm: clearance });
      if (!result.ok) throw new Error(result.error.message);
      expect(result.report.violationsBefore).toBe(expected);
      expect(result.statsBefore.violations.total).toBe(expected);
      expect(result.statsAfter.violations.total).toBe(expected);
      expect(result.statsAfter.violations.byRule).toEqual(result.statsBefore.violations.byRule);
    });

    test(`CLI route JSON: ${name}`, () => {
      const dir = mkdtempSync(join(tmpdir(), "route-stats-"));
      try {
        const input = join(dir, "board.dsn"), json = join(dir, "report.json");
        writeFileSync(input, text);
        const proc = Bun.spawnSync([process.execPath, "src/cli.ts", "route", input, "--json", json,
          ...Object.entries({ ...settings, copperToEdgeClearanceUm: clearance }).flatMap(([k, v]) => ["--set", `${k}=${v}`])],
        { cwd: join(import.meta.dir, "..") });
        expect(proc.exitCode).toBe(0);
        const result = JSON.parse(readFileSync(json, "utf8"));
        expect(result.report.violationsBefore).toBe(expected);
        expect(result.statsBefore.violations.total).toBe(expected);
        expect(result.statsAfter.violations.total).toBe(expected);
      } finally { rmSync(dir, { recursive: true, force: true }); }
    });
  }
});

// N-07: skipping a route group does not remove it from whole-board statistics.
const ignoredDsn = `(pcb ignored
  (resolution um 1) (unit um)
  (structure (layer F.Cu (type signal)) (boundary (rect pcb 0 0 10000 10000))
    (rule (width 200) (clearance 100)))
  (placement (component P (place A 2000 5000 front 0) (place B 8000 5000 front 0)))
  (library (image P (pin p 1 0 0)) (padstack p (shape (circle F.Cu 500))))
  (network (net N (pins A-1 B-1)) (class skip N (rule (width 200) (clearance 100)))))`;

test("routeDsn statistics retain connections in ignored routing groups", () => {
  const result = routeDsn(ignoredDsn, { ...settings, ignoreNetGroups: ["skip"] });
  if (!result.ok) throw new Error(result.error.message);
  expect(result.report.incompleteBefore).toBe(0);
  expect(result.statsBefore.connections).toEqual({ maximum: 1, incomplete: 1 });
  expect(result.statsAfter.connections).toEqual({ maximum: 1, incomplete: 1 });
});

test("CLI route statistics retain connections in ignored routing groups", () => {
  const dir = mkdtempSync(join(tmpdir(), "route-stats-ignore-"));
  try {
    const input = join(dir, "board.dsn"), json = join(dir, "report.json");
    writeFileSync(input, ignoredDsn);
    const proc = Bun.spawnSync([process.execPath, "src/cli.ts", "route", input, "--json", json,
      "--set", "ignoreNetGroups=skip",
      ...Object.entries(settings).flatMap(([k, v]) => ["--set", `${k}=${v}`])],
    { cwd: join(import.meta.dir, "..") });
    expect(proc.exitCode).toBe(0);
    const result = JSON.parse(readFileSync(json, "utf8"));
    expect(result.report.incompleteBefore).toBe(0);
    expect(result.statsBefore.connections).toEqual({ maximum: 1, incomplete: 1 });
    expect(result.statsAfter.connections).toEqual({ maximum: 1, incomplete: 1 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
