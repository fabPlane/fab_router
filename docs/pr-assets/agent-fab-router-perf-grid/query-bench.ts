import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [baseline, candidate, output] = process.argv.slice(2);
if (!baseline || !candidate || !output) throw new Error('Expected BASELINE_SOURCE CANDIDATE_SOURCE OUTPUT_JSON');
const load = (root: string, file: string) => import(pathToFileURL(resolve(root, file)).href);
const {createLattice: before} = await load(baseline, 'src/lattice/grid.ts');
const {createLattice: after} = await load(candidate, 'src/lattice/grid.ts');
const {emptyLayout} = await load(baseline, 'src/layout/index.ts');
const {dop8OfPts} = await load(baseline, 'src/geom/index.ts');
import {writeFileSync} from 'node:fs';
const indexes={before:before(emptyLayout('micro'),{cellSize:1000}),after:after(emptyLayout('micro'),{cellSize:1000})};
let state=123;const rnd=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32};
for(let id=0;id<2000;id++){
 const x=Math.floor(rnd()*100000),y=Math.floor(rnd()*100000),r=id%10===0?5000:500;
 const d=dop8OfPts([{x,y},{x:x+r,y:y+r}]);
 for(const lattice of Object.values(indexes))lattice.insert({id},0,d);
}
const queries=Array.from({length:10000},()=>{const x=Math.floor(rnd()*100000),y=Math.floor(rnd()*100000);return dop8OfPts([{x,y},{x:x+1000,y:y+1000}])});
const rows=[];
for(let repeat=0;repeat<7;repeat++)for(const kind of ['box','sweep'])for(const version of (repeat%2?['after','before']:['before','after'])){
 const lattice=indexes[version as 'before'|'after'];let checksum=0;const start=performance.now();
 for(let j=0;j<100;j++)for(const q of queries){const hits=kind==='box'?lattice.hits(0,q):lattice.sweepHits(0,q);for(const r of hits)checksum=(checksum+r.id)>>>0;}
 const row={repeat,kind,version,seconds:(performance.now()-start)/1000,checksum};rows.push(row);console.log(row);
 writeFileSync(output,JSON.stringify(rows,null,2)+'\n');
}
for (const kind of ['box', 'sweep']) {
 const checksums = new Set(rows.filter(r => r.kind === kind).map(r => r.checksum));
 if (checksums.size !== 1) throw new Error('Query checksum mismatch: '+kind);
}
