import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkNativeRepair } from "../tools/native-drc-gate.ts";

const hasNative = !!Bun.which("kicad-cli") && !!Bun.which("python3") && Bun.spawnSync(["python3", "-c", "import pcbnew"], { stdout: "ignore", stderr: "ignore" }).exitCode === 0;

test.skipIf(!hasNative)("coordinated power-via move restores the second ground spoke without disconnecting terminals", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-power-via-"));
  const fixture = "test/fixtures/native-aquarius-thermal";
  try {
    const source = gunzipSync(await readFile(`${fixture}/input.kicad_pcb.gz`));
    const text = source.toString(), end = text.lastIndexOf(")");
    // Complete generated power net after the independently checked U1.53 detour.
    // Moving only the via leaves incident tracks behind; move all four items.
    const added = gunzipSync(await readFile(`${fixture}/power-stage0-added.sexpr.gz`)).toString();
    const point = /\((at|start|end) 164\.1045 50\.6008\)/g;
    expect([...added.matchAll(point)]).toHaveLength(4);
    const moved = added.replace(point, "($1 163.804500 50.900800)");
    expect([...moved.matchAll(point)]).toHaveLength(0);
    const board = (copper: string) => `${text.slice(0, end)}\n${copper}\n${text.slice(end)}`;
    const input = join(root, "input.kicad_pcb"), routed = join(root, "routed.kicad_pcb"), candidate = join(root, "candidate.kicad_pcb");
    await writeFile(input, source);
    await writeFile(routed, board(added));
    await writeFile(candidate, board(moved));
    for (const name of ["input", "routed", "candidate"]) for (const ext of [".kicad_pro", ".kicad_dru"]) {
      await writeFile(join(root, `${name}${ext}`), await readFile(`${fixture}/board${ext}`));
    }
    const before = await checkNativeRepair(input, routed, routed);
    expect(before.newErrors.map(error => error.type)).toEqual(["starved_thermal"]);
    expect(before.newErrors[0]!.items.some(item => item.uuid === "57ce983e-ec4e-48a5-9547-b23514d0d6a4")).toBe(true);
    expect(before.opensAfter).toBe(95);
    expect(before.lostTerminalPairs).toBe(0);
    expect(before.nativeCopperChecks).toEqual([true, true, true]);
    expect(before.accepted).toBe(false);
    const after = await checkNativeRepair(input, routed, candidate);
    expect(after.newErrors).toEqual([]);
    expect(after.opensAfter).toBe(95);
    expect(after.lostTerminalPairs).toBe(0);
    expect(after.repair?.lostTerminalPairs).toBe(0);
    expect(after.nativeCopperChecks).toEqual([true, true, true]);
    expect(after.repair?.accepted).toBe(true);
    expect(after.accepted).toBe(true);
    expect(await readFile(input)).toEqual(source);
    expect(await readFile(routed, "utf8")).toBe(board(added));
    expect(await readFile(candidate, "utf8")).toBe(board(moved));
  } finally { await rm(root, { recursive: true, force: true }); }
}, 120_000);
