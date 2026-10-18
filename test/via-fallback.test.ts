import { expect, test } from 'bun:test';
import { blockedFirstViaBoard, viaFallbackBoard } from './helpers/via-fallback.ts';
import { buildLattice } from '../src/lattice/index.ts';
import { resolveProfile } from '../src/route/profile.ts';
import { resolveSettings } from '../src/pipeline/index.ts';
import { dropViaNear } from '../src/route/via.ts';
import { ignoreOf } from '../src/route/clear.ts';
import { route, checkDrc, layoutStats } from '../src/api.ts';
import { connectivity } from '../src/drc/index.ts';

for (const radius of [0, 30000]) {
  test(`via placement tries the next permitted form after a blocked candidate, radius=${radius}`, () => {
    const layout = blockedFirstViaBoard();
    const lattice = buildLattice(layout);
    const profile = resolveProfile(layout, 0, resolveSettings({}, undefined, undefined));
    const drop = dropViaNear(layout, lattice, 0, 3, { x: 0, y: 0 }, profile, ignoreOf(0, [10]), radius);
    expect(drop?.candidate.form).toBe(4);
    expect(drop?.at).toEqual({ x: 0, y: 0 });
    expect(layout.barrels).toEqual([]);
    expect(layout.tracks).toEqual([]);
  });
}

test('public fanout escapes with a later fitting via form and preserves board truth', () => {
  const layout = blockedFirstViaBoard();
  const truth = structuredClone({ pads: layout.pads, forms: layout.padForms, rules: layout.viaRules, fences: layout.fences, pours: layout.pours });
  const report = route(layout, { fanoutEnabled: true, routerEnabled: false, optimizerEnabled: false });
  expect(report.added.barrels).toBe(1);
  expect(layoutStats(layout).connections.incomplete).toBe(0);
  expect(layout.barrels.map(b => b.form)).toEqual([4]);
  expect(connectivity(layout, buildLattice(layout)).neighbours(10)).toContain(layout.barrels[0]!.id);
  expect(checkDrc(layout).counts.violations).toBe(0);
  expect({ pads: layout.pads, forms: layout.padForms, rules: layout.viaRules, fences: layout.fences, pours: layout.pours }).toEqual(truth);
});

test('the first fitting form retains priority', () => {
  const layout = viaFallbackBoard();
  layout.viaRules = [{ id: 0, name: 'ordered', forms: [4, 5], entries: [
    { form: 4, kind: 1, attach: true }, { form: 5, kind: 1, attach: true }] }];
  const profile = resolveProfile(layout, 0, resolveSettings({}, undefined, undefined));
  expect(dropViaNear(layout, buildLattice(layout), 0, 3, { x: 0, y: 0 }, profile, ignoreOf(0, [10]), 30000)?.candidate.form).toBe(4);
});

test('a blocked rule with no alternative still adds no copper', () => {
  const layout = blockedFirstViaBoard();
  layout.viaRules = [{ id: 0, name: 'blocked', forms: [101], entries: [{ form: 101, kind: 1, attach: true }] }];
  const report = route(layout, { fanoutEnabled: true, routerEnabled: false, optimizerEnabled: false });
  expect(report.added).toEqual({ tracks: 0, barrels: 0 });
  expect(checkDrc(layout).counts.violations).toBe(0);
});

for (const disabled of ['vias', 'fanout'] as const) {
  test(`later candidate obeys disabled ${disabled}`, () => {
    const layout = blockedFirstViaBoard();
    const report = route(layout, { fanoutEnabled: disabled !== 'fanout', viasAllowed: disabled !== 'vias', routerEnabled: false, optimizerEnabled: false });
    expect(report.added).toEqual({ tracks: 0, barrels: 0 });
    expect(checkDrc(layout).counts.violations).toBe(0);
  });
}

test('a later candidate must span both requested sheets', () => {
  const layout = blockedFirstViaBoard();
  layout.viaRules = [{ id: 0, name: 'nonspanning', forms: [101, 5], entries: [
    { form: 101, kind: 1, attach: true }, { form: 5, kind: 1, attach: true }] }];
  const profile = resolveProfile(layout, 0, resolveSettings({}, undefined, undefined));
  expect(dropViaNear(layout, buildLattice(layout), 0, 3, { x: 0, y: 0 }, profile, ignoreOf(0, [10]), 30000)).toBeUndefined();
});
