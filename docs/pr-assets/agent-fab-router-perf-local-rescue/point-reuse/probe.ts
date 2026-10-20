import {strict as assert} from 'node:assert';
import {resolve} from 'node:path';
const root=import.meta.dir;
const a=await import(resolve(root,'control/src/route/search.ts'));
const b=await import(resolve(root,'candidate/src/route/search.ts'));
let checks=0, callsA=0,callsB=0, collisions=0;
for(let seed=0;seed<120;seed++)for(const layered of [false,true])for(const reusePoints of [false,true]) {
 const traces:string[][]=[[],[]];
 const run=(mod:any,index:number)=>{
  const seen=new Map<number,number>();
  const pointOf=(gx:number,gy:number)=>{if(index===1 && reusePoints && seed%5===0){const key=(gy+5)*4096+(gx+6),slot=key&4095;const old=seen.get(slot);if(old!==undefined && old!==key)collisions++;seen.set(slot,key);}if(index===0)callsA++;else callsB++;return Object.freeze({x:123+gx*17,y:-413+gy*17});};
  const edge=(...args:any[])=>{const [p,q]=args.slice(-2);traces[index]!.push(`${args.length===3?args[0]:0}:${p.x},${p.y}:${q.x},${q.y}`);return {blocked:(Math.abs(p.x+q.y+seed)%43===0),extra:0,rip:((p.x+q.y)%7===0?[5,2]:[])};};
  const common={region:{gx0:-6,gy0:-5,gx1:seed%5===0?4089:16,gy1:17},dirs:seed%2?a.DIRS_8:a.DIRS_4,minCost:1,bendCost:seed%3,maxPops:seed%7===0?3:3000};
  if(!layered)return mod.aStar({step:17,reusePoints,pointOf,nodeFree:(x:number,y:number)=>(x*11+y*19+seed)%29!==0,edgeCost:edge},{...common,start:{gx:0,gy:0},goal:{gx:12,gy:13},stepCost:()=>1});
  return mod.aStarLayered({step:17,layers:3,reusePoints,pointOf,nodeFree:(l:number,x:number,y:number)=>(l+x*11+y*19+seed)%29!==0,edgeCost:edge,viaMove:(l:number,j:number,x:number,y:number)=>(x+y+seed)%5===0?{extra:67,rip:[]}:null},{...common,starts:[{layer:0,gx:0,gy:0},{layer:1,gx:1,gy:0}],goalCell:{gx:12,gy:13},goalLayers:[2],stepCost:()=>1,viaFloor:67});
 };
 assert.deepEqual(run(a,0),run(b,1));assert.deepEqual(traces[0],traces[1]);checks+=2;
}
assert.ok(callsB<callsA);assert.ok(collisions>0);
console.log(JSON.stringify({checks,callsA,callsB,reducedCalls:callsA-callsB,collisions}));
