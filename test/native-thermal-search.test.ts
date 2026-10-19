import { expect, test } from "bun:test";
import { thermalProgress } from "../tools/native-thermal-search.ts";

const report = (errors: number) => ({ violations: Array.from({ length: errors }, () => ({ type: "starved_thermal", severity: "error" })) });
const baseline = { newErrors: [{ type: "starved_thermal" }, { type: "starved_thermal" }] };
const valid = { newErrors: [{ type: "starved_thermal" }], lostTerminalPairs: 0, opensBefore: 0, opensAfter: 0, repair: { accepted: true, routedReport: report(2), opensBefore: 0, opensAfter: 0 }, candidateReport: report(1) };
test("partial thermal progress requires both source and routed connectivity", () => {
  expect(thermalProgress(baseline, valid)).toBe(true);
  expect(thermalProgress(baseline, { ...valid, opensAfter: 1 })).toBe(false);
  expect(thermalProgress(baseline, { ...valid, lostTerminalPairs: 1 })).toBe(false);
  expect(thermalProgress(baseline, { ...valid, repair: { ...valid.repair, accepted: false } })).toBe(false);
  expect(thermalProgress(baseline, { ...valid, newErrors: baseline.newErrors })).toBe(false);
  expect(thermalProgress(baseline, { ...valid, newErrors: [{ type: "clearance" }] })).toBe(false);
  expect(thermalProgress(baseline, { ...valid, candidateReport: report(2) })).toBe(false);
});

import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { searchNativeThermals } from "../tools/native-thermal-search.ts";
const hasNative = !!Bun.which("kicad-cli") && Bun.spawnSync(["python3", "-c", "import pcbnew"], { stdout: "ignore", stderr: "ignore" }).exitCode === 0;
test.skipIf(!hasNative)("bounded native search repairs two complete-board thermals without losing routed connections", async () => {
  const root = await mkdtemp(join(tmpdir(), "thermal-search-test-"));
  const fixture = "test/fixtures/native-thermal-search/";
  try {
    for (const role of ["source", "routed"]) {
      await writeFile(join(root, `${role}.kicad_pcb`), gunzipSync(await readFile(fixture + `${role}.kicad_pcb.gz`)));
      for (const ext of [".kicad_pro", ".kicad_dru"]) await writeFile(join(root, role + ext), await readFile(fixture + "board" + ext));
    }
    const source = join(root, "source.kicad_pcb"), routed = join(root, "routed.kicad_pcb");
    const before = await readFile(routed);
    const failed = await searchNativeThermals(source, routed, join(root, "partial.json"), join(root, "partial"), 1);
    expect(failed.published).toBe(false);
    expect(failed.validation.newErrors).toHaveLength(1);
    expect(await Bun.file(join(root, "partial.json")).exists()).toBe(false);
    expect(await readFile(routed)).toEqual(before);
    const result = await searchNativeThermals(source, routed, join(root, "accepted.json"), join(root, "complete"));
    expect(result.repaired).toBe(true);
    expect(result.published).toBe(true);
    expect(result.validation.newErrors).toHaveLength(0);
    expect(result.validation.opensAfter).toBe(0);
    expect(result.validation.lostTerminalPairs).toBe(0);
    expect(result.validation.repair?.lostTerminalPairs).toBe(0);
    expect(result.attempts.filter(a => a.progress)).toHaveLength(2);
    expect(await readFile(routed)).toEqual(before);
    const bundle = JSON.parse(await readFile(join(root, "accepted.json"), "utf8"));
    expect(bundle.format).toBe("fab-router-native-repair-v1");
    expect(Buffer.from(bundle.routed[0].base64, "base64")).toEqual(before);
  } finally { await rm(root, { recursive: true, force: true }); }
}, 600_000);
