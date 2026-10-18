// Diagnostic routing stage; native acceptance is measured after SES import/refill.
import { routeDsn } from "../../../src/api.ts";
const [input, output, report] = process.argv.slice(2);
const result = routeDsn(await Bun.file(input!).text(), { seed: 1 });
if (!result.ok) throw new Error(JSON.stringify(result));
if (result.report.incompleteBefore !== 1 || result.report.incompleteAfter !== 0 || result.report.violationsAdded !== 0) {
  throw new Error(JSON.stringify(result.report));
}
await Bun.write(output!, result.ses);
await Bun.write(report!, JSON.stringify({ report: result.report, diagnostics: result.diagnostics }, null, 2) + "\n");
