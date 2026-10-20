import { dist2PtSeg as control } from './control/src/geom/distance.ts';
import { dist2PtSeg as candidate } from './candidate/src/geom/distance.ts';
let checked=0, state=108;
const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state};
const check=(p:{x:number,y:number},a:{x:number,y:number},b:{x:number,y:number})=>{
 const x=control(p,a,b),y=candidate(p,a,b);checked++;
 if(!Object.is(x,y))throw Error(JSON.stringify({p,a,b,x,y,checked}));
};
const pts=[];for(let x=-2;x<=2;x++)for(let y=-2;y<=2;y++)pts.push({x,y});
for(const p of pts)for(const a of pts)for(const b of pts)check(p,a,b);
for(let i=0;i<500000;i++){
 const point=()=>({x:(random()%67108865)-33554432,y:(random()%67108865)-33554432});
 const a=point(),b=point(),p=point();
 check(p,a,b);check(p,b,a);check(a,a,b);check(b,a,b);check(p,a,a);
}
const limits=[-33554432,-33554431,-1,0,1,33554431,33554432];
const edge=limits.flatMap(x=>limits.map(y=>({x,y})));
for(const p of edge)for(const a of edge)for(const b of edge)check(p,a,b);
console.log(JSON.stringify({checked,domain:'finite integer coordinates with absolute value <= 2^25',equal:'Object.is, squared distances',seed:108}));
