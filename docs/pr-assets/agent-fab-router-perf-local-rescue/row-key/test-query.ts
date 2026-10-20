import { strict as a } from 'node:assert';
const w=process.argv[2]; if (!w) throw Error("source directory required");
const {createLattice:control}=await import(w+'/control/src/lattice/grid.ts');
const {createLattice:candidate}=await import(w+'/candidate/src/lattice/grid.ts');
const {emptyLayout}=await import(w+'/control/src/layout/index.ts');
const c=control(emptyLayout()),e=candidate(emptyLayout());
let checks=0;
function query(sheet:number,q:any,sweep:boolean,filter?:any){
 const method=sweep?'sweepHits':'hits';
 const x=c[method](sheet,q,filter), y=e[method](sheet,q,filter);
 a.deepEqual(y,x);checks++;
 return y;
}
let state=12345;function rnd(){state=(Math.imul(state,1664525)+1013904223)|0;return state>>>0;}
const box=(x:number,y:number,n:number)=>({x0:x,y0:y,x1:x+n,y1:y+n,s0:x+y,s1:x+y+2*n,d0:x-y-n,d1:x-y+n});
for(let i=0;i<5000;i++){
 const id=rnd()%100,sheet=rnd()%4,q=box((rnd()%20000)-10000,(rnd()%20000)-10000,rnd()%10000);
 if(i%7===0){c.remove({id},sheet);e.remove({id},sheet);}
 else if(i%11===0){c.rebuild(500);e.rebuild(500);}
 else {c.insert({id},sheet,q);e.insert({id},sheet,q);}
 for(const sweep of [false,true]){
  const found=query(sheet,q,sweep);if(found[0])found[0].id=999999;found.push({id:123456});
  query(sheet,q,sweep);query(sheet+1,q,sweep);query(sheet,{...q,s0:q.s0+100000},sweep);
  let visitsC:any[]=[],visitsE:any[]=[];
  const method=sweep?'sweepHits':'hits';
  const x=c[method](sheet,q,(r:any)=>{visitsC.push({...r});return r.id%2===0;});
  const y=e[method](sheet,q,(r:any)=>{visitsE.push({...r});return r.id%2===0;});
  a.deepEqual(y,x);a.deepEqual(visitsE,visitsC);checks+=2;
 }
}
// Numeric edge cases preserve existing query behavior.
for(const x of [0,-0,0.5,2**32,2**40,Infinity,-Infinity,NaN])for(const sweep of [false,true])for(let j=0;j<3;j++)query(0,box(x,0,1),sweep);
// Repeated identical requests around replacement, removal, slot reuse and rebuild.
const fixed=box(-100000,-100000,200000);
for(let i=0;i<100;i++){
 query(0,fixed,true);query(0,fixed,false);
 for(const g of [c,e])g.insert({id:1000},0,box(i,i,50));
 query(0,fixed,true);query(0,fixed,false);
 for(const g of [c,e])g.remove({id:1000},0);
 query(0,fixed,true);query(0,fixed,false);
 for(const g of [c,e])g.insert({id:1001},0,box(i+1,i+1,50));
 query(0,fixed,true);query(0,fixed,false);
 for(const g of [c,e])g.rebuild(1000+i);
 query(0,fixed,true);query(0,fixed,false);
}
// Filters receive fresh refs and execute each time even when mutable state changes.
for(let n=0;n<10;n++){
 let cx=0,ex=0;
 const x=c.hits(0,fixed,(r:any)=>{cx++;r.id+=n;return cx%2===0;});
 const y=e.hits(0,fixed,(r:any)=>{ex++;r.id+=n;return ex%2===0;});
 a.deepEqual(y,x);a.equal(ex,cx);checks+=2;query(0,fixed,false);
}
console.log('PASS' ,checks,'differential checks; detached arrays/refs, callback order, mutation, mode/sheet/diagonals, numeric collisions');
