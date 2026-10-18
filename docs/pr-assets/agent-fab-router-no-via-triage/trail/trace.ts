// Engine-only diagnostics. Each attempt starts from the unchanged input and keeps every obstacle.
import {readDsn, route, requiredConnections} from './src/api.ts';
import {createCtx, routeConnection} from './src/route/passes.ts';
import {pointFree, ignoreOf} from './src/route/clear.ts';
const text = await Bun.file('spec/acceptance/boards/Issue026-J2_reference.dsn').text();
const parsed = readDsn(text);
if (!parsed.ok) throw Error('input parse failed');
const report = route(parsed.layout, {viasAllowed:false, maxPasses:100, timeoutSeconds:60});
const pairs = requiredConnections(parsed.layout);
const attempts = pairs.map(pair => {
  const fresh = readDsn(text);
  if (!fresh.ok) throw Error('input parse failed');
  const ctx = createCtx(fresh.layout, {...report.effectiveSettings, ripupEnabled:false, optimizerEnabled:false});
  const a = fresh.layout.pads.find(p => p.id === pair.from)!;
  const b = fresh.layout.pads.find(p => p.id === pair.to)!;
  console.error("PAIR", JSON.stringify(pair));
  const ok = routeConnection(ctx, pair);
  const profile = ctx.profiles.get(pair.net)!;
  return {pair, ok, from:pointFree(fresh.layout,ctx.lattice,0,a.at,profile,ignoreOf(pair.net),profile.width),
    to:pointFree(fresh.layout,ctx.lattice,0,b.at,profile,ignoreOf(pair.net),profile.width),
    width:profile.width, spacing:profile.maxSpacing, tracks:fresh.layout.tracks.length};
});
if (pairs.length !== 12 || attempts.some(a => !a.from.ok || !a.to.ok)) throw Error('diagnostic controls changed');
console.log(JSON.stringify({report, pairs, attempts}, null, 2));
