import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { route } from '../src/api.ts';
import { checkDrc } from '../src/drc/index.ts';
import { buildSrjLayout } from '../src/srj/index.ts';

test('congested connector repair keeps eight connections without spacing violations', () => {
  const input = JSON.parse(readFileSync(new URL('../docs/pr-assets/agent/repair-search-budget/l1.srj.json', import.meta.url), 'utf8'));
  const built = buildSrjLayout(input);
  const report = route(built.layout, { extendedSearchBudget: true, ...(built.edgeClearanceUm === undefined ? {} : { copperToEdgeClearanceUm: built.edgeClearanceUm }) });
  const checked = checkDrc(built.layout);
  expect(report.timedOut).toBe(false);
  expect(checked.counts.incompletes).toBeLessThanOrEqual(2);
  expect(checked.counts.violations).toBe(0);
}, 120000);
