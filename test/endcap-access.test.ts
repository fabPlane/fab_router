import { expect, test } from 'bun:test';
import { route, checkDrc, requiredConnections } from '../src/api.ts';
import { buildLattice, rotatePt } from '../src/lattice/index.ts';
import { resolveSettings } from '../src/pipeline/index.ts';
import { resolveProfile } from '../src/route/profile.ts';
import { ignoreOf, pointFree, sweepClear } from '../src/route/clear.ts';
import { touching } from '../src/drc/exact.ts';
import { endcapBoard } from './helpers/endcap-board.ts';

for (const rotation of [0, 90]) for (const reverse of [false, true]) test(`end-cap overlaps blocked pad (${rotation}, reverse=${reverse})`, () => {
  const layout = endcapBoard();
  layout.pads = layout.pads.map(p => ({ ...p, id: reverse && p.id < 12 ? 21 - p.id : p.id,
    at: rotatePt(p.at, rotation), rotationDeg: rotation }));
  const pads = JSON.stringify(layout.pads);
  const lattice = buildLattice(layout);
  const profile = resolveProfile(layout, 0, resolveSettings({ neckWidthUm: 0 }, undefined, layout.angleMode));
  const ignore = ignoreOf(0);
  const edge = rotatePt({ x: 7250, y: 0 }, rotation);
  const a = rotatePt({ x: 9125, y: 0 }, rotation), b = rotatePt({ x: 40000, y: 0 }, rotation);
  expect(pointFree(layout, lattice, 0, edge, profile, ignore).ok).toBe(false);
  expect(sweepClear(layout, lattice, 0, { a, b }, profile, ignore, 5000).ok).toBe(true);
  const padShapes = lattice.shapesOf(reverse ? 11 : 10, 0);
  expect(padShapes.some(s => touching(s, { kind: 'disk', c: a, r: 2500 }))).toBe(true);
  expect(padShapes.some(s => touching(s, { kind: 'disk', c: a, r: 0 }))).toBe(false);
  const report = route(layout, { viasAllowed: false, fanoutEnabled: false, neckWidthUm: 0,
    optimizerEnabled: false, maxPasses: 1 });
  expect(report.incompleteAfter).toBe(0);
  expect(requiredConnections(layout)).toHaveLength(0);
  expect(checkDrc(layout).violations).toHaveLength(0);
  expect(layout.tracks.length).toBeGreaterThan(0);
  expect(layout.tracks.every(t => t.width === 5000)).toBe(true);
  expect(layout.barrels).toHaveLength(0);
  expect(JSON.stringify(layout.pads)).toBe(pads);
});

for (const maxItems of [0, 1]) test(`end-cap respects item budget ${maxItems}`, () => {
  const layout = endcapBoard();
  const report = route(layout, { maxItems, viasAllowed: false, fanoutEnabled: false,
    neckWidthUm: 0, optimizerEnabled: false, maxPasses: 1 });
  expect(layout.tracks).toHaveLength(maxItems);
  expect(report.incompleteAfter).toBe(1 - maxItems);
  expect(checkDrc(layout).violations).toHaveLength(0);
  expect(layout.barrels).toHaveLength(0);
});

test('cancelled end-cap route leaves all copper untouched', () => {
  const layout = endcapBoard();
  const before = JSON.stringify(layout.pads);
  const controller = new AbortController(); controller.abort();
  const report = route(layout, { viasAllowed: false, fanoutEnabled: false, neckWidthUm: 0 }, { signal: controller.signal });
  expect(report.aborted).toBe(true);
  expect(layout.tracks).toHaveLength(0);
  expect(layout.barrels).toHaveLength(0);
  expect(JSON.stringify(layout.pads)).toBe(before);
});
