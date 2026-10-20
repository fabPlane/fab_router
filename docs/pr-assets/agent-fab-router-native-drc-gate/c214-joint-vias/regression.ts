import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assertSourceCopper } from "../tools/kicad-board-rules.ts";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkNativeBoards, checkNativeRepair } from "../tools/native-drc-gate.ts";

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

// Keep complete generated nets: an isolated track cut can introduce unrelated opens.
test.skipIf(!hasNative)("Aquarius complete generated nets still disconnect source ground terminals", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-aquarius-complete-nets-"));
  const fixture = "test/fixtures/native-aquarius-thermal";
  try {
    const source = gunzipSync(await readFile(`${fixture}/input.kicad_pcb.gz`));
    const text = source.toString("utf8"), end = text.lastIndexOf(")");
    const full = gunzipSync(await readFile(`${fixture}/full-added.sexpr.gz`)).toString("utf8").trim().split("\n");
    const selected = (await readFile(`${fixture}/connectivity-nets.sexpr`, "utf8")).trim().split("\n");
    const net = (line: string) => line.match(/\(net ("(?:\\.|[^"\\])*"|[^\s()]+)\)/)![1]!;
    const names = [...new Set(selected.map(net))].sort();
    // Exact line inventory proves no generated copper was pruned within a net.
    for (const name of names) expect(selected.filter(line => net(line) === name).sort())
      .toEqual(full.filter(line => net(line) === name).sort());
    const input = join(root, "input.kicad_pcb"), candidate = join(root, "candidate.kicad_pcb");
    await writeFile(input, source);
    for (const name of ["input", "candidate"]) for (const ext of [".kicad_pro", ".kicad_dru"])
      await writeFile(join(root, `${name}${ext}`), await readFile(`${fixture}/board${ext}`));
    const check = async (lines: string[]) => {
      await writeFile(candidate, `${text.slice(0, end)}\n${lines.join("\n")}\n${text.slice(end)}`);
      return checkNativeBoards(input, candidate);
    };
    const result = await check(selected);
    expect(result.accepted).toBe(false);
    expect(result.nativeCopperPreserved).toBe(true);
    expect(names).toEqual(['"+3V3"', '"/Inputs/TCK"']);
    expect(selected).toHaveLength(74);
    expect(result.newErrors.map(error => error.type)).toEqual(["starved_thermal", "starved_thermal"]);
    expect(result.opensBefore).toBe(110);
    expect(result.opensAfter).toBe(94);
    expect(result.lostTerminalPairs).toBe(61);
    expect(result.lostPairWitnesses.every(pair => pair.some(identity => {
      const pad = JSON.parse(identity) as unknown[];
      return pad[1] === "U1" && pad[4] === "53";
    }))).toBe(true);
    for (const name of names) {
      const deletion = await check(selected.filter(line => net(line) !== name));
      expect(deletion.lostTerminalPairs).toBe(0);
      expect(deletion.nativeCopperPreserved).toBe(true);
      // +3V3 alone has the same thermal findings but does not split U1.53.
      expect(deletion.newErrors.map(error => error.type)).toEqual(name === '"+3V3"' ? [] : ["starved_thermal", "starved_thermal"]);
      expect(deletion.opensAfter).toBe(name === '"+3V3"' ? 108 : 95);
    }
    expect(await readFile(input)).toEqual(source);
  } finally { await rm(root, { recursive: true, force: true }); }
}, 300_000);

