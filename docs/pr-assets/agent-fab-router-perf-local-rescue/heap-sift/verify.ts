// Standalone experiment: extract the production heap without exporting or changing it.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const source = readFileSync('src/route/search.ts', 'utf8');
const start = source.indexOf('class SoaHeap {');
const end = source.indexOf('\nconst NONE =', start);
if (start < 0 || end < 0) throw Error('heap extraction failed');
const original = source.slice(start, end).trim();
const popStart = original.indexOf('  pop(): void {');
const candidate = original.slice(0, popStart) + `  pop(): void {
    this.popF = this.f[0]!; this.popH = this.h[0]!; this.popState = this.st[0]!;
    const last = --this.n;
    if (last > 0) {
      const f = this.f, h = this.h, s = this.seq, st = this.st;
      const tf = f[last]!, th = h[last]!, ts = s[last]!, tt = st[last]!;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        if (l >= last) break;
        const m = r < last && this.less(r, l) ? r : l;
        // Compare the saved element using exactly the original ordered comparisons.
        const mf = f[m]!, mh = h[m]!;
        const move = mf < tf ? true : mf > tf ? false : mh < th ? true : mh > th ? false : s[m]! < ts;
        if (!move) break;
        f[i] = mf; h[i] = mh; s[i] = s[m]!; st[i] = st[m]!;
        i = m;
      }
      f[i] = tf; h[i] = th; s[i] = ts; st[i] = tt;
    }
  }
}`;
const transpiler = new Bun.Transpiler({loader:'ts'});
const make = (s: string): any => new Function(transpiler.transformSync(s) + '; return SoaHeap;')();
const A = make(original), B = make(candidate);
let seed = 72831;
const rand = () => (seed = (Math.imul(seed,1664525)+1013904223) >>> 0);
let pops = 0, pushes = 0, resets = 0;
const failures: any[] = []; const modes: any[] = [];
const digest = createHash('sha256');
for (const mode of ['equal','mixed','growth','reset','exceptional']) {
 const a = new A(), b = new B(); let seq = 0; const before = pops; let reference: number[][] = [];
 try {
 const push = () => { const f = mode === 'equal' ? 1 : mode === 'exceptional' ? [NaN,Infinity,-Infinity,-0,0,1][rand()%6]! : (rand()%100)-50; const h = mode === 'equal' ? 1 : rand()%13; const state = rand(); a.push(f,h,seq,state); b.push(f,h,seq,state); if(mode!=='exceptional') reference.push([f,h,seq,state]); seq++; pushes++; };
 const pop = () => { a.pop(); b.pop(); if(mode!=='exceptional') { let best=0; for(let i=1;i<reference.length;i++) {const x=reference[i]!,y=reference[best]!; if(x[0]!<y[0]! || (x[0]===y[0] && (x[1]!<y[1]! || (x[1]===y[1] && x[2]!<y[2]!)))) best=i;} const item=reference[best]!; reference[best]=reference[reference.length-1]!; reference.pop(); if(!Object.is(a.popF,item[0]) || !Object.is(a.popH,item[1]) || !Object.is(a.popState,item[3])) throw Error('independent oracle mismatch'); } for (const k of ['popF','popH','popState','size']) if (!Object.is(a[k],b[k])) throw Error(mode+': mismatch '+k+' at '+pops); digest.update(JSON.stringify([a.popF,a.popH,a.popState])); pops++; };
 for (let j=0;j<20000;j++) { if (mode==='reset' && j%997===0) {a.clear();b.clear();reference=[];resets++;} if (a.size && mode!=='growth' && rand()%3===0) pop(); else push(); }
 while(a.size) pop();
 modes.push({mode,pops:pops-before,parity:true});
 } catch(error) { if(mode!=='exceptional') throw error; failures.push({mode,error:String(error),pops,original:[String(a.popF),String(a.popH),String(a.popState)],candidate:[String(b.popF),String(b.popH),String(b.popState)]}); modes.push({mode,pops:pops-before,parity:false}); }
}
if(failures.length!==1) throw Error('expected exceptional-priority counterexample');
const timings: any[] = [];
for (let repeat=0;repeat<6;repeat++) for (const [name,C] of repeat%2 ? [['candidate',B],['original',A]] : [['original',A],['candidate',B]]) {
 const heap = new C(); const begin=performance.now();
 for(let run=0;run<12;run++) {for(let i=0;i<20000;i++) heap.push((Math.imul(i,7919)>>>0)%1000,i%17,i,i); while(heap.size)heap.pop();heap.clear();}
 timings.push({repeat,name,milliseconds:performance.now()-begin});
}
const result={adopted:false,failures,modes,sourceSha256:createHash('sha256').update(source).digest('hex'),heapSha256:createHash('sha256').update(original).digest('hex'),pushes,pops,resets,digest:digest.digest('hex'),timings};
writeFileSync(process.argv[2] ?? '/tmp/heap-sift-result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
