import { reachablePlane } from '../../../test/helpers/plane-board.ts';
import { createCtx, routeConnection } from '../../../src/route/passes.ts';
import { resolveSettings } from '../../../src/pipeline/index.ts';
import { checkDrc, connectivity } from '../../../src/drc/index.ts';
const results = [];
for (const hole of [false, true]) {
  const layout = reachablePlane(hole);
  const ctx = createCtx(layout, resolveSettings({ fanoutEnabled: false, optimizerEnabled: false }, undefined, layout.angleMode));
  const success = routeConnection(ctx, { net: 0, from: 10, to: 20, airlineLu: 9000 });
  const live = connectivity(layout, ctx.lattice);
  results.push({ mode: hole ? 'reachable hole edge' : 'reachable pour edge', success,
    joined: live.componentOf.get(10) === live.componentOf.get(20), drc: checkDrc(layout).counts,
    pads: layout.pads, pours: layout.pours, tracks: layout.tracks, barrels: layout.barrels, viaRadius: 3000 });
}
console.log(JSON.stringify(results, null, 2));