// A partial geometric recovery, not a clean route: keep both thermal failures
// visible while proving that the source ground component can be reconnected.
test.skipIf(!hasNative)("moving a generated via pair restores source ground connectivity without hiding thermals", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-aquarius-via-pair-"));
  const fixture = "test/fixtures/native-aquarius-thermal";
  try {
    const source = gunzipSync(await readFile(`${fixture}/input.kicad_pcb.gz`));
    const text = source.toString(), end = text.lastIndexOf(")");
    const before = (await readFile(`${fixture}/connectivity-nets.sexpr`, "utf8")).trim().split("\n");
    const after = (await readFile(`${fixture}/connectivity-via-pair.sexpr`, "utf8")).trim().split("\n");
    expect(after).toHaveLength(before.length);
    // Only these generated vias and their three attached tracks move. The
    // original source, every other generated item, net, width and drill remain.
    const changed = before.filter((line, i) => line !== after[i]);
    expect(changed).toHaveLength(5);
    expect(changed.filter(line => line.startsWith("(via "))).toHaveLength(2);
    const expected = before.map(line => line
      .replaceAll("163.3455 51.5585", "163.2455 51.6585")
      .replaceAll("162.9939 50.8553", "162.8939 50.9553"));
    expect(after).toEqual(expected);
    const paths = ["input", "routed", "candidate"].map(name => join(root, `${name}.kicad_pcb`));
    for (let i = 0; i < paths.length; i++) {
      const copper = i === 0 ? "" : (i === 1 ? before : after).join("\n");
      await writeFile(paths[i]!, `${text.slice(0, end)}\n${copper}\n${text.slice(end)}`);
      for (const ext of [".kicad_pro", ".kicad_dru"])
        await writeFile(paths[i]!.replace(/\.kicad_pcb$/, ext), await readFile(`${fixture}/board${ext}`));
    }
    const original = await checkNativeBoards(paths[0]!, paths[1]!);
    expect(original.lostTerminalPairs).toBe(61);
    const recovered = await checkNativeRepair(paths[0]!, paths[1]!, paths[2]!);
    expect(recovered.nativeCopperChecks).toEqual([true, true, true]);
    expect(recovered.lostTerminalPairs).toBe(0);
    expect(recovered.repair?.lostTerminalPairs).toBe(0);
    expect(recovered.opensBefore).toBe(110);
    expect(recovered.opensAfter).toBe(93);
    expect(recovered.newErrors.map(error => error.type)).toEqual(["starved_thermal", "starved_thermal"]);
    // Restored connections do not waive the two remaining thermal violations.
    expect(recovered.accepted).toBe(false);
    expect(recovered.repair?.accepted).toBe(true);
  } finally { await rm(root, { recursive: true, force: true }); }
}, 120_000);

// The reduced via-pair control omits LED4. Keep the complete scored copper here:
// a TCK-only move adds clearances, while a coordinated LED4 move preserves the
// existing routed pairs. This remains a partial recovery, with six thermals.
test.skipIf(!hasNative)("coordinated generated via moves reconnect the full-board ground corridor without added clearances", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-aquarius-joint-vias-"));
  const fixture = "test/fixtures/native-aquarius-thermal";
  try {
    const source = gunzipSync(await readFile(`${fixture}/input.kicad_pcb.gz`));
    const text = source.toString(), end = text.lastIndexOf(")");
    const full = gunzipSync(await readFile(`${fixture}/full-added.sexpr.gz`)).toString().trim().split("\n");
    const upperOnly = full.map(line => line.replaceAll("162.9939 50.8553", "162.8939 50.9553"));
    const joint = upperOnly.map(line => line
      .replaceAll("162.3543 48.764", "162.2343 48.764")
      .replaceAll("162.3543 51.5768", "162.2343 51.5768"));
    expect(full).toHaveLength(466);
    const changed = full.filter((line, i) => line !== joint[i]);
    expect(changed).toHaveLength(8);
    expect(changed.filter(line => line.startsWith("(via "))).toHaveLength(3);
    // Undo coordinates byte-for-byte: no net, width, drill or other item edits.
    expect(joint.map(line => line
      .replaceAll("162.8939 50.9553", "162.9939 50.8553")
      .replaceAll("162.2343 48.764", "162.3543 48.764")
      .replaceAll("162.2343 51.5768", "162.3543 51.5768"))).toEqual(full);
    for (const [name, lines] of [["input", []], ["routed", full], ["upper", upperOnly], ["joint", joint]] as const) {
      const path = join(root, `${name}.kicad_pcb`);
      await writeFile(path, `${text.slice(0, end)}\n${lines.join("\n")}\n${text.slice(end)}`);
      for (const ext of [".kicad_pro", ".kicad_dru"])
        await writeFile(join(root, `${name}${ext}`), await readFile(`${fixture}/board${ext}`));
    }
    const input = join(root, "input.kicad_pcb"), routed = join(root, "routed.kicad_pcb");
    const blocked = await checkNativeRepair(input, routed, join(root, "upper.kicad_pcb"));
    expect(blocked.newErrors.filter(error => error.type === "clearance")).toHaveLength(3);
    expect(blocked.repair?.accepted).toBe(false);
    const recovered = await checkNativeRepair(input, routed, join(root, "joint.kicad_pcb"));
    expect(recovered.nativeCopperChecks).toEqual([true, true, true]);
    expect(recovered.newErrors.map(error => error.type)).toEqual(Array(6).fill("starved_thermal"));
    expect(recovered.opensBefore).toBe(110);
    expect(recovered.opensAfter).toBe(14);
    expect(recovered.lostTerminalPairs).toBe(292);
    expect(recovered.repair?.lostTerminalPairs).toBe(0);
    expect(recovered.repair?.accepted).toBe(true);
    // Neither the remaining source disconnections nor thermal failures are waived.
    expect(recovered.accepted).toBe(false);
    expect(await readFile(input)).toEqual(Buffer.from(`${text.slice(0, end)}\n\n${text.slice(end)}`));
  } finally { await rm(root, { recursive: true, force: true }); }
}, 180_000);
