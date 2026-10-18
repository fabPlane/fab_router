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

for (const hook of ['onPass', 'onProgress'] as const) {
  test(`${hook} alone counts live opens and excludes ignored nets`, () => {
    const makeLayout = () => {
      const layout = board([{ net: 1, pts: [{ x: 0, y: -96_000 }, { x: 0, y: 96_000 }] }]);
      // An independent, disconnected ignored net must not inflate the callback count.
      return { ...layout, pads: [...layout.pads,
        { ...layout.pads[0]!, id: 30, net: 2, at: { x: -70_000, y: 70_000 } },
        { ...layout.pads[1]!, id: 31, net: 2, at: { x: -40_000, y: 70_000 } },
      ], nets: [...layout.nets, { id: 2, name: 'IGNORED', group: 1, pads: [30, 31] }],
      netGroups: [...layout.netGroups, { ...layout.netGroups[0]!, id: 1, name: 'ignored', nets: [2] }] };
    };
    const layout = makeLayout();
    const seen: { reported: number; actual: number }[] = [];
    const actual = () => requiredConnections(layout).filter(c => c.net !== 2).length;
    const settings = { viasAllowed: false, optimizerEnabled: false, shoveEnabled: false,
      maxPasses: 3, maxStagnantPasses: 0, ignoreNetGroups: ['ignored'] };
    const withoutHooks = makeLayout();
    const control = route(withoutHooks, settings);
    const report = route(layout, settings, hook === 'onPass' ? {
      onPass: e => seen.push({ reported: e.incomplete, actual: actual() }),
    } : {
      onProgress: e => seen.push({ reported: e.total - e.done, actual: actual() }),
    });
    expect(seen).toHaveLength(3);
    for (const e of seen) {
      expect(e.actual).toBe(1);
      expect(e.reported).toBe(e.actual);
    }
    expect(requiredConnections(layout).filter(c => c.net === 2)).toHaveLength(1);
    expect(layout.tracks).toEqual(withoutHooks.tracks);
    expect(layout.barrels).toEqual(withoutHooks.barrels);
    const { wallClockMs: _a, ...stable } = report;
    const { wallClockMs: _b, ...expected } = control;
    expect(stable).toEqual(expected);
  });
}
