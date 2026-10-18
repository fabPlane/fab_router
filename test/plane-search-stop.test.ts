import { expect, test, spyOn } from 'bun:test';
import { planeBoard } from './helpers/plane-board.ts';
import { resolveSettings } from '../src/pipeline/index.ts';
import { createCtx, routeConnection } from '../src/route/passes.ts';
import { checkDrc } from '../src/drc/index.ts';

for (const stop of ['abort-before', 'deadline-before', 'abort-during', 'deadline-during'] as const) {
  test(`blocked plane candidates stop without yielding: ${stop}`, () => {
    const layout = planeBoard('under-pad');
    layout.fences = [{ id: 30, sheet: 0, scope: 'barrel', kind: 1,
      shape: { kind: 'disk', c: { x: 0, y: 0 }, r: 50000 } }];
    const controller = new AbortController();
    // The item cap keeps subsequent detailed tiers out of this focused plane-helper test.
    const ctx = createCtx(layout, resolveSettings({ maxItems: 0, fanoutEnabled: false, optimizerEnabled: false }, undefined, layout.angleMode), { signal: controller.signal });
    if (stop === 'abort-before') controller.abort();
    if (stop === 'deadline-before') ctx.deadline = -1;
    let clock = Date.now();
    const clockSpy = stop === 'deadline-during' ? spyOn(Date, 'now').mockImplementation(() => clock) : undefined;
    if (clockSpy) ctx.deadline = clock + 1000;
    let queries = 0;
    const hits = ctx.lattice.hits.bind(ctx.lattice);
    ctx.lattice.hits = (...args: Parameters<typeof hits>) => {
      queries++;
      if (queries === 3) {
        if (stop === 'abort-during') controller.abort();
        if (stop === 'deadline-during') clock += 2000;
      }
      return hits(...args);
    };
    try {
      expect(routeConnection(ctx, { net: 0, from: 10, to: 20, airlineLu: 10000 })).toBe(false);
    } finally { clockSpy?.mockRestore(); }
    if (stop.endsWith('before')) expect(queries).toBe(0);
    if (stop.endsWith('during')) expect(queries).toBeLessThanOrEqual(4);
    expect(layout.barrels).toHaveLength(0);
    expect(layout.tracks).toHaveLength(0);
    expect(checkDrc(layout).counts.incompletes).toBe(1);
    expect(checkDrc(layout).counts.violations).toBe(0);
  });
}
