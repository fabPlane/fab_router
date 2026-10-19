/** Finite API-level corpus for the exact isolated routing module, not a proof. */
import {strict as assert} from 'node:assert';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const [original,candidate]=process.argv.slice(2);
if(!original||!candidate)throw Error('ORIGINAL CANDIDATE');
const a=await import(pathToFileURL(resolve(original,'src/route/clear.ts')).href);
const b=await import(pathToFileURL(resolve(candidate,'src/route/clear.ts')).href);
let comparisons=0,state=123456789;
const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
const point=()=>({x:rand()%2001-1000,y:rand()%2001-1000});
function check(x:any,y:any,requirements:number[]){
 for(const r of requirements){assert.equal(b.closerThan(x,y,r),a.closerThan(x,y,r));comparisons++;}
 assert.equal(b.overlaps(x,y),a.overlaps(x,y));comparisons++;
}
for(let i=0;i<20000;i++){
 const p=point(),q=point(),r=point(),s=point();
 const x={kind:'capsule',a:p,b:q,r:rand()%20};
 const y={kind:'capsule',a:r,b:s,r:rand()%20};
 check(x,y,[0,1,5,20,100,1000,Infinity,NaN]);
 check(y,{...x,a:q,b:p},[1,20,100]);
}
const edge=2**25;
for(const value of [-edge,edge,edge+1,NaN,Infinity,-Infinity,Number.MAX_VALUE]){
 check({kind:'capsule',a:{x:0,y:0},b:{x:1,y:0},r:1},
 {kind:'capsule',a:{x:0,y:5},b:{x:value,y:5},r:2},[0,1,2,3,Infinity,NaN]);
}
for(const radius of [0,1,2,0.5])for(const separation of [0,1,2,5,10]){
 const x={kind:'capsule',a:{x:0,y:0},b:{x:10,y:0},r:radius};
 const y={kind:'capsule',a:{x:0,y:separation},b:{x:10,y:separation},r:radius};
 const exact=separation-2*radius;
 check(x,y,[exact,exact*(1-Number.EPSILON),exact*(1+Number.EPSILON)]);
 check({...x,b:x.a},y,[0,1,exact]);
 check({kind:'pieces',parts:[x]},y,[0,1,exact]);
 check({kind:'box',x0:0,y0:0,x1:10,y1:0},y,[0,1,exact]);
}
console.log(JSON.stringify({comparisons,mismatches:0,scope:'API-level finite corpus; no native DRC or speed claim'},null,2));
