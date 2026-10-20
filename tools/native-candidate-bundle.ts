/** Optional publication of an accepted native candidate; see docs/NATIVE-DRC-GATE.md. */
import { publishNativeCandidate } from "./native-drc-gate.ts";

const [input, candidate, output] = process.argv.slice(2);
if (!input || !candidate || !output || process.argv.length !== 5) {
  console.error("Usage: bun tools/native-candidate-bundle.ts input.kicad_pcb candidate.kicad_pcb accepted.json");
  process.exitCode = 2;
} else {
  try {
    const result = await publishNativeCandidate(input, candidate, output);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.accepted ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
