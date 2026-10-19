// Engine-only diagnostics. Each attempt starts from the unchanged input and keeps every obstacle.
import {readDsn, route, requiredConnections, checkDrc} from './src/api.ts';
import {createCtx, routeConnection} from './src/route/passes.ts';
import {connectivity} from './src/drc/index.ts';
import {buildLattice} from './src/lattice/index.ts';
import {pointFree, ignoreOf} from './src/route/clear.ts';
const text = await Bun.file('spec/acceptance/boards/Issue026-J2_reference.dsn').text();
const parsed = readDsn(text);
if (!parsed.ok) throw Error('input parse failed');
const report = route(parsed.layout, {viasAllowed:false, maxPasses:100, timeoutSeconds:60});
const pairs = requiredConnections(parsed.layout);
process.env.ROUTER_COMPONENT_ACTIVE = '1';
const selected = pairs.filter(p => [2,4,5,7,9].includes(p.net));
const attempts = selected.map(pair => {
  const fresh = readDsn(text);
  if (!fresh.ok) throw Error('input parse failed');
  const retained = JSON.stringify([fresh.layout.pads,fresh.layout.tracks,fresh.layout.barrels,fresh.layout.pours]);
  const originalTracks=fresh.layout.tracks.slice();
  const beforeDrc=checkDrc(fresh.layout).violations;
  const ctx = createCtx(fresh.layout, {...report.effectiveSettings, ripupEnabled:false, optimizerEnabled:false});
  const a = fresh.layout.pads.find(p => p.id === pair.from)!;
  const b = fresh.layout.pads.find(p => p.id === pair.to)!;
  console.error("PAIR", JSON.stringify(pair));
  const ok = routeConnection(ctx, pair);
  const conn=connectivity(fresh.layout,buildLattice(fresh.layout));
  const connected=conn.componentOf.get(a.id)!==undefined && conn.componentOf.get(a.id)===conn.componentOf.get(b.id);
  const addedDrc=checkDrc(fresh.layout).violations.filter(v=>!beforeDrc.some(b=>JSON.stringify(v)===JSON.stringify(b)));
  const retainedAfter=JSON.stringify([fresh.layout.pads,originalTracks.map(t=>fresh.layout.tracks.find(x=>x.id===t.id)),fresh.layout.barrels,fresh.layout.pours]);
  if (retained!==retainedAfter || addedDrc.length || ok!==connected) throw Error('retention/clearance/connectivity audit failed');
  const profile = ctx.profiles.get(pair.net)!;
  return {pair, ok, connected, addedDrc, retainedUnchanged:retained===retainedAfter, from:pointFree(fresh.layout,ctx.lattice,0,a.at,profile,ignoreOf(pair.net),profile.width),
    to:pointFree(fresh.layout,ctx.lattice,0,b.at,profile,ignoreOf(pair.net),profile.width),
    width:profile.width, spacing:profile.maxSpacing, tracks:fresh.layout.tracks.length};
});
if (pairs.length !== 12 || selected.length !== 5 || attempts.some(a => !a.from.ok || !a.to.ok)) throw Error('diagnostic controls changed');
console.log(JSON.stringify({report, pairs, attempts}, null, 2));
