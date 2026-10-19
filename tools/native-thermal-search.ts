/** Opt-in offline thermal search. Never writes an editor or changes the text router. */
import { execFile } from "node:child_process";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { checkNativeRepair, publishNativeRepair } from "./native-drc-gate.ts";
const execute = promisify(execFile);

type Progress = {
  newErrors: Array<{ type: string }>;
  lostTerminalPairs: number;
  opensBefore: number;
  opensAfter: number;
  candidateReport: unknown;
  repair?: { accepted: boolean; routedReport: unknown };
};
/** Intermediate progress may retain introduced thermals, but no other violation,
 * source connection loss, routed connection loss, or newly introduced finding. */
export function thermalProgress(before: Pick<Progress, "newErrors">, after: Progress): boolean {
  const errors = (report: unknown) => (report as { violations: Array<{ severity: string }> }).violations.filter(v => v.severity === "error").length;
  return after.opensAfter <= after.opensBefore && after.lostTerminalPairs === 0 && after.repair?.accepted === true
    && after.newErrors.every(v => v.type === "starved_thermal")
    && after.newErrors.length < before.newErrors.length
    && errors(after.candidateReport) < errors(after.repair.routedReport);
}

export async function searchNativeThermals(source: string, routed: string, output: string, work: string, maxStages = 8, timeoutMs = 120_000) {
  if (!Number.isInteger(maxStages) || maxStages < 1 || maxStages > 8) throw new Error("Expected 1–8 search stages");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid native check timeout");
  const canonical = async (p: string) => join(await realpath(dirname(resolve(p))), basename(p));
  const destination = await canonical(output);
  for (const board of [source, routed]) for (const ext of [".kicad_pcb", ".kicad_pro", ".kicad_dru"]) {
    if (!board.endsWith(".kicad_pcb")) throw new Error("Expected a .kicad_pcb board");
    if (await canonical(board.replace(/\.kicad_pcb$/, ext)) === destination) throw new Error("Bundle output overlaps a source board or rules file");
  }
  await mkdir(work); // Exclusive work directory; retain all attempts, including failures.
  const freeze = async (board: string, name: string) => {
    const dir = join(work, name); await mkdir(dir);
    for (const ext of [".kicad_pcb", ".kicad_pro", ".kicad_dru"]) {
      try { await writeFile(join(dir, `board${ext}`), await readFile(board.replace(/\.kicad_pcb$/, ext)), { flag: "wx" }); }
      catch (e) { if (ext !== ".kicad_dru" || (e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    }
    return join(dir, "board.kicad_pcb");
  };
  const input = await freeze(source, "input"), original = await freeze(routed, "routed");
  let current = original;
  let baseline = await checkNativeRepair(input, current, current, timeoutMs);
  await writeFile(join(work, "baseline.json"), `${JSON.stringify(baseline, null, 2)}\n`, { flag: "wx" });
  const attempts: Array<{ stage: number; name: string; label: unknown; progress: boolean }> = [];
  let stages = 0;
  while (baseline.newErrors.length && stages < maxStages && baseline.newErrors.every(v => v.type === "starved_thermal") && baseline.lostTerminalPairs === 0) {
    const stage = stages++, dir = join(work, `stage-${stage}`);
    const report = join(work, `stage-${stage}.json`);
    await writeFile(report, `${JSON.stringify(baseline, null, 2)}\n`, { flag: "wx" });
    const generated = await execute("python3", [fileURLToPath(new URL("./native-thermal-proposals.py", import.meta.url)), "--source", input, "--current", current, "--report", report, "--out", dir], { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 });
    await writeFile(join(dir, "generator.log"), generated.stdout + generated.stderr, { flag: "wx" });
    const proposals: Array<{ name: string; label: unknown }> = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
    if (proposals.length > 304 || proposals.some(p => !/^\d{3}\.kicad_pcb$/.test(p.name))) throw new Error("Invalid thermal proposal manifest");
    let progress = false;
    for (const proposal of proposals) {
      const candidate = join(dir, proposal.name);
      for (const ext of [".kicad_pro", ".kicad_dru"]) {
        try { await writeFile(candidate.replace(/\.kicad_pcb$/, ext), await readFile(input.replace(/\.kicad_pcb$/, ext)), { flag: "wx" }); }
        catch (e) { if (ext !== ".kicad_dru" || (e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
      }
      const checked = await checkNativeRepair(input, current, candidate, timeoutMs);
      progress = thermalProgress(baseline, checked);
      await writeFile(candidate + ".json", `${JSON.stringify(checked, null, 2)}\n`, { flag: "wx" });
      attempts.push({ stage, ...proposal, progress });
      if (progress) { current = candidate; baseline = checked; break; }
    }
    if (!progress) break;
  }
  // Always compare the final candidate to the ORIGINAL routed snapshot as well.
  // Failure leaves the caller's routed board untouched and publishes no bundle.
  const validation = await checkNativeRepair(input, original, current, timeoutMs);
  const clean = validation.accepted && validation.newErrors.length === 0;
  const publication = clean ? await publishNativeRepair(input, original, current, output, timeoutMs) : undefined;
  const result = { repaired: clean && current !== original, published: publication?.published === true, stages, attempts, validation };
  await writeFile(join(work, "result.json"), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  return result;
}

if (import.meta.main) {
  const [source, routed, output, work] = process.argv.slice(2);
  if (!source || !routed || !output || !work || process.argv.length !== 6) {
    console.error("Usage: bun tools/native-thermal-search.ts source.kicad_pcb routed.kicad_pcb accepted.json new-work-directory");
    process.exitCode = 2;
  } else {
    try { const result = await searchNativeThermals(source, routed, output, work); process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); process.exitCode = result.published ? 0 : 1; }
    catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2; }
  }
}
