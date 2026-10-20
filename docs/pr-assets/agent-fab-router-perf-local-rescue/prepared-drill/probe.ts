import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
const w=dirname(new URL(import.meta.url).pathname);
const load=async(v:string,f:string)=>import(pathToFileURL(resolve(w,v,f)).href);
const a=await load('control','src/lattice/index.ts'), b=await load('candidate','src/lattice/index.ts');
const {synthLayout,mulberry32}=await load('candidate','test/helpers/synth.ts');
const layout=synthLayout({seed:99,parts:40,barrels:40,tracks:80});
const grid=b.buildLattice(layout);let checks=0;
for(const [cat,items] of [['pad',layout.pads],['barrel',layout.barrels]] as const){
 for(const item of items){
  const direct=()=>cat==='pad'?a.drillOfPad(layout,item):a.drillOfBarrel(layout,item);
  assert.deepEqual(grid.itemOf(item.id).drill,direct());checks++;
  grid.rebuild();assert.deepEqual(grid.itemOf(item.id).drill,direct());checks++;
  grid.removeItem(item.id);assert.equal(grid.itemOf(item.id),undefined);checks++;
  const at=item.at;item.at={x:at.x+500,y:at.y-300};grid.insertItem(cat,item);
  assert.deepEqual(grid.itemOf(item.id).drill,direct());checks++;
  item.at=at;grid.insertItem(cat,item);assert.deepEqual(grid.itemOf(item.id).drill,direct());checks++;
 }
}
// The contract requires reinserting every affected item after a shared form changes.
for(const form of layout.padForms){
 if(!form.drill)continue;
 const diameter=form.drill.diameter;form.drill.diameter=diameter+200;
 for(const [cat,items]of [['pad',layout.pads],['barrel',layout.barrels]]as const)for(const item of items)if(item.form===form.id){
  grid.insertItem(cat,item);assert.deepEqual(grid.itemOf(item.id).drill,cat==='pad'?a.drillOfPad(layout,item):a.drillOfBarrel(layout,item));checks++;
 }
 form.drill.diameter=diameter;
}
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
