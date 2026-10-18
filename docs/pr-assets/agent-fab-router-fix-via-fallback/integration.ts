import { expect, test } from 'bun:test';
import { blockedFirstViaBoard } from './helpers/via-fallback.ts';
import { buildLattice } from '../src/lattice/index.ts';
import { resolveProfile } from '../src/route/profile.ts';
import { resolveSettings } from '../src/pipeline/index.ts';
import { viaDropsNear } from '../src/route/via.ts';
import { ignoreOf } from '../src/route/clear.ts';

function setup(blocked: boolean) {
  const layout = blockedFirstViaBoard();
  if (!blocked) layout.fences = [];
  const profile = resolveProfile(layout, 0, resolveSettings({}, undefined, undefined));
  return { layout, profile, lattice: buildLattice(layout) };
}

test('enumerator reaches a later fitting form without inserting copper', () => {
  const { layout, profile, lattice } = setup(true);
  const truth = structuredClone({ pads: layout.pads, fences: layout.fences, pours: layout.pours });
  const drops = [...viaDropsNear(layout, lattice, 0, 3, { x: 0, y: 0 }, profile, ignoreOf(0, [10]), 0)];
  expect(drops.map(d => d.candidate.form)).toEqual([4]);
  expect({ pads: layout.pads, fences: layout.fences, pours: layout.pours }).toEqual(truth);
  expect(layout.barrels).toEqual([]);
  expect(layout.tracks).toEqual([]);
});

test('caller rejection continues to the next form at the same location', () => {
  const { layout, profile, lattice } = setup(true);
  layout.fences = [];
  const drops = [...viaDropsNear(layout, buildLattice(layout), 0, 3, { x: 0, y: 0 }, profile, ignoreOf(0, [10]), 0)];
  expect(drops.map(d => d.candidate.form)).toEqual([101, 4]);
  expect(drops.map(d => d.at)).toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  expect(layout.barrels).toEqual([]);
  expect(layout.tracks).toEqual([]);
});

test('cancellation after yielding prevents clearance work on the next form', () => {
  const { layout, profile, lattice } = setup(false);
  let stopped = false, queries = 0;
  const hits = lattice.hits.bind(lattice);
  lattice.hits = (...args: Parameters<typeof hits>) => { queries++; return hits(...args); };
  const drops = viaDropsNear(layout, lattice, 0, 3, { x: 0, y: 0 }, profile, ignoreOf(0, [10]), 0, () => stopped);
  expect(drops.next().done).toBe(false);
  const before = queries;
  stopped = true;
  expect(drops.next().done).toBe(true);
  expect(queries).toBe(before);
  expect(layout.barrels).toEqual([]);
  expect(layout.tracks).toEqual([]);
});
