import { expect, test } from 'bun:test';
import { planeBoard } from './helpers/plane-board.ts';
import { resolveSettings } from '../src/pipeline/index.ts';
import { createCtx, routeConnection } from '../src/route/passes.ts';
import { buildLattice } from '../src/lattice/index.ts';
import { checkDrc, connectivity } from '../src/drc/index.ts';

for (const bridged of [false, true]) {
  for (const reverse of [false, true]) {
    test(`plane escape requires the requested pour component: bridged=${bridged}, reverse=${reverse}`, () => {
      const layout = planeBoard('distant');
      layout.pours = [...layout.pours, { ...layout.pours[0]!, id: 40,
        outline: [{ x: -10000, y: -10000 }, { x: 10000, y: -10000 },
          { x: 10000, y: 10000 }, { x: -10000, y: 10000 }] }];
      if (bridged) layout.tracks = [{ id: 50, net: 0, sheet: 1,
        pts: [{ x: 0, y: 0 }, { x: 40000, y: 0 }], width: 2000, kind: 1, hold: 'locked' }];
      const retained = { pads: structuredClone(layout.pads), pours: structuredClone(layout.pours),
        tracks: structuredClone(layout.tracks) };
      const ctx = createCtx(layout, resolveSettings({ fanoutEnabled: false, optimizerEnabled: false }, undefined, layout.angleMode));
      const mark = ctx.journal.mark();
      const before = connectivity(layout, ctx.lattice);
      expect(before.componentOf.get(20) === before.componentOf.get(40)).toBe(bridged);
      const connection = { net: 0, from: reverse ? 20 : 10, to: reverse ? 10 : 20, airlineLu: 30000 };
      expect(routeConnection(ctx, connection)).toBe(bridged);
      for (const live of [connectivity(layout, ctx.lattice), connectivity(layout, buildLattice(layout))]) {
        expect(live.componentOf.get(10) === live.componentOf.get(20)).toBe(bridged);
      }
      expect(layout.barrels).toHaveLength(bridged ? 1 : 0);
      expect(layout.tracks).toEqual(retained.tracks);
      expect(layout.pours).toEqual(retained.pours);
      expect(layout.pads).toEqual(retained.pads);
      expect(checkDrc(layout).counts.violations).toBe(0);
      ctx.journal.rewind(mark);
      expect(layout.barrels).toHaveLength(0);
      expect(layout.tracks).toEqual(retained.tracks);
      expect(connectivity(layout, ctx.lattice).componentOf.get(10)).not.toBe(connectivity(layout, ctx.lattice).componentOf.get(20));
      expect(ctx.lattice.itemOf(51)).toBeUndefined();
    });
  }
}
