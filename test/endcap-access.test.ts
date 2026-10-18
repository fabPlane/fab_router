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

// Two independent blocked-centre connections exercise the global policy across
// fallback calls, rather than the single-connection budget above.
function twoEndcapNets() {
  const layout = endcapBoard();
  layout.pads = [...layout.pads, ...layout.pads.map(p => ({ ...p, id: p.id + 10,
    net: p.net === 0 ? 2 : null, at: { x: p.at.x, y: p.at.y + 40000 } }))];
  layout.nets = [...layout.nets, { id: 2, name: 'SECOND', group: 1, pads: [20, 21] }];
  layout.netGroups = [...layout.netGroups, { ...layout.netGroups[0]!, id: 1, name: 'second', nets: [2] }];
  return layout;
}

for (const maxItems of [1, 2]) test(`end-cap item cap is shared across nets and passes (${maxItems})`, () => {
  const layout = twoEndcapNets();
  const pads = JSON.stringify(layout.pads);
  const report = route(layout, { maxItems, viasAllowed: false, fanoutEnabled: false,
    neckWidthUm: 0, optimizerEnabled: false, maxPasses: 3 });
  expect(report.incompleteAfter).toBe(2 - maxItems);
  expect(requiredConnections(layout)).toHaveLength(2 - maxItems);
  expect(layout.tracks).toHaveLength(maxItems);
  expect(new Set(layout.tracks.map(t => t.net)).size).toBe(maxItems);
  expect(layout.tracks.every(t => t.width === 5000)).toBe(true);
  expect(layout.barrels).toHaveLength(0);
  expect(checkDrc(layout).violations).toHaveLength(0);
  expect(JSON.stringify(layout.pads)).toBe(pads);
});

for (const ignored of ['default', 'second']) test(`end-cap skips ignored group ${ignored} while completing the other net`, () => {
  const layout = twoEndcapNets();
  const pads = JSON.stringify(layout.pads);
  const ignoredNet = ignored === 'default' ? 0 : 2;
  const activeNet = ignoredNet === 0 ? 2 : 0;
  const report = route(layout, { ignoreNetGroups: [ignored], viasAllowed: false,
    fanoutEnabled: false, neckWidthUm: 0, optimizerEnabled: false, maxPasses: 3 });
  expect(report.incompleteBefore).toBe(1);
  expect(report.incompleteAfter).toBe(0);
  expect(checkDrc(layout, { ignoreNetGroups: [ignored] }).counts.incompletes).toBe(0);
  const remaining = requiredConnections(layout);
  expect(remaining).toHaveLength(1);
  expect(remaining[0]!.net).toBe(ignoredNet);
  expect(layout.tracks).toHaveLength(1);
  expect(layout.tracks[0]!.net).toBe(activeNet);
  expect(layout.barrels).toHaveLength(0);
  expect(checkDrc(layout).violations).toHaveLength(0);
  expect(JSON.stringify(layout.pads)).toBe(pads);
});
