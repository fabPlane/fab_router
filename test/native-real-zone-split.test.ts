import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkNativeBoards } from "../tools/native-drc-gate.ts";

const hasNative = !!Bun.which("kicad-cli") && !!Bun.which("python3") && Bun.spawnSync(["python3", "-c", "import pcbnew"], { stdout: "ignore", stderr: "ignore" }).exitCode === 0;
const fixture = "test/fixtures/native-real-zone-split";

test.skipIf(!hasNative)("real board ground-pad isolation survives reduction of generated copper", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-real-zone-split-"));
  try {
    const source = gunzipSync(await readFile(`${fixture}/input.kicad_pcb.gz`)).toString("utf8");
    const end = source.lastIndexOf(")");
    const boards = ["input", "full", "reduced"].map(name => join(root, `${name}.kicad_pcb`));
    for (const [index, name] of ["input", "full", "reduced"].entries()) {
      const added = name === "input" ? "" : name === "full"
        ? gunzipSync(await readFile(`${fixture}/full-added.sexpr.gz`)).toString("utf8")
        : await readFile(`${fixture}/reduced-added.sexpr`, "utf8");
      await writeFile(boards[index]!, `${source.slice(0, end)}\n${added}\n${source.slice(end)}`);
      for (const ext of [".kicad_pro", ".kicad_dru"]) {
        await writeFile(join(root, `${name}${ext}`), await readFile(`${fixture}/board${ext}`));
      }
    }
    const full = await checkNativeBoards(boards[0]!, boards[1]!);
    expect(full.newErrors).toEqual([]);
    expect(full.opensBefore).toBe(14);
    expect(full.opensAfter).toBe(1);
    expect(full.accepted).toBe(false);
    expect(full.lostTerminalPairs).toBe(17);
    const reduced = await checkNativeBoards(boards[0]!, boards[2]!);
    expect(reduced.newErrors).toEqual([]);
    expect(reduced.opensAfter).toBe(16);
    expect(reduced.lostTerminalPairs).toBe(17);
    expect(reduced.accepted).toBe(false);
    const segments = (await readFile(`${fixture}/reduced-added.sexpr`, "utf8")).trim().split("\n");
    expect(segments).toHaveLength(4);
    for (let remove = 0; remove < segments.length; remove++) {
      const added = segments.filter((_, index) => index !== remove).join("\n");
      await writeFile(boards[2]!, `${source.slice(0, end)}\n${added}\n${source.slice(end)}`);
      const deletion = await checkNativeBoards(boards[0]!, boards[2]!);
      expect(deletion.newErrors).toEqual([]);
      expect(deletion.lostTerminalPairs).toBe(0);
    }
    expect((await checkNativeBoards(boards[0]!, boards[0]!)).lostTerminalPairs).toBe(0);
  } finally { await rm(root, { recursive: true, force: true }); }
}, 120_000);
