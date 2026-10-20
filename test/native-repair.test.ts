import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkNativeBoards, checkNativeRepair, publishNativeRepair } from "../tools/native-drc-gate.ts";

const hasNative = !!Bun.which("kicad-cli") && Bun.spawnSync(["python3", "-c", "import pcbnew"], { stdout: "ignore", stderr: "ignore" }).exitCode === 0;
test.skipIf(!hasNative)("repair preserves connections added by routing despite equal open totals", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-repair-"));
  try {
    const fixture = await readFile("test/fixtures/native-terminal-swap/input.kicad_pcb", "utf8");
    const source = fixture.slice(0, fixture.indexOf("(zone")) + ")";
    const segment = (x: number, y: number, id: number) => `(segment (start 15 5) (end ${x} ${y}) (width 0.25) (layer "F.Cu") (net 1) (uuid "00000000-0000-0000-0000-${String(id).padStart(12, "0")}"))`;
    const copper = [segment(5, 5, 100), segment(5, 15, 101)];
    const changed = [segment(5, 5, 100), segment(25, 5, 102)];
    const paths = ["source", "routed", "repaired"].map(name => join(root, `${name}.kicad_pcb`));
    for (const [i, additions] of [[], copper, changed].entries()) {
      await writeFile(paths[i]!, source.slice(0, -1) + additions.join("\n") + ")");
      await writeFile(paths[i]!.replace(".kicad_pcb", ".kicad_pro"), "{}");
    }
    expect((await checkNativeBoards(paths[0]!, paths[1]!)).accepted).toBe(true);
    expect((await checkNativeBoards(paths[0]!, paths[2]!)).accepted).toBe(true);
    const result = await checkNativeRepair(paths[0]!, paths[1]!, paths[2]!);
    expect(result.newErrors).toEqual([]);
    expect(result.opensAfter).toBe(1);
    expect(result.accepted).toBe(false);
    expect(result.repair?.opensBefore).toBe(1);
    expect(result.repair?.opensAfter).toBe(1);
    expect(result.repair?.lostTerminalPairs).toBe(2);
    expect((await publishNativeRepair(paths[0]!, paths[1]!, paths[2]!, join(root, "rejected.json"))).published).toBe(false);
    expect(await Bun.file(join(root, "rejected.json")).exists()).toBe(false);
    const output = join(root, "accepted.json");
    expect((await publishNativeRepair(paths[0]!, paths[1]!, paths[1]!, output)).published).toBe(true);
    const bundle = JSON.parse(await readFile(output, "utf8"));
    expect(bundle.format).toBe("fab-router-native-repair-v1");
    expect(bundle.validation.repair.lostTerminalPairs).toBe(0);
    expect(Buffer.from(bundle.routed[0].base64, "base64")).toEqual(await readFile(paths[1]!));
    expect(Buffer.from(bundle.candidate[0].base64, "base64")).toEqual(await readFile(paths[1]!));
    await expect(publishNativeRepair(paths[0]!, paths[1]!, paths[1]!, paths[1]!.replace(".kicad_pcb", ".kicad_dru"))).rejects.toThrow("overlaps a source");
  } finally { await rm(root, { recursive: true, force: true }); }
}, 120_000);
