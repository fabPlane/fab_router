/** Differential public API trace; stub clearance only, no geometry claim. */
import {mock} from 'bun:test';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {strict as a} from 'node:assert';
const [original,candidate]=process.argv.slice(2,4).map(p=>resolve(p));
let probes=0, epoch=0;
for(const root of [original,candidate])mock.module(resolve(root!,'src/route/clear.ts'),()=>({ignoreOf:()=>new Set(),pointFree:(_a:any,_b:any,_c:any,p:any)=>{probes++;return {ok:(p.x+p.y+epoch)%3!==0};}}));
const modules=await Promise.all([original,candidate].map((root,i)=>import(pathToFileURL(resolve(root!,'src/route',i ? (process.argv[4] ?? 'quilt.ts') : 'quilt.ts')).href)));
const qs=modules.map(m=>m.createQuilt({},{},0,{net:1,width:1},{x:0,y:0},1));
let calls=0, invalidations=0, seed=42;
function query(x:number,y:number){const result=qs.map(q=>{probes=0;return [q.state(x,y),probes,q.decided(),q.pointOf(x,y)];});a.deepEqual(result[1],result[0]);calls++;}
function invalidate(box:any){epoch++;qs.forEach(q=>q.invalidate(box));a.equal(qs[0].decided(),qs[1].decided());invalidations++;}
for(const x of [0,-0,NaN,Infinity,-Infinity,0.5,-1.5,2**40,Number.MAX_VALUE])for(const y of [0,NaN,1,-2,0.25]){query(x,y);query(x,y);}
invalidate({x0:-Infinity,y0:-Infinity,x1:Infinity,y1:Infinity});
for(let i=0;i<20000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=(seed%129)-64;const y=((seed>>>8)%31)-15;query(x,y);query(x,y);if(i%997===0)invalidate({x0:x-1,y0:y-1,x1:x+1,y1:y+1});}
invalidate({x0:-1e6,y0:-1e6,x1:1e6,y1:1e6});invalidate({x0:0,y0:0,x1:0,y1:0});query(0,0);query(0,0);
console.log(JSON.stringify({calls,invalidations,status:'PASS',scope:'public API parity with deterministic stub clearance'}));
