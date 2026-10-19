/** Independent small trace checks; clearance is stubbed only in this process. */
import {mock} from 'bun:test';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {strict as assert} from 'node:assert';
const source=resolve(process.argv[2]!);
mock.module(resolve(source,'src/route/clear.ts'),()=>({ignoreOf:()=>new Set(),pointFree:(_a:any,_b:any,_c:any,p:any)=>({ok:p.x>=0})}));
const {createQuilt}=await import(pathToFileURL(resolve(source,'src/route/quilt.ts')).href);
const q=createQuilt({} as any,{} as any,0,{net:1,width:1} as any,{x:0,y:0},1);
// Independent slot reference uses arithmetic remainder and a Map, not typed slots.
const sizes=[64,256,1024], maps=sizes.map(()=>new Map<number,string>());
const counts=sizes.map(size=>({size,hits:0,cold:0,collisions:0}));
let calls=0,invalidations=0;
function query(x:number,y:number){
  calls++;
  sizes.forEach((size,i)=>{
    const mod=(n:number)=>((n%size)+size)%size;
    const slot=mod(mod(x)^mod(y*31)),key=`${x},${y}`;
    if(maps[i]!.get(slot)===key)counts[i]!.hits++;
    else{counts[i]![maps[i]!.has(slot)?'collisions':'cold']++;maps[i]!.set(slot,key);}
  });
  assert.equal(q.state(x,y),x>=0?'free':'blocked');
}
function invalidate(box:any){invalidations++;maps.forEach(m=>m.clear());q.invalidate(box);}
query(0,0);query(0,0);query(-1,-2);query(-1,-2);query(64,0);query(0,0);
for(let x=10;x<30;x++)query(x,7);
assert.equal(q.decided(),23);
invalidate({x0:10000,y0:10000,x1:10000,y1:10000}); // partial invalidation; front clears even for unaffected cells
assert.equal(q.decided(),23);
query(0,0);query(0,0);
for(let x=-32;x<40;x++)for(let y=-3;y<4;y++)query(x,y);
invalidate({x0:-10000,y0:-10000,x1:10000,y1:10000});query(-1,-2);query(-1,-2);
invalidate({x0:-10000,y0:-10000,x1:10000,y1:10000});
invalidate({x0:0,y0:0,x1:0,y1:0}); // empty cache
query(0,0);query(0,0);
const c=(globalThis as any).__quiltCensus;
assert.deepEqual(c.slots,counts);assert.equal(c.calls,calls);assert.equal(c.invalidations,invalidations);
assert.equal(c.quilts,1);assert.equal(c.mapHits,9);
console.log(JSON.stringify({scope:'independent reference trace, stub clearance, no geometry claim',census:c}));
