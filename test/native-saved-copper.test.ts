import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkNativeBoards, checkNativeRepair, publishNativeCandidate } from "../tools/native-drc-gate.ts";

const hasNative = !!Bun.which("kicad-cli") && Bun.spawnSync(["python3", "-c", "import pcbnew"], { stdout: "ignore", stderr: "ignore" }).exitCode === 0;
test.skipIf(!hasNative)("native gate blocks clean load-time ownership reassignment and bundle publication", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-saved-copper-"));
  try {
    const input = join(root, "input.kicad_pcb"), candidate = join(root, "candidate.kicad_pcb");
    const fixture = "test/fixtures/native-saved-copper";
    const sourceBytes = await readFile(`${fixture}/input.kicad_pcb`, "utf8");
    const candidateBytes = await readFile(`${fixture}/candidate.kicad_pcb`, "utf8");
    await writeFile(input, sourceBytes); await writeFile(candidate, candidateBytes);
    for (const path of [input, candidate]) await writeFile(path.replace(".kicad_pcb", ".kicad_pro"), await readFile(`${fixture}/board.kicad_pro`, "utf8"));
    const result = await checkNativeBoards(input, candidate);
    expect(result.newErrors).toEqual([]);
    expect(result.opensBefore).toBe(0);
    expect(result.opensAfter).toBe(0);
    expect(result.lostTerminalPairs).toBe(0);
    expect(result.accepted).toBe(false);
    expect(result.nativeCopperChecks).toEqual([true, false]);
    const repair = await checkNativeRepair(input, input, candidate);
    expect(repair.accepted).toBe(false);
    expect(repair.repair?.accepted).toBe(false);
    const output = join(root, "bundle.json");
    expect((await publishNativeCandidate(input, candidate, output)).published).toBe(false);
    expect(await Bun.file(output).exists()).toBe(false);
    expect(await readFile(input, "utf8")).toBe(sourceBytes);
    expect(await readFile(candidate, "utf8")).toBe(candidateBytes);
    // Matching assigned ownership is still accepted across legacy/native formats.
    await writeFile(candidate, await readFile(`${fixture}/control.kicad_pcb`, "utf8"));
    expect((await checkNativeBoards(input, candidate)).accepted).toBe(true);
  } finally { await rm(root, { recursive: true, force: true }); }
}, 120_000);
