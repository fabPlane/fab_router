import { expect, test } from 'bun:test';
import { reachablePlane } from './helpers/plane-board.ts';
import { route } from '../src/api.ts';
import { checkDrc, connectivity } from '../src/drc/index.ts';
import { resolveSettings } from '../src/pipeline/index.ts';
import { createCtx, routeConnection } from '../src/route/passes.ts';


for (const hole of [false, true]) for (const reverse of [false, true]) {
  test(`plane escape searches beyond a clear disconnected via: hole=${hole}, reverse=${reverse}`, () => {
    const layout = reachablePlane(hole);
    const retained = structuredClone({ pads: layout.pads, pours: layout.pours });
    const ctx = createCtx(layout, resolveSettings({ fanoutEnabled: false, optimizerEnabled: false }, undefined, layout.angleMode));
    const mark = ctx.journal.mark();
    expect(checkDrc(layout).counts.incompletes).toBe(1);
    expect(routeConnection(ctx, { net: 0, from: reverse ? 20 : 10, to: reverse ? 10 : 20, airlineLu: 9000 })).toBe(true);
    const live = connectivity(layout, ctx.lattice);
    expect(live.componentOf.get(10)).toBe(live.componentOf.get(20));
    expect(checkDrc(layout).counts.incompletes).toBe(0);
    expect(checkDrc(layout).counts.violations).toBe(0);
    expect(layout.barrels).toHaveLength(1);
    expect(layout.barrels[0]!.at).not.toEqual({ x: 0, y: 0 });
    expect(layout.tracks).toHaveLength(1);
    expect({ pads: layout.pads, pours: layout.pours }).toEqual(retained);
    ctx.journal.rewind(mark);
    expect(layout.barrels).toHaveLength(0);
    expect(layout.tracks).toHaveLength(0);
    expect(checkDrc(layout).counts.incompletes).toBe(1);
  });
}

test('public plane routing completes at a later candidate without retaining rejected copper', () => {
  const layout = reachablePlane(false);
  const result = route(layout, { fanoutEnabled: false, optimizerEnabled: false, ripupEnabled: false, maxPasses: 3 });
  expect(result.completed).toBe(1);
  expect(result.incompleteAfter).toBe(0);
  expect(result.violationsAdded).toBe(0);
  expect(layout.barrels).toHaveLength(1);
  expect(layout.tracks).toHaveLength(1);
});
