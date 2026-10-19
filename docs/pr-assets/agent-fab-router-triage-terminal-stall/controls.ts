// Offline diagnostic only: the larger search cap is never installed in engine source.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {readDsn,route,checkDrc} from '../../../src/api.ts';
import {pointFree,ignoreOf} from '../../../src/route/clear.ts';
import {buildLattice} from '../../../src/lattice/index.ts';
import {resolveProfile} from '../../../src/route/profile.ts';
import {DEFAULT_ROUTE_SETTINGS} from '../../../spec/types/settings.ts';
if(!process.argv[2])throw new Error('usage: bun controls.ts NEW_OUTPUT_DIRECTORY');
const out=resolve(process.argv[2]);if(existsSync(out))throw new Error('output directory must be new');await Bun.$`mkdir -p ${out}`;
const original=resolve(import.meta.dir,'../../..');
const copy=resolve(out,'cap-source');await Bun.$`mkdir -p ${copy}`;
for(const f of ['src','spec','package.json'])await Bun.$`cp -r ${resolve(original,f)} ${copy}`;
const passes=resolve(copy,'src/route/passes.ts');const text=await Bun.file(passes).text();
if(text.split('const MAX_POPS = 30_000;').length!==2)throw new Error('expected source cap not found');
await Bun.write(passes,text.replace('const MAX_POPS = 30_000;','const MAX_POPS = 240_000;'));
const candidate=await import(pathToFileURL(resolve(copy,'src/api.ts')).href);
const inputs=[{fixture:'reduced',dsn:await Bun.file(resolve(import.meta.dir,'minimal.dsn')).text(),opens:1},{fixture:'complete-output',dsn:gunzipSync(await Bun.file(resolve(import.meta.dir,'routed.dsn.gz')).arrayBuffer()).toString(),opens:3}];
const settings={timeBudgetMs:120000,maxPasses:100,copperToEdgeClearanceUm:500,holeClearanceUm:250,strictDrc:true,neckWidthUm:0,fanoutEnabled:false,seed:1};
const results=[];
for(const input of inputs)for(const [mode,api] of [['original',{readDsn,route,checkDrc}],['cap-only',candidate]] as const){
 for(let repeat=1;repeat<=3;repeat++){
  const parsed=api.readDsn(input.dsn);if(!parsed.ok)throw parsed;const l=parsed.layout;
  const lat=buildLattice(l);const profile=resolveProfile(l,l.nets.find(n=>n.name==='Net-(Q7-Pad1)')!.id,{...DEFAULT_ROUTE_SETTINGS,...settings});
  const endpointClear=l.pads.filter(p=>p.net===profile.net).map(p=>pointFree(l,lat,p.sheets[0]!,p.at,profile,ignoreOf(p.net)));
  const before=api.checkDrc(l,settings);const tracks=structuredClone(l.tracks),barrels=structuredClone(l.barrels),pads=structuredClone(l.pads);
  const report=api.route(l,settings);const after=api.checkDrc(l,settings);
  for(const [previous,current] of [[tracks,l.tracks],[barrels,l.barrels],[pads,l.pads]] as const){for(const item of previous){if(JSON.stringify(current.find(x=>x.id===item.id))!==JSON.stringify(item))throw new Error('retained item changed');}}
  const expected=input.fixture==='complete-output'?3:mode==='original'?1:0;
  if(before.counts.incompletes!==input.opens||before.counts.violations||after.counts.incompletes!==expected||after.counts.violations||report.timedOut||report.aborted||endpointClear.some(p=>!p.ok))throw new Error('unexpected diagnostic outcome');
  results.push({fixture:input.fixture,mode,repeat,before:before.counts,after:after.counts,endpointClear,report,tracks:l.tracks,barrels:l.barrels,pads:l.pads});
 }
}
await Bun.write(resolve(out,'results.json'),JSON.stringify({settings,results},null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({fixture:r.fixture,mode:r.mode,repeat:r.repeat,after:r.after,added:r.report.added})),null,2));
