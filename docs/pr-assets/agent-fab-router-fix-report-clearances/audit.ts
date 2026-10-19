/** Independently measure input DRC with the exact effective benchmark settings. */
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
const api = await import(resolve(process.argv[2]!));
const root = resolve(process.argv[3]!);
const results = JSON.parse(readFileSync(join(root, "results.json"), "utf8"));
const rows = results.map((result: any) => {
  const work = join(root, result.evidence, "work");
  const summary = JSON.parse(readFileSync(join(work, "router-summary.json"), "utf8"));
  const read = api.readDsn(readFileSync(join(work, "board.dsn"), "utf8"));
  if (!read.ok) throw new Error(`Cannot parse ${result.case}`);
  const reference = api.checkDrc(read.layout, summary.result.report.effectiveSettings);
  return {
    case: result.case, seed: result.seed,
    reported: summary.result.report.violationsBefore,
    expected: reference.counts.violations,
    violations: reference.violations,
  };
});
console.log(JSON.stringify(rows, null, 2));
