import { expect, test } from 'bun:test';
import { route, requiredConnections } from '../src/api.ts';
import { board } from './helpers/pass-progress.ts';

test('pass and progress hooks count connections reopened by rip-up', () => {
  const layout = board([{ net: 1, pts: [{ x: 0, y: -96_000 }, { x: 0, y: 96_000 }] }]);
  const seen: { reported: number; actual: number }[] = [];
  route(layout, { viasAllowed: false, optimizerEnabled: false, shoveEnabled: false,
    maxPasses: 3, maxStagnantPasses: 0 }, {
    onPass: e => seen.push({ reported: e.incomplete, actual: requiredConnections(layout).length }),
    onProgress: e => seen.push({ reported: e.total - e.done, actual: requiredConnections(layout).length }),
  });
  expect(seen).toHaveLength(6);
  expect(seen.some(e => e.actual > 0)).toBe(true);
  for (const e of seen) expect(e.reported).toBe(e.actual);
});
