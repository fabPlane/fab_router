import { planeBoard } from '../../../test/helpers/plane-board.ts';
import { route } from '../../../src/api.ts';
import { createCtx, routeConnection } from '../../../src/route/passes.ts';
import { resolveSettings } from '../../../src/pipeline/index.ts';
import { checkDrc, connectivity } from '../../../src/drc/index.ts';
const results = [];
for (const mode of ['distant', 'hole', 'under-pad'] as const) {
  const layout = planeBoard(mode);
  const ctx = createCtx(layout, resolveSettings({ fanoutEnabled: false, optimizerEnabled: false }, undefined, layout.angleMode));
  const success = routeConnection(ctx, { net: 0, from: 10, to: 20, airlineLu: 30000 });
  const live = connectivity(layout, ctx.lattice);
  results.push({ mode, success, joined: live.componentOf.get(10) === live.componentOf.get(20), drc: checkDrc(layout).counts,
    pads: layout.pads, pours: layout.pours, tracks: layout.tracks, barrels: layout.barrels, viaRadius: 3000 });
}
const layout = planeBoard('distant');
const report = route(layout, { fanoutEnabled: false, optimizerEnabled: false, ripupEnabled: false, maxPasses: 3 });
console.log(JSON.stringify({ results, repeated: { completed: report.completed, incomplete: report.incompleteAfter, added: report.added, violations: report.violationsAdded } }, null, 2));
