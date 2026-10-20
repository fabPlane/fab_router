import {readFileSync} from 'node:fs';
const root=process.argv[2]!;
function load(v:string){const s=readFileSync(`${root}/${v}/src/route/search.ts`,'utf8');return new Function(new Bun.Transpiler({loader:'ts'}).transformSync(s.slice(s.indexOf('class SoaHeap'),s.indexOf('const NONE'))+';return SoaHeap;'))();}
const A=load('control'), B=load('candidate');const a=new A(),b=new B();let seed=137,checks=0;
function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;}
function eq(x:number,y:number){if(!Object.is(x,y))throw Error(`${x} != ${y}`);checks++;}
for(let gen=0;gen<8;gen++){
 a.clear();b.clear();const ref:{f:number,h:number,seq:number,state:number}[]=[];
 for(let i=0;i<18000;i++){
 const n={f:rnd()%19,h:rnd()%7,seq:i,state:rnd()*4294967296+rnd()};
 ref.push(n);a.push(n.f,n.h,n.seq,n.state);b.push(n.f,n.h,n.seq,n.state);
 if(i%3===0){a.pop();b.pop();eq(a.popF,b.popF);eq(a.popH,b.popH);eq(a.popState,b.popState);}
 }
 while(a.size){a.pop();b.pop();eq(a.popF,b.popF);eq(a.popH,b.popH);eq(a.popState,b.popState);eq(a.size,b.size);}
 // Independent sorted order exercises growth and ties without interleaved pops.
 a.clear();b.clear();for(const n of ref){a.push(n.f,n.h,n.seq,n.state);b.push(n.f,n.h,n.seq,n.state);}
 ref.sort((x,y)=>x.f-y.f||x.h-y.h||x.seq-y.seq);
 for(const n of ref){a.pop();b.pop();for(const c of [a,b]){eq(c.popF,n.f);eq(c.popH,n.h);eq(c.popState,n.state);}}
 // Clearing a nonempty heap must discard previous entries.
 a.push(-1,-1,1,1);b.push(-1,-1,1,1);a.clear();b.clear();eq(a.size,0);eq(b.size,0);
}
console.log(JSON.stringify({checks,status:'PASS'}));
