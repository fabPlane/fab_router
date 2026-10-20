import { expect, test } from "bun:test";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("thermal proposals exclude reidentified authored tracks, including reversed numeric equivalents", async () => {
  const root = await mkdtemp(join(tmpdir(), "thermal-identities-"));
  const track = (id: string, start = "0 0", end = "1 1", width = "0.25") => `(segment (start ${start}) (end ${end}) (width ${width}) (layer "F.Cu") (net 1) (uuid "${id}"))`;
  const board = (tracks: string) => `(kicad_pcb ${tracks} (footprint (pad "1" smd circle (uuid "pad"))))`;
  try {
    await writeFile(join(root, "source"), board(track("authored")));
    await writeFile(join(root, "report"), JSON.stringify({ newErrors: [{ type: "starved_thermal", items: [{ uuid: "pad", pos: { x: 0, y: 0 } }] }] }));
    for (const [index, tracks, allowed] of [
      [0, track("imported"), []],
      [1, track("imported", "1.000 1e0", "0.0 -0", ".2500"), []],
      [2, track("imported") + track("duplicate"), []],
      [3, track("authored", "0 0", "2 2"), []],
      [4, track("imported") + track("generated", "1 1", "2 2"), ["generated"]],
      [5, track("different-width", "0 0", "1 1", "0.3"), ["different-width"]],
      [6, track("named").replace("(net 1)", '(net "GND")'), ["named"]],
      [7, track("named-import").replace("(net 1)", '(net "GND")'), []],
    ] as const) {
      await writeFile(join(root, "source"), board(index === 7 ? track("authored").replace("(net 1)", '(net "GND")') : track("authored")));
      await writeFile(join(root, "current"), board(tracks));
      const out = join(root, `out${index}`);
      const result = Bun.spawnSync(["python3", "tools/native-thermal-proposals.py", "--source", join(root, "source"), "--current", join(root, "current"), "--report", join(root, "report"), "--out", out]);
      expect(result.exitCode).toBe(0);
      const rows = JSON.parse(await readFile(join(out, "manifest.json"), "utf8")) as {label: [string, string | string[]]}[];
      expect([...new Set(rows.flatMap(row => typeof row.label[1] === "string" ? [row.label[1]] : row.label[1]))]).toEqual([...allowed]);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
