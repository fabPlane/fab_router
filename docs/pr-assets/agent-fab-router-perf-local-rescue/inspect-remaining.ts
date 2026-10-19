/** Test whether the isolated-net discovered route survives full-board copper. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {readDsn,applySes} from '../../../src/api.ts';
import {buildLattice} from '../../../src/lattice/index.ts';
import {resolveProfile} from '../../../src/route/profile.ts';
import {resolveSettings} from '../../../src/pipeline/index.ts';
import {sweepClear,ignoreOf} from '../../../src/route/clear.ts';
import type {Track} from '../../../spec/types/layout.ts';
const [whole,isolated,out]=process.argv.slice(2);if(!whole||!isolated||!out||existsSync(out))throw Error('Expected WHOLE ISOLATED UNUSED_OUTPUT');
const rows=JSON.parse(readFileSync(whole,'utf8')).rows as {beforeSes:string}[];
const original=JSON.parse(readFileSync(isolated,'utf8')).rows.find((r:{context:string})=>r.context==='original') as {tracks:Track[]};
const witness=original.tracks.at(-1)!;
const settings=JSON.parse(readFileSync(new URL('../../../test/data/near-complete-endpoint.json',import.meta.url),'utf8')).settings;
const results=rows.map((r,repeat)=>{
 const read=readDsn(readFileSync(new URL('../../../test/data/near-complete-endpoint.dsn',import.meta.url),'utf8'));if(!read.ok)throw Error('parse');
 const l=read.layout;if(!applySes(l,r.beforeSes).ok)throw Error('session');
 const lattice=buildLattice(l),profile=resolveProfile(l,witness.net!,resolveSettings(settings,undefined,l.angleMode));
 const legs=witness.pts.slice(1).map((b,i)=>{
  const a=witness.pts[i]!,result=sweepClear(l,lattice,witness.sheet,{a,b},profile,ignoreOf(witness.net!),witness.width);
  return {a,b,...result};
 });
 return {repeat,legs,blockedLegs:legs.filter(x=>!x.ok).length,blockers:[...new Set(legs.flatMap(x=>x.blocking))].map(id=>({id,track:l.tracks.find(t=>t.id===id),barrel:l.barrels.find(b=>b.id===id),pad:l.pads.find(p=>p.id===id)}))};
});
writeFileSync(out,JSON.stringify({scope:'Exact sweeps of prior isolated route against all-net routed session; diagnostic only',witness,results},null,2)+'\n');
