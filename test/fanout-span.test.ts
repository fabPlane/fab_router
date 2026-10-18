import { expect, test } from 'bun:test';
import { synthLayout } from './helpers/synth.ts';
import type { RouteSettings } from '../spec/types/settings.ts';
import { buildLattice } from '../src/lattice/index.ts';
import { connectivity } from '../src/drc/index.ts';
import { route, checkDrc, layoutStats } from '../src/api.ts';

// Four signal layers; the only allowed via spans only layers 2 and 3.
export function fanoutSpanBoard(sheet = 3) {
  const layout = synthLayout({ parts: 0, tracks: 0, barrels: 0 });
  layout.stack = layout.stack.map(({ planeNet, ...s }) => ({ ...s, role: 'signal' as const }));
  layout.fences = []; layout.pours = []; layout.tracks = []; layout.barrels = [];
  layout.parts = [{ id: 1, ref: 'U1', package: 'test', side: 'front', at: { x: 0, y: 0 }, rotationDeg: 0 }];
  layout.padForms = [...layout.padForms, { id: 100, name: 'terminal', attachAllowed: true,
    perSheet: new Map([[sheet, [{ kind: 'disk' as const, c: { x: 0, y: 0 }, r: 5000 }]]]) }];
  layout.pads = [{ id: 10, part: 1, pinName: '1', net: 0, form: 100, at: { x: 0, y: 0 }, rotationDeg: 0, side: 'front', sheets: [sheet], kind: 1, hold: 'locked' }];
  layout.nets = [{ id: 0, name: 'SIG', group: 0, pads: [10] }];
  layout.netGroups = [{ id: 0, name: 'default', nets: [0], trackWidth: 2000, kind: 1,
    categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 }, viaRule: 0 }];
  layout.viaRules = [{ id: 0, name: 'bottom-blind', forms: [9], entries: [{ form: 9, kind: 1, attach: true }] }];
  return layout;
}

for (const sheet of [2, 3]) {
  test(`fanout finds a spanning destination after unsupported layers: source ${sheet}`, () => {
    const layout = fanoutSpanBoard(sheet);
    const pads = structuredClone(layout.pads);
    const rep = route(layout, { fanoutEnabled: true, routerEnabled: false, optimizerEnabled: false });
    expect(rep.passes).toBe(0);
    expect(rep.added.barrels).toBe(1);
    expect(layout.barrels[0]!.fromSheet).toBe(2);
    expect(layout.barrels[0]!.toSheet).toBe(3);
    expect(connectivity(layout, buildLattice(layout)).neighbours(10)).toContain(layout.barrels[0]!.id);
    expect(checkDrc(layout).counts.violations).toBe(0);
    expect(layout.pads).toEqual(pads);
  });
}

test('fanout does not invent a via span for an unreachable source', () => {
  const layout = fanoutSpanBoard(0);
  const rep = route(layout, { fanoutEnabled: true, routerEnabled: false, optimizerEnabled: false });
  expect(rep.added.barrels).toBe(0);
  expect(layoutStats(layout).fanout.escaped).toBe(0);
  expect(checkDrc(layout).counts.violations).toBe(0);
});

for (const [name, settings] of [
  ['vias disabled', { viasAllowed: false }],
  ['destination inactive', { layers: { 'In2.Cu': { active: false } } }],
  ['ignored group', { ignoreNetGroups: ['default'] }],
  ['zero item budget', { fanoutMaxItems: 0 }],
] satisfies Array<[string, Partial<RouteSettings>]>) {
  test(`fanout span selection respects ${name}`, () => {
    const layout = fanoutSpanBoard(3);
    const rep = route(layout, { fanoutEnabled: true, routerEnabled: false, optimizerEnabled: false, ...settings });
    expect(rep.added.barrels).toBe(0);
    expect(layoutStats(layout).fanout.escaped).toBe(0);
    expect(checkDrc(layout).counts.violations).toBe(0);
  });
}
