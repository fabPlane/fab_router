import { expect, test } from 'bun:test';
import { route, checkDrc, requiredConnections } from '../src/api.ts';
import { buildLattice, rotatePt } from '../src/lattice/index.ts';
import { resolveSettings } from '../src/pipeline/index.ts';
import { resolveProfile } from '../src/route/profile.ts';
import { ignoreOf, pointFree, sweepClear } from '../src/route/clear.ts';
import { padAttachmentBoard } from './helpers/pad-attachment-board.ts';

for (const rotation of [0, 45, 90, 135, 180, 270]) test(`full-width route attaches away from blocked pad centre (${rotation} degrees)`, () => {
  const layout = padAttachmentBoard();
  layout.pads = layout.pads.map(p => ({ ...p, at: rotatePt(p.at, rotation), rotationDeg: rotation }));
  const lattice = buildLattice(layout);
  const profile = resolveProfile(layout, 0, resolveSettings({ neckWidthUm: 0 }, undefined, layout.angleMode));
  const ignore = ignoreOf(0);
  expect(pointFree(layout, lattice, 0, { x: 0, y: 0 }, profile, ignore).ok).toBe(false);
  const a = rotatePt({ x: 10000, y: 0 }, rotation), b = rotatePt({ x: 40000, y: 0 }, rotation);
  expect(sweepClear(layout, lattice, 0, { a, b }, profile, ignore, 8000).ok).toBe(true);
  const report = route(layout, { viasAllowed: false, fanoutEnabled: false, neckWidthUm: 0, optimizerEnabled: false, maxPasses: 1 });
  expect(report.incompleteAfter).toBe(0);
  expect(requiredConnections(layout)).toHaveLength(0);
  expect(checkDrc(layout).violations).toHaveLength(0);
  expect(layout.tracks.length).toBeGreaterThan(0);
  expect(layout.tracks.every(t => t.width === 8000)).toBe(true);
  expect(layout.barrels).toHaveLength(0);
});

test('edge attachment works at either endpoint and preserves existing pads', () => {
  const layout = padAttachmentBoard();
  layout.pads = layout.pads.map(p => ({ ...p, id: p.id === 10 ? 11 : p.id === 11 ? 10 : p.id }));
  const before = JSON.stringify(layout.pads);
  const report = route(layout, { viasAllowed: false, fanoutEnabled: false, neckWidthUm: 0, optimizerEnabled: false, maxPasses: 1 });
  expect(report.incompleteAfter).toBe(0);
  expect(checkDrc(layout).violations).toHaveLength(0);
  expect(JSON.stringify(layout.pads)).toBe(before);
});

test('edge attachment can join two blocked centres at full width', () => {
  const layout = padAttachmentBoard();
  layout.pads = [...layout.pads, ...layout.pads.filter(p => p.id >= 12).map(p => ({ ...p, id: p.id + 2, at: { x: 40000, y: p.at.y } }))];
  const report = route(layout, { viasAllowed: false, fanoutEnabled: false, neckWidthUm: 0, optimizerEnabled: false, maxPasses: 1 });
  expect(report.incompleteAfter).toBe(0);
  expect(checkDrc(layout).violations).toHaveLength(0);
  expect(layout.tracks.every(t => t.width === 8000)).toBe(true);
});

test('blocked pad copper does not permit an unattached shortcut', () => {
  const layout = padAttachmentBoard();
  layout.pads = [...layout.pads, { ...layout.pads[2]!, id: 14, at: { x: 10000, y: 0 } }, { ...layout.pads[3]!, id: 15, at: { x: -10000, y: 0 } }];
  const report = route(layout, { viasAllowed: false, fanoutEnabled: false, neckWidthUm: 0, optimizerEnabled: false, maxPasses: 1 });
  expect(report.incompleteAfter).toBe(1);
  expect(layout.tracks).toHaveLength(0);
});

test('zero item cap prevents pad edge insertion', () => {
  const layout = padAttachmentBoard();
  const report = route(layout, { maxItems: 0, viasAllowed: false, fanoutEnabled: false, neckWidthUm: 0, optimizerEnabled: false });
  expect(report.incompleteAfter).toBe(1);
  expect(layout.tracks).toHaveLength(0);
});

