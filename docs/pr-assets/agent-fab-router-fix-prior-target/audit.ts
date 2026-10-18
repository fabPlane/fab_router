import { fixture } from '../../../test/helpers/prior-target.ts';
import { checkDrc, requiredConnections, route } from '../../../src/api.ts';
import { connectivity } from '../../../src/drc/index.ts';
import { createCtx, routeConnection } from '../../../src/route/passes.ts';
import { resolveSettings } from '../../../src/pipeline/index.ts';
const rows = [];
for (let repeat = 1; repeat <= 3; repeat++) for (const concave of [false, true]) {
  const layout = fixture(concave);
  const before = structuredClone({ tracks: layout.tracks, pads: layout.pads, pours: layout.pours });
  const ctx = createCtx(layout, resolveSettings({ viasAllowed: false, optimizerEnabled: false }, undefined, layout.angleMode));
  ctx.conn = connectivity(layout, ctx.lattice);
  const success = routeConnection(ctx, requiredConnections(layout)[0]!);
  const publicLayout = fixture(concave);
  const publicReport = route(publicLayout, { viasAllowed: false, optimizerEnabled: false });
  const publicResult = { opens: requiredConnections(publicLayout).length, violations: checkDrc(publicLayout).counts.violations, report: publicReport };
  rows.push({ repeat, concave, publicResult, success, opens: requiredConnections(layout).length, violations: checkDrc(layout).counts.violations,
    before, after: { tracks: layout.tracks, pads: layout.pads, pours: layout.pours } });
}
console.log(JSON.stringify(rows, null, 2));
