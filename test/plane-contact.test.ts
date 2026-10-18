import { expect, test } from 'bun:test';
import { planeBoard } from './helpers/plane-board.ts';
import { route } from '../src/api.ts';
import { resolveSettings } from '../src/pipeline/index.ts';
import { createCtx, routeConnection } from '../src/route/passes.ts';
import { checkDrc, connectivity } from '../src/drc/index.ts';

for (const mode of ['distant', 'hole', 'under-pad'] as const) {
  test(`plane via requires live terminal contact: ${mode}`, () => {
    const layout = planeBoard(mode);
    const ctx = createCtx(layout, resolveSettings({ fanoutEnabled: false, optimizerEnabled: false }, undefined, layout.angleMode));
    const before = { pads: structuredClone(layout.pads), pours: structuredClone(layout.pours) };
    const connected = mode === 'under-pad';
    expect(checkDrc(layout).counts.incompletes).toBe(1);
    expect(routeConnection(ctx, { net: 0, from: 10, to: 20, airlineLu: 30000 })).toBe(connected);
    const live = connectivity(layout, ctx.lattice);
    expect(live.componentOf.get(10) === live.componentOf.get(20)).toBe(connected);
    expect(checkDrc(layout).counts.incompletes).toBe(connected ? 0 : 1);
    expect(checkDrc(layout).counts.violations).toBe(0);
    expect(layout.barrels).toHaveLength(connected ? 1 : 0);
    expect(layout.tracks).toHaveLength(0);
    expect(layout.pads).toEqual(before.pads);
    expect(layout.pours).toEqual(before.pours);
    if (!connected) expect(ctx.lattice.itemOf(21)).toBeUndefined();
  });
}

test('repeated routing leaves no unconnected plane escapes', () => {
  const layout = planeBoard('distant');
  const report = route(layout, { fanoutEnabled: false, optimizerEnabled: false, ripupEnabled: false, maxPasses: 3 });
  expect(report.completed).toBe(0);
  expect(report.incompleteAfter).toBe(1);
  expect(report.violationsAdded).toBe(0);
  expect(layout.barrels).toHaveLength(0);
  expect(layout.tracks).toHaveLength(0);
});

for (const mode of ['distant', 'under-pad'] as const) {
  test(`displaced plane escape preserves atomic stub insertion: ${mode}`, () => {
    const layout = { ...planeBoard(mode), fences: [{ id: 30, sheet: 0, scope: 'barrel' as const, kind: 1,
      shape: { kind: 'disk' as const, c: { x: 0, y: 0 }, r: 5000 } }] };
    const ctx = createCtx(layout, resolveSettings({ fanoutEnabled: false, optimizerEnabled: false }, undefined, layout.angleMode));
    const mark = ctx.journal.mark();
    const connected = mode === 'under-pad';
    expect(routeConnection(ctx, { net: 0, from: 10, to: 20, airlineLu: 30000 })).toBe(connected);
    expect(checkDrc(layout).counts.incompletes).toBe(connected ? 0 : 1);
    expect(checkDrc(layout).counts.violations).toBe(0);
    expect(layout.barrels).toHaveLength(connected ? 1 : 0);
    expect(layout.tracks.length).toBe(connected ? 1 : 0);
    if (connected) expect(layout.barrels[0]!.at).not.toEqual({ x: 0, y: 0 });
    ctx.journal.rewind(mark);
    expect(layout.barrels).toHaveLength(0);
    expect(layout.tracks).toHaveLength(0);
    expect(checkDrc(layout).counts.incompletes).toBe(1);
  });
}
