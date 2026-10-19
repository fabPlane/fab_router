// Diagnostic only: no production imports this module. Run from repository root.
import { dist2PtSeg, dist2SegSeg } from '../../../../src/geom/distance.ts';
import { segsIntersect } from '../../../../src/geom/predicates.ts';
import type { Pt } from '../../../../src/geom/types.ts';
import { strict as assert } from 'node:assert';
const bins = [0, 0, 0, 0, 0, 0];
let comparisons = 0, fallback = 0;
function candidate(p: Pt[], limit: number, touching: boolean): boolean {
  const [a, b, c, d] = p as [Pt, Pt, Pt, Pt];
  const cmp = (x: number) => touching ? x <= limit : x < limit;
  // Outside the documented coordinate domain, preserve Math.min NaN propagation.
  if (p.some(q => !Number.isFinite(q.x) || !Number.isFinite(q.y) || Math.abs(q.x) > 2 ** 25 || Math.abs(q.y) > 2 ** 25)) {
    fallback++; return cmp(dist2SegSeg(a,b,c,d));
  }
  if (segsIntersect(a,b,c,d)) { bins[0]!++; return cmp(0); }
  const args: [Pt,Pt,Pt][] = [[a,c,d],[b,c,d],[c,a,b],[d,a,b]];
  for (let i=0; i<4; i++) if (cmp(dist2PtSeg(...args[i]!))) { bins[i+1]!++; return true; }
  bins[5]!++; return false;
}
function check(p: Pt[]) {
  const distance = dist2SegSeg(...p as [Pt,Pt,Pt,Pt]);
  // Include exact equality and both neighbours; preserve threshold multiplication order.
  const limits = [0,1,4,25,Infinity,NaN,distance,distance*(1-Number.EPSILON),distance*(1+Number.EPSILON)];
  for (const limit of limits) for (const touching of [false,true]) {
    assert.equal(candidate(p,limit,touching), touching ? distance <= limit : distance < limit);
    comparisons++;
  }
}
const points: Pt[] = [];
for (let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) points.push({x,y});
for(const a of points) for(const b of points) for(const c of points) for(const d of points) check([a,b,c,d]);
let state=123456789;
const rand=()=> {state=(Math.imul(state,1664525)+1013904223)>>>0; return state;};
for(let i=0;i<20000;i++) {
  const p=Array.from({length:4},()=>({x:(rand()%67108865)-33554432,y:(rand()%67108865)-33554432}));
  check(p); check([p[1]!,p[0]!,p[3]!,p[2]!]);
}
const edge = 2 ** 25;
check([{x:-edge,y:-edge},{x:edge,y:edge},{x:-edge,y:edge},{x:edge,y:-edge}]);
check([{x:-edge,y:0},{x:-edge,y:0},{x:edge,y:0},{x:edge,y:0}]);
for(const v of [NaN,Infinity,-Infinity,Number.MAX_VALUE]) check([{x:0,y:0},{x:1,y:0},{x:0,y:0},{x:v,y:1}]);
console.log(JSON.stringify({comparisons,fallback,syntheticBins:bins,scope:'Synthetic equivalence only; bins are not board workload or speed evidence.'},null,2));
