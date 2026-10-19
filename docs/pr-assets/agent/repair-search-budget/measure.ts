import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const source = resolve(process.argv[2] ?? '.');
const { route } = await import(resolve(source, 'src/api.ts'));
const { buildSrjLayout } = await import(resolve(source, 'src/srj/index.ts'));
const { checkDrc } = await import(resolve(source, 'src/drc/index.ts'));
const input = JSON.parse(readFileSync(new URL('./l1.srj.json', import.meta.url), 'utf8'));
const runs = [];
for (let repeat = 1; repeat <= 3; repeat++) {
  const built = buildSrjLayout(input);
  const report = route(built.layout, { ...(process.argv[4] === 'extended' ? { extendedSearchBudget: true } : {}), ...(built.edgeClearanceUm === undefined ? {} : {copperToEdgeClearanceUm: built.edgeClearanceUm}) });
  const drc = checkDrc(built.layout);
  runs.push({repeat, report, counts: drc.counts});
}
writeFileSync(process.argv[3]!, JSON.stringify(runs, null, 2) + '\n');
