import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkNativeBoards, publishNativeCandidate, compareTerminalGroups } from "../tools/native-drc-gate.ts";

const hasNative = !!Bun.which("kicad-cli") && !!Bun.which("python3") && Bun.spawnSync(["python3", "-c", "import pcbnew"], { stdout: "ignore", stderr: "ignore" }).exitCode === 0;
test.skipIf(!hasNative)("native gate blocks lost terminal pairs even when open totals and DRC remain unchanged", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-terminal-swap-"));
  try {
    const paths = ["input", "candidate"].map(name => join(root, `${name}.kicad_pcb`));
    for (const [index, name] of ["input", "candidate"].entries()) {
      await writeFile(paths[index]!, await readFile(`test/fixtures/native-terminal-swap/${name}.kicad_pcb`));
      await writeFile(join(root, `${name}.kicad_pro`), "{}");
    }
    const result = await checkNativeBoards(paths[0]!, paths[1]!);
    expect(result.newErrors).toEqual([]);
    expect(result.opensBefore).toBe(1);
    expect(result.opensAfter).toBe(1);
    expect(result.accepted).toBe(false);
    const bundle = join(root, "accepted.json");
    expect((await publishNativeCandidate(paths[0]!, paths[1]!, bundle)).published).toBe(false);
    expect(await Bun.file(bundle).exists()).toBe(false);
    expect((await checkNativeBoards(paths[0]!, paths[0]!)).accepted).toBe(true);
    expect((await checkNativeBoards(paths[1]!, paths[1]!)).accepted).toBe(true);
  } finally { await rm(root, { recursive: true, force: true }); }
}, 120_000);

const groups = (input: string[][], candidate: string[][]) => ({ nativeVersion: "10.0.6", input, candidate });
test("terminal comparison permits joining components and detects equal-count rewiring", () => {
  expect(compareTerminalGroups(groups([["a", "b", "c"], ["d"]], [["a", "b", "c", "d"]]), "10.0.6").lostTerminalPairs).toBe(0);
  const split = compareTerminalGroups(groups([["a", "b", "c"], ["d"]], [["a", "c"], ["b", "d"]]), "10.0.6");
  expect(split.lostTerminalPairs).toBe(2);
  expect(split.lostPairWitnesses).toEqual([["a", "b"], ["b", "c"]]);
  expect(compareTerminalGroups(groups([], []), "10.0.6").lostTerminalPairs).toBe(0);
});
test("native terminal inventory, partition structure and checker version fail closed", () => {
  for (const malformed of [null, {}, groups([["a"]], []), groups([["a"]], [["b"]]), groups([["a", "a"]], [["a"]]), groups([["a"]], [["a"], ["a"]]), groups([[]], []), { ...groups([], []), input: [1] }, { ...groups([], []), candidate: [[null]] }, { ...groups([], []), nativeVersion: "9.0" }]) {
    expect(() => compareTerminalGroups(malformed, "10.0.6")).toThrow();
  }
});
test("lost-pair diagnostics cap witnesses while retaining the complete count", () => {
  const members = Array.from({ length: 10 }, (_, index) => `pad-${index}`);
  const result = compareTerminalGroups(groups([members], members.map(member => [member])), "10.0.6");
  expect(result.lostTerminalPairs).toBe(45);
  expect(result.lostPairWitnesses).toHaveLength(32);
});
