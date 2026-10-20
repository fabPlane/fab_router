import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
const w=dirname(new URL(import.meta.url).pathname);
const load=async(v:string,f:string)=>import(pathToFileURL(resolve(w,v,f)).href);
const a=await load('control','src/lattice/index.ts'), b=await load('candidate','src/lattice/index.ts');
const {synthLayout,mulberry32}=await load('candidate','test/helpers/synth.ts');
const layout=synthLayout({seed:99,parts:40,barrels:40,tracks:80});
const grid=b.buildLattice(layout);let checks=0;
for(const [cat,items] of [['pad',layout.pads],['barrel',layout.barrels],['track',layout.tracks]] as const){
 for(const item of items){
  const view=grid.itemViewOf(item.id);
  assert.deepEqual(view,grid.itemOf(item.id));checks++;
  assert.equal(Object.isFrozen(view),true);checks++;
  assert.equal(grid.itemViewOf(item.id),view);checks++;
  const snapshot=grid.itemOf(item.id);snapshot.cat='fence';
  assert.equal(grid.itemOf(item.id).cat,cat);checks++;
  assert.equal(view.cat,cat);checks++;
  assert.deepEqual(Object.keys(view).sort(),['cat','item']);checks++;
  grid.rebuild();assert.equal(grid.itemViewOf(item.id),view);checks++;
  grid.removeItem(item.id);assert.equal(grid.itemViewOf(item.id),undefined);checks++;
  const replacement={...item};grid.insertItem(cat,replacement);
  const next=grid.itemViewOf(item.id);
  assert.notEqual(next,view);checks++;
  assert.equal(next.item,replacement);checks++;
  assert.equal(view.item,item);checks++;
  grid.insertItem(cat,item);
 }
}
assert.equal(grid.itemViewOf(123456789),undefined);checks++;
const ga=a.buildLattice(layout),gb=b.buildLattice(layout);
const ca=await load('control','src/route/clear.ts'),cb=await load('candidate','src/route/clear.ts');
const {resolveProfile}=await load('candidate','src/route/profile.ts');
const {DEFAULT_ROUTE_SETTINGS}=await load('candidate','spec/types/settings.ts');
const random=mulberry32(770);
for(let i=0;i<20000;i++){
 const p={x:Math.round((random()-.5)*600000),y:Math.round((random()-.5)*500000)};
 const q={x:p.x+Math.round((random()-.5)*10000),y:p.y+Math.round((random()-.5)*10000)};
 const profile=resolveProfile(layout,i%4===0?null:i%5,DEFAULT_ROUTE_SETTINGS);const ignore={ids:new Set<number>(),net:i%4===0?null:i%5};
 assert.deepEqual(ca.sweepClear(layout,ga,i%4,{a:p,b:q},profile,ignore),cb.sweepClear(layout,gb,i%4,{a:p,b:q},profile,ignore));checks++;
}
console.log(JSON.stringify({checks,sweepQueries:20000,status:'PASS'}));
