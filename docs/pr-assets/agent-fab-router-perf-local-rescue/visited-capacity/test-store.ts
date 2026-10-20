import {readFileSync} from 'node:fs';
const root=process.argv[2]!;
function load(v:string){const s=readFileSync(`${root}/${v}/src/route/search.ts`,'utf8');const start=s.indexOf('class VisitedStore');const end=s.indexOf('// One pooled frontier',start);return new Function(Bun.Transpiler ? new Bun.Transpiler({loader:'ts'}).transformSync('const NONE=-1;'+s.slice(start,end)+';return VisitedStore;'): '')();}
const A=load('control'),B=load('candidate');const a=new A(),b=new B();let seed=137,checks=0;
function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;}
function eq(x:any,y:any){if(!Object.is(x,y))throw new Error(`${x} != ${y}`);checks++;}
for(let generation=0;generation<8;generation++){
 a.reset();b.reset();const ref=new Map<number,[number,number]>();
 for(let i=0;i<18000;i++){
 const key=(rnd()%9000)*4294967296+(rnd()%13000),g=rnd()/37,parent=i%7===0?-1:rnd();
 a.put(key,g,parent);b.put(key,g,parent);ref.set(key,[g,parent]);
 if(i%11===0){a.put(key,g/2,parent);b.put(key,g/2,parent);ref.set(key,[g/2,parent]);}
 eq(a.gOr(key,Infinity),b.gOr(key,Infinity));eq(a.leq(key,g),b.leq(key,g));eq(a.parentOf(key),b.parentOf(key));
 }
 for(const [key,[g,p]] of ref){eq(a.gOr(key,Infinity),g);eq(b.gOr(key,Infinity),g);eq(a.parentOf(key),p);eq(b.parentOf(key),p);eq(a.leq(key,g),true);eq(b.leq(key,g-1),false);}
 a.reset();b.reset();for(const key of ref.keys()){eq(a.gOr(key,Infinity),Infinity);eq(b.parentOf(key),-1);}
}
console.log(JSON.stringify({checks,status:'PASS',generations:8,insertionsPerGeneration:18000}));
