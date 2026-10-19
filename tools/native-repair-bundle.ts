/** Offline handoff for a proposed repair; does not search or mutate an editor. */
import { publishNativeRepair } from "./native-drc-gate.ts";
const [input, routed, repaired, output] = process.argv.slice(2);
if (!input || !routed || !repaired || !output || process.argv.length !== 6) {
  console.error("Usage: bun tools/native-repair-bundle.ts input.kicad_pcb routed.kicad_pcb repaired.kicad_pcb accepted.json");
  process.exitCode = 2;
} else {
  try {
    const result = await publishNativeRepair(input, routed, repaired, output);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.accepted ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
