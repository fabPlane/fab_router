import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkNativeBoards } from "../tools/native-drc-gate.ts";

const hasNative = !!Bun.which("kicad-cli") && !!Bun.which("python3") && Bun.spawnSync(["python3", "-c", "import pcbnew"], { stdout: "ignore", stderr: "ignore" }).exitCode === 0;

test.skipIf(!hasNative)("one horizontal signal segment starves a preserved ground-pad thermal", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-aquarius-thermal-"));
  const fixture = "test/fixtures/native-aquarius-thermal";
  try {
    const source = gunzipSync(await readFile(`${fixture}/input.kicad_pcb.gz`));
    const text = source.toString("utf8"), end = text.lastIndexOf(")");
    const added = await readFile(`${fixture}/added.sexpr`, "utf8");
    const input = join(root, "input.kicad_pcb"), candidate = join(root, "candidate.kicad_pcb");
    await writeFile(input, source);
    await writeFile(candidate, `${text.slice(0, end)}\n${added}\n${text.slice(end)}`);
    for (const name of ["input", "candidate"]) for (const ext of [".kicad_pro", ".kicad_dru"]) {
      await writeFile(join(root, `${name}${ext}`), await readFile(`${fixture}/board${ext}`));
    }
    const checked = await checkNativeBoards(input, candidate);
    expect(checked.newErrors.map(error => error.type)).toEqual(["starved_thermal"]);
    expect(checked.newErrors[0]!.description).toContain("actual 1");
    expect(checked.newErrors[0]!.items.some(item => item.uuid === "40448888-06d6-474b-a038-09dfd03ed49c")).toBe(true);
    expect(checked.opensBefore).toBe(110);
    expect(checked.opensAfter).toBe(111);
    expect(checked.lostTerminalPairs).toBe(0);
    expect(checked.accepted).toBe(false);
    const full = gunzipSync(await readFile(`${fixture}/full-added.sexpr.gz`)).toString("utf8");
    await writeFile(candidate, `${text.slice(0, end)}\n${full}\n${text.slice(end)}`);
    const complete = await checkNativeBoards(input, candidate);
    expect(complete.newErrors.map(error => error.type)).toEqual(Array(6).fill("starved_thermal"));
    expect(complete.opensAfter).toBe(15);
    expect(complete.lostTerminalPairs).toBe(348);
    expect(complete.accepted).toBe(false);
    const control = await checkNativeBoards(input, input);
    expect(control.newErrors).toEqual([]);
    expect(control.opensAfter).toBe(110);
    expect(control.lostTerminalPairs).toBe(0);
    expect(control.accepted).toBe(true);
    expect(await readFile(input)).toEqual(source);
  } finally { await rm(root, { recursive: true, force: true }); }
}, 120_000);

import { searchNativeThermals } from "../tools/native-thermal-search.ts";
test.skipIf(!hasNative)("bounded axial search refuses report-clean detours that change native copper ownership", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-axial-search-"));
  const fixture = "test/fixtures/native-aquarius-thermal";
  try {
    const source = gunzipSync(await readFile(`${fixture}/axial-input.kicad_pcb.gz`));
    const text = source.toString("utf8"), end = text.lastIndexOf(")");
    const added = await readFile(`${fixture}/added.sexpr`, "utf8");
    const input = join(root, "input.kicad_pcb"), routed = join(root, "routed.kicad_pcb");
    await writeFile(input, source);
    await writeFile(routed, `${text.slice(0, end)}\n${added}\n${text.slice(end)}`);
    const routedBefore = await readFile(routed);
    for (const name of ["input", "routed"]) for (const ext of [".kicad_pro", ".kicad_dru"]) await writeFile(join(root, `${name}${ext}`), await readFile(`${fixture}/board${ext}`));
    const result = await searchNativeThermals(input, routed, join(root, "accepted.json"), join(root, "search"), 1);
    expect(result.published).toBe(false);
    expect(result.repaired).toBe(false);
    expect(result.attempts).toHaveLength(6);
    expect(result.attempts.every(attempt => !attempt.progress)).toBe(true);
    expect(await Bun.file(join(root, "accepted.json")).exists()).toBe(false);
    // This formerly published first detour has clean reports and connectivity,
    // but native loading changes its net. These are independent safety checks.
    const first = JSON.parse(await readFile(join(root, "search/stage-0/000.kicad_pcb.json"), "utf8"));
    expect(first.newErrors).toEqual([]);
    expect(first.opensAfter).toBe(110);
    expect(first.lostTerminalPairs).toBe(0);
    expect(first.repair.lostTerminalPairs).toBe(0);
    expect(first.nativeCopperChecks).toEqual([true, false, true]);
    expect(first.repair.accepted).toBe(false);
    expect(first.accepted).toBe(false);
    // Exhaustion retains the original unsafe-thermal board without publishing it.
    expect(result.validation.newErrors.map(error => error.type)).toEqual(["starved_thermal"]);
    expect(result.validation.opensAfter).toBe(111);
    expect(await readFile(input)).toEqual(source);
    expect(await readFile(routed)).toEqual(routedBefore);
  } finally { await rm(root, { recursive: true, force: true }); }
}, 180_000);
