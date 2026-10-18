import { createJournal } from '../src/route/journal.ts';
import { runFanout } from '../src/route/fanout.ts';
import { resolveSettings } from '../src/pipeline/index.ts';
import { expect, test } from 'bun:test';
import { synthLayout } from './helpers/synth.ts';
import { buildLattice } from '../src/lattice/index.ts';
import { connectivity } from '../src/drc/index.ts';
import { route, checkDrc, layoutStats } from '../src/api.ts';

// A single SMD terminal and a permitted through via.
export function fanoutContactBoard(sheet = 0) {
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
  layout.viaRules = [{ id: 0, name: 'through', forms: [4], entries: [{ form: 4, kind: 1, attach: true }] }];
  return layout;
}


for (const offset of [0, 6000, 20000, -20000]) {
  test(`fanout requires actual pad contact at offset ${offset}`, () => {
    const layout = fanoutContactBoard();
    layout.padForms = layout.padForms.map(f => f.id === 100 ? { ...f, perSheet: new Map([[0, [{ kind: 'disk' as const, c: { x: offset, y: 0 }, r: 5000 }]]]) } : f);
    const rep = route(layout, { fanoutEnabled: true, fanoutMaxPasses: 3, routerEnabled: false, optimizerEnabled: false });
    expect(checkDrc(layout).counts.violations).toBe(0);
    expect(rep.added.barrels).toBe(Math.abs(offset) <= 6000 ? 1 : 0);
    expect(layout.tracks.length).toBe(0);
    if (Math.abs(offset) <= 6000) expect(connectivity(layout, buildLattice(layout)).neighbours(10)).toContain(layout.barrels[0]!.id);
  });
}

for (const blocked of [false, true]) {
  test(`disconnected fanout trial rewinds live lattice, stub=${blocked}`, () => {
    const layout = fanoutContactBoard();
    layout.padForms = layout.padForms.map(f => f.id === 100 ? { ...f, perSheet: new Map([[0, [{ kind: 'disk' as const, c: { x: -20000, y: 0 }, r: 5000 }]]]) } : f);
    if (blocked) layout.fences = [{ id: 20, sheet: 0, scope: 'barrel',
      shape: { kind: 'disk', c: { x: 0, y: 0 }, r: 4000 }, kind: 1 }];
    const retained = structuredClone({ pads: layout.pads, fences: layout.fences });
    const lattice = buildLattice(layout);
    const journal = createJournal(layout, lattice);
    const result = runFanout(layout, lattice, journal, resolveSettings({ fanoutEnabled: true, fanoutMaxPasses: 3 }, undefined, undefined), new Set());
    expect(result).toEqual({ escaped: 0, addedItems: 0 });
    expect(layout.barrels).toEqual([]);
    expect(layout.tracks).toEqual([]);
    expect(journal.stats().live).toBe(0);
    expect(connectivity(layout, lattice).joins).toEqual(connectivity(layout, buildLattice(layout)).joins);
    expect({ pads: layout.pads, fences: layout.fences }).toEqual(retained);
    expect(checkDrc(layout).counts.violations).toBe(0);
  });
}