for (const kind of ['capsule', 'concave', 'multiple'] as const) test(`pad attachment uses actual ${kind} copper`, () => {
  const layout = padAttachmentBoard();
  const form = layout.padForms[0]!;
  form.perSheet = new Map([[0, kind === 'capsule'
    ? [{ kind: 'capsule', a: { x: -9000, y: 0 }, b: { x: 9000, y: 0 }, r: 1000 }]
    : kind === 'concave'
      ? [{ kind: 'ring', pts: [{ x: -10000, y: -1000 }, { x: 10000, y: -1000 }, { x: 10000, y: 1000 }, { x: 2000, y: 1000 }, { x: 2000, y: 2000 }, { x: -10000, y: 2000 }] }]
      : [{ kind: 'box', box: { x0: -1000, y0: -1000, x1: 1000, y1: 1000 } }, { kind: 'box', box: { x0: 1000, y0: -1000, x1: 10000, y1: 1000 } }]]]);
  const pads = JSON.stringify(layout.pads);
  const report = route(layout, { viasAllowed: false, fanoutEnabled: false, neckWidthUm: 0, optimizerEnabled: false, maxPasses: 1 });
  expect(report.incompleteAfter).toBe(0);
  expect(requiredConnections(layout)).toHaveLength(0);
  expect(checkDrc(layout).violations).toHaveLength(0);
  expect(layout.tracks.length).toBeGreaterThan(0);
  expect(layout.tracks.every(t => t.width === 8000)).toBe(true);
  expect(layout.barrels).toHaveLength(0);
  expect(JSON.stringify(layout.pads)).toBe(pads);
});

// Both connections need the edge fallback. A positive global budget must stop
// between complete connections rather than allowing every fallback to insert.
test('one-item budget commits only one of two pad-edge connections', () => {
  const layout = padAttachmentBoard();
  layout.pads = [...layout.pads, ...layout.pads.map(p => ({ ...p, id: p.id + 10,
    net: p.net === null ? null : 2, at: { x: p.at.x, y: p.at.y + 30000 } }))];
  layout.nets = [...layout.nets, { id: 2, name: 'SECOND', group: 0, pads: [20, 21] }];
  layout.netGroups = layout.netGroups.map(g => ({ ...g, nets: [...g.nets, 2] }));
  const pads = JSON.stringify(layout.pads);
  const report = route(layout, { maxItems: 1, viasAllowed: false, fanoutEnabled: false,
    neckWidthUm: 0, optimizerEnabled: false, maxPasses: 1 });
  expect(report.completed).toBe(1);
  expect(report.incompleteAfter).toBe(1);
  expect(requiredConnections(layout)).toHaveLength(1);
  expect(report.added.tracks).toBe(1);
  expect(layout.tracks).toHaveLength(1);
  expect(layout.tracks[0]!.width).toBe(8000);
  expect(checkDrc(layout).violations).toHaveLength(0);
  expect(layout.barrels).toHaveLength(0);
  expect(JSON.stringify(layout.pads)).toBe(pads);
});

test('cancellation leaves an edge-routable connection and its copper untouched', () => {
  const layout = padAttachmentBoard();
  const pads = JSON.stringify(layout.pads);
  const controller = new AbortController();
  controller.abort();
  const report = route(layout, { viasAllowed: false, fanoutEnabled: false,
    neckWidthUm: 0, optimizerEnabled: false }, { signal: controller.signal });
  expect(report.aborted).toBe(true);
  expect(report.completed).toBe(0);
  expect(requiredConnections(layout)).toHaveLength(1);
  expect(layout.tracks).toHaveLength(0);
  expect(layout.barrels).toHaveLength(0);
  expect(JSON.stringify(layout.pads)).toBe(pads);
});

test('ignored group does not acquire pad-edge routes', () => {
  const layout = padAttachmentBoard();
  const report = route(layout, { ignoreNetGroups: ['default'], viasAllowed: false,
    fanoutEnabled: false, neckWidthUm: 0, optimizerEnabled: false });
  expect(report.completed).toBe(0);
  expect(requiredConnections(layout)).toHaveLength(1);
  expect(layout.tracks).toHaveLength(0);
  expect(layout.barrels).toHaveLength(0);
});
