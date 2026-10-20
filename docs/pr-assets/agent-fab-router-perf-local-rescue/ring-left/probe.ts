import {pathToFileURL} from 'node:url';
const root=process.argv[2]!;
const a=await import(pathToFileURL(root+'/control/src/geom/predicates.ts').href);
const b=await import(pathToFileURL(root+'/candidate/src/geom/predicates.ts').href);
let seed=941,count=0;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;}
function check(r:any[],p:any){const x=a.pointInRing(r,p),y=b.pointInRing(r,p);if(x!==y)throw Error(JSON.stringify({r,p,x,y}));count++;}
for(let k=0;k<5000;k++){
 const r=Array.from({length:rand()%40},()=>({x:(rand()%1001)-500,y:(rand()%1001)-500}));
 for(let j=0;j<100;j++)check(r,{x:(rand()%2001)-1000,y:(rand()%2001)-1000});
 for(let i=0;i<r.length;i++){
  const p=r[i]!,q=r[(i+1)%r.length]!;
  for(const dx of [-1,0,1])for(const dy of [-1,0,1]){check(r,{x:p.x+dx,y:p.y+dy});check(r,{x:(p.x+q.x)/2+dx,y:(p.y+q.y)/2+dy});}
 }
 r.reverse();for(const p of r)check(r,p);
 if(r.length){r[0]!.x+=1;for(const p of r)check(r,p);}
}
for(const m of [33554432,-33554432,0]){const r=[{x:m,y:m},{x:-m,y:m},{x:-m,y:-m},{x:m,y:-m}];for(const p of r)check(r,p);check(r,{x:0,y:0});}
console.log(JSON.stringify({checks:count,status:'PASS',scope:'finite coordinates; classification differential, winding, degeneracy, boundary, mutation, limits'}));
