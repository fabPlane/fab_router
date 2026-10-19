/** Compare snapshot statistics with direct configured DRC, including SES replay. */
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
const api = await import(resolve(process.argv[2]!));
const root = resolve(process.argv[3]!);
const results = JSON.parse(readFileSync(join(root, "results.json"), "utf8"));
const rows = results.map((result: any) => {
  const work = join(root, result.evidence, "work");
  const summary = JSON.parse(readFileSync(join(work, "router-summary.json"), "utf8"));
  const output = summary.result;
  const read = api.readDsn(readFileSync(join(work, "board.dsn"), "utf8"));
  if (!read.ok || !output.ok) throw new Error(`Cannot parse/route ${result.case}`);
  const settings = output.report.effectiveSettings;
  const expected = () => {
    const drc = api.checkDrc(read.layout, settings);
    const byRule: Record<string, number> = {};
    for (const v of drc.violations) byRule[v.rule] = (byRule[v.rule] ?? 0) + 1;
    return { total: drc.counts.violations, byRule };
  };
  const before = expected();
  const applied = api.applySes(read.layout, output.ses);
  if (!applied.ok) throw new Error(`Cannot replay ${result.case}`);
  return { case: result.case, seed: result.seed,
    before: { reported: output.statsBefore.violations, expected: before },
    after: { reported: output.statsAfter.violations, expected: expected() } };
});
console.log(JSON.stringify(rows, null, 2));
