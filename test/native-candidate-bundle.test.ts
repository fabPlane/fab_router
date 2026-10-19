import { expect, test } from "bun:test";
import { mkdtemp, writeFile, readFile, rm, chmod, symlink, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const board = `(kicad_pcb (version 20260206) (generator "pcbnew")
  (layers (0 "F.Cu" signal) (2 "B.Cu" signal)) (setup))`;
const hash = (bytes: Buffer) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

async function fixture(mode: string, run: (root: string, invoke: (output?: string) => Promise<{ code: number; stderr: string }>) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "native-bundle-test-"));
  try {
    for (const stem of ["input", "candidate"]) {
      await writeFile(join(root, `${stem}.kicad_pcb`), board);
      await writeFile(join(root, `${stem}.kicad_pro`), "{}");
      await writeFile(join(root, `${stem}.kicad_dru`), "(version 1)\n");
    }
    // Run the CLI in a separate process so PATH and simulated checker failures do
    // not affect concurrent engine tests. These are publication tests, not DRC proof.
    const checker = join(root, "kicad-cli");
    await writeFile(checker, `#!/usr/bin/python3
import json, os, pathlib, sys
root = pathlib.Path(os.environ['BUNDLE_TEST_ROOT'])
mode = os.environ['BUNDLE_TEST_MODE']
if mode == 'error': sys.exit(3)
if mode == 'mutate':
    for suffix in ('.kicad_pcb', '.kicad_pro', '.kicad_dru'):
        (root / ('candidate' + suffix)).write_text('changed after snapshot')
violations = []
if mode == 'reject' and pathlib.Path(sys.argv[-1]).parent.name == 'after':
    violations = [dict(type='starved_thermal', severity='error', description='thermal', items=[])]
report = dict(coordinate_units='mm', kicad_version='10.0.6', included_severities=['error'],
              ignored_checks=[], unconnected_items=[], violations=violations)
pathlib.Path(sys.argv[sys.argv.index('--output') + 1]).write_text(json.dumps(report))
`);
    await chmod(checker, 0o700);
    const invoke = async (output = join(root, "accepted.json")) => {
      const child = Bun.spawn([process.execPath, resolve("tools/native-candidate-bundle.ts"), join(root, "input.kicad_pcb"), join(root, "candidate.kicad_pcb"), output], {
        env: { ...process.env, PATH: `${root}:${process.env.PATH}`, BUNDLE_TEST_ROOT: root, BUNDLE_TEST_MODE: mode }, stdout: "pipe", stderr: "pipe",
      });
      const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
      return { code, stderr };
    };
    await run(root, invoke);
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("publication contains the exact checked snapshots even if source paths change during checking", async () => {
  await fixture("mutate", async (root, invoke) => {
    expect((await invoke()).code).toBe(0);
    const bundle = JSON.parse(await readFile(join(root, "accepted.json"), "utf8"));
    expect(bundle.format).toBe("fab-router-native-candidate-v1");
    expect(bundle.validation.accepted).toBe(true);
    for (const role of ["input", "candidate"]) {
      const files = bundle[role];
      expect(files.map((f: { name: string }) => f.name)).toEqual(["board.kicad_pcb", "board.kicad_pro", "board.kicad_dru"]);
      for (const file of files) {
        const bytes = Buffer.from(file.base64, "base64");
        expect(hash(bytes)).toBe(file.sha256);
        expect(bytes.toString()).toBe(file.name.endsWith("pcb") ? board : file.name.endsWith("pro") ? "{}" : "(version 1)\n");
      }
      expect(files[0].sha256).toBe(bundle.validation[role === "input" ? "inputSha256" : "candidateSha256"]);
    }
    expect(await readFile(join(root, "candidate.kicad_pcb"), "utf8")).toBe("changed after snapshot");
    expect((await readdir(root)).filter(name => name.startsWith(".native-candidate-"))).toEqual([]);
  });
});

test("rejection publishes no candidate", async () => {
  await fixture("reject", async (root, invoke) => {
    expect((await invoke()).code).toBe(1);
    expect(await Bun.file(join(root, "accepted.json")).exists()).toBe(false);
  });
});

test("checker failure publishes no candidate", async () => {
  await fixture("error", async (root, invoke) => {
    expect((await invoke()).code).toBe(2);
    expect(await Bun.file(join(root, "accepted.json")).exists()).toBe(false);
  });
});

test("publication never replaces an existing destination or leaves staging files", async () => {
  await fixture("accept", async (root, invoke) => {
    await writeFile(join(root, "accepted.json"), "existing artifact");
    expect((await invoke()).code).toBe(2);
    expect(await readFile(join(root, "accepted.json"), "utf8")).toBe("existing artifact");
    expect((await readdir(root)).filter(name => name.startsWith(".native-candidate-"))).toEqual([]);
  });
});

test("publication cannot follow a dangling destination symlink", async () => {
  await fixture("accept", async (root, invoke) => {
    await symlink(join(root, "absent"), join(root, "accepted.json"));
    expect((await invoke()).code).toBe(2);
    expect(await Bun.file(join(root, "absent")).exists()).toBe(false);
    expect((await readdir(root)).filter(name => name.startsWith(".native-candidate-"))).toEqual([]);
  });
});

 test("publication cannot create an absent source rule sidecar", async () => {
  await fixture("accept", async (root, invoke) => {
    for (const stem of ["input", "candidate"]) await rm(join(root, `${stem}.kicad_dru`));
    const output = join(root, "candidate.kicad_dru");
    const result = await invoke(output);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("overlaps a source");
    expect(await Bun.file(output).exists()).toBe(false);
    await symlink(root, join(root, "alias"));
    expect((await invoke(join(root, "alias", "candidate.kicad_dru"))).code).toBe(2);
    expect(await Bun.file(output).exists()).toBe(false);
  });
});
