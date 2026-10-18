// Usage: bun audit.ts /absolute/path/to/checkout
const root = process.argv[2] ?? process.cwd();
const { board } = await import(root + '/test/helpers/prior-connectivity.ts');
const { checkDrc, requiredConnections } = await import(root + '/src/api.ts');
const { connectivity } = await import(root + '/src/drc/index.ts');
const { createCtx, routeConnection } = await import(root + '/src/route/passes.ts');
const { resolveSettings } = await import(root + '/src/pipeline/index.ts');
function fixture() {
  const base = board([{ net: 1, pts: [{ x: 0, y: -20_000 }, { x: 0, y: 20_000 }], hold: 'locked' }]);
  return { ...base,
    pours: [{ id: 300, net: 0, sheet: 0,
      outline: [{ x: 38_000, y: -2_000 }, { x: 42_000, y: -2_000 }, { x: 42_000, y: 2_000 }, { x: 38_000, y: 2_000 }],
      holes: [], kind: 1, hold: 'locked' as const, origin: 'prior' as const }],
    tracks: [...base.tracks, { id: 201, net: 0, sheet: 0,
      pts: [{ x: -20_000, y: 0 }, { x: -20_000, y: 80_000 }, { x: 40_000, y: 80_000 }, { x: 40_000, y: 0 }],
      width: 4_000, kind: 1, hold: 'free' as const, origin: 'file' as const }],
  };
}


const runs = [];
for (let repeat = 1; repeat <= 3; repeat++) for (const removed of [true, false]) {
 const layout = fixture();
 const ctx = createCtx(layout, resolveSettings({viasAllowed:false, optimizerEnabled:false}, undefined, layout.angleMode));
 ctx.conn = connectivity(layout, ctx.lattice);
 if(removed) ctx.journal.remove(201);
 const before = structuredClone({tracks:layout.tracks, pours:layout.pours,pads:layout.pads});
 const connection = requiredConnections(layout)[0];
 const ok = routeConnection(ctx,connection);
 runs.push({repeat,removed,before,ok,incomplete:requiredConnections(layout).length,violations:checkDrc(layout).counts.violations,tracks:layout.tracks,barrels:layout.barrels});
}
console.log(JSON.stringify(runs,null,2));
