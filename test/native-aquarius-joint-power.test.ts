import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkNativeRepair } from "../tools/native-drc-gate.ts";

const hasNative = !!Bun.which("kicad-cli") && !!Bun.which("python3") && Bun.spawnSync(["python3", "-c", "import pcbnew"], { stdout: "ignore", stderr: "ignore" }).exitCode === 0;

// Full generated copper is necessary: the isolated power-net repair splits
// ground at U1.53. A second connected via move opens that corridor again.
// Five other thermal errors and source disconnections still forbid publication.
test.skipIf(!hasNative)("coordinated full-board power and signal via moves preserve routed terminals while clearing one thermal", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-aquarius-joint-power-"));
  const fixture = "test/fixtures/native-aquarius-thermal";
  try {
    const source = gunzipSync(await readFile(`${fixture}/input.kicad_pcb.gz`));
    const text = source.toString(), end = text.lastIndexOf(")");
    const added = gunzipSync(await readFile(`${fixture}/full-power-stage0-added.sexpr.gz`)).toString();
    const power = added.replace(/\((at|start|end) 164\.1045 50\.6008\)/g, "($1 163.804500 50.900800)");
    const joint = power.replace(/\((at|start|end) 163\.3455 51\.5585\)/g, "($1 163.345500 52.078500)");
    expect(added.trim().split("\n")).toHaveLength(468);
    expect(power).not.toBe(added);
    expect(joint).not.toBe(power);
    for (const [name, copper] of [["input", ""], ["routed", added], ["power", power], ["joint", joint]] as const) {
      await writeFile(join(root, `${name}.kicad_pcb`), name === "input" ? source : `${text.slice(0, end)}\n${copper}\n${text.slice(end)}`);
      for (const ext of [".kicad_pro", ".kicad_dru"])
        await writeFile(join(root, `${name}${ext}`), await readFile(`${fixture}/board${ext}`));
    }
    const input = join(root, "input.kicad_pcb"), routed = join(root, "routed.kicad_pcb");
    const before = await checkNativeRepair(input, routed, routed);
    expect(before.newErrors.map(error => error.type)).toEqual(Array(6).fill("starved_thermal"));
    expect(before.opensAfter).toBe(13);
    expect(before.lostTerminalPairs).toBe(235);
    const isolated = await checkNativeRepair(input, routed, join(root, "power.kicad_pcb"));
    expect(isolated.repair?.lostTerminalPairs).toBe(57);
    expect(isolated.newErrors.filter(error => error.type === "clearance")).toHaveLength(3);
    expect(isolated.repair?.accepted).toBe(false);
    const checked = await checkNativeRepair(input, routed, join(root, "joint.kicad_pcb"));
    expect(checked.newErrors.map(error => error.type)).toEqual(Array(5).fill("starved_thermal"));
    expect(checked.opensAfter).toBe(13);
    expect(checked.lostTerminalPairs).toBe(235);
    expect(checked.repair?.lostTerminalPairs).toBe(0);
    expect(checked.nativeCopperChecks).toEqual([true, true, true]);
    expect(checked.repair?.accepted).toBe(true);
    expect(checked.accepted).toBe(false);
    expect(await readFile(input)).toEqual(source);
  } finally { await rm(root, { recursive: true, force: true }); }
}, 180_000);
