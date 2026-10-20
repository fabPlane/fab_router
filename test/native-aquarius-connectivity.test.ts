import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assertSourceCopper } from "../tools/kicad-board-rules.ts";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkNativeBoards } from "../tools/native-drc-gate.ts";

const hasNative = !!Bun.which("kicad-cli") && !!Bun.which("python3") && Bun.spawnSync(["python3", "-c", "import pcbnew"], { stdout: "ignore", stderr: "ignore" }).exitCode === 0;

// Added-copper reduction of a scored failure; deleting routes is not a repair.
test.skipIf(!hasNative)("Aquarius signal copper disconnects a source ground pad after native refill", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-aquarius-connectivity-"));
  const fixture = "test/fixtures/native-aquarius-thermal";
  try {
    const source = gunzipSync(await readFile(`${fixture}/input.kicad_pcb.gz`));
    const text = source.toString("utf8"), end = text.lastIndexOf(")");
    const segments = (await readFile(`${fixture}/connectivity-added.sexpr`, "utf8")).trim().split("\n");
    const input = join(root, "input.kicad_pcb"), candidate = join(root, "candidate.kicad_pcb");
    await writeFile(input, source);
    for (const name of ["input", "candidate"]) for (const ext of [".kicad_pro", ".kicad_dru"]) {
      await writeFile(join(root, `${name}${ext}`), await readFile(`${fixture}/board${ext}`));
    }
    const check = async (added: string[]) => {
      await writeFile(candidate, `${text.slice(0, end)}\n${added.join("\n")}\n${text.slice(end)}`);
      return checkNativeBoards(input, candidate);
    };
    expect(segments).toHaveLength(3);
    const reduced = await check(segments);
    expect(reduced.newErrors.map(error => error.type)).toEqual(["starved_thermal"]);
    expect(reduced.opensAfter).toBe(114);
    expect(reduced.opensBefore).toBe(110);
    expect(reduced.lostTerminalPairs).toBe(61);
    expect(reduced.accepted).toBe(false);
    expect(reduced.lostPairWitnesses.every(pair => pair.some(identity => {
      const pad = JSON.parse(identity) as unknown[];
      return pad[1] === "U1" && pad[4] === "39";
    }))).toBe(true);
    for (let remove = 0; remove < segments.length; remove++) {
      const deletion = await check(segments.filter((_, index) => index !== remove));
      expect(deletion.lostTerminalPairs).toBe(0);
    }
    // Native refill of a local detour can report restored connectivity while
    // still failing the original open budget. The evidence also records unsafe
    // native track-net reassignment; this fixture is not a legal repair.
    const detour = (await readFile(`${fixture}/connectivity-detour.sexpr`, "utf8")).trim().split("\n");
    const rerouted = await check(detour);
    expect(rerouted.newErrors).toEqual([]);
    expect(rerouted.lostTerminalPairs).toBe(0);
    expect(rerouted.opensAfter).toBe(112);
    expect(rerouted.opensBefore).toBe(110);
    expect(rerouted.accepted).toBe(false);
    expect(rerouted.nativeCopperPreserved).toBe(false);
    expect(rerouted.nativeCopperChecks).toEqual([true, false]);
    const submitted = await readFile(candidate, "utf8");
    await promisify(execFile)("kicad-cli", ["pcb", "drc", "--severity-all", "--format", "json",
      "--units", "mm", "--refill-zones", "--save-board", "--output", join(root, "refill.json"), candidate],
      { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
    const saved = await readFile(candidate, "utf8");
    expect(() => assertSourceCopper(submitted, saved)).toThrow("Candidate source copper differs");
    const reassigned = detour.map(segment => segment.replace('(net "Net-(C1-Pad1)")', '(net "Net-(R1-Pad1)")'));
    const expected = `${text.slice(0, end)}\n${reassigned.join("\n")}\n${text.slice(end)}`;
    expect(() => assertSourceCopper(expected, saved)).not.toThrow();
    expect(() => assertSourceCopper(saved, expected)).not.toThrow();
    const control = await check([]);
    expect(control.newErrors).toEqual([]);
    expect(control.opensAfter).toBe(110);
    expect(control.lostTerminalPairs).toBe(0);
    expect(control.accepted).toBe(true);
    expect(await readFile(input)).toEqual(source);
  } finally { await rm(root, { recursive: true, force: true }); }
}, 180_000);
