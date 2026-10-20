import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {strict as assert} from 'node:assert';
const s=gunzipSync(readFileSync(new URL('./instrumented-grid.ts.gz',import.meta.url))).toString();
const state=s.slice(s.indexOf('  // Diagnostic only:'),s.indexOf('  // ---- slots (struct of arrays) ----'));
const wrapper=s.slice(s.indexOf('  function collect(sheet:'),s.indexOf('  function collectOriginal('));
const code=new Bun.Transpiler({loader:'ts'}).transformSync(`function make(){${state.replace(/  process.once\([^\n]+\n/,'')}
const sentinel=[];function collectOriginal(){return sentinel;}
${wrapper}
return {collect,invalidateCensus,census,sentinel};}`);
const make=new Function(code+';return make;')();
const x=make(),q={x0:0,y0:0,x1:1,y1:1,s0:0,s1:2,d0:-1,d1:1};
assert.equal(x.collect(0,q,true,undefined),x.sentinel);
x.collect(0,q,true,()=>true);assert.equal(x.census.lruHits,1);assert.equal(x.census.filteredHits,1);assert.equal(x.census.consecutive,1);
x.invalidateCensus();x.collect(0,q,true);assert.equal(x.census.lruHits,1);
x.collect(1,q,true);assert.equal(x.census.lruHits,1);
x.collect(1,q,false);x.collect(1,{...q,s0:7},false);assert.equal(x.census.boxHits,1);
x.collect(1,{...q,s0:7},true);assert.equal(x.census.sweepHits,1);
const y=make();for(let i=0;i<257;i++)y.collect(i,q,true);assert.equal(y.census.evictions,1);
y.collect(0,q,true);assert.equal(y.census.lruHits,0);y.collect(256,q,true);assert.equal(y.census.lruHits,1);
y.invalidateCensus();y.collect(256,q,true);assert.equal(y.census.lruHits,1);
console.log('PASS: exact wrapper identity, mutation, sheet/mode/diagonal keys, filters, LRU eviction and invalidation');
