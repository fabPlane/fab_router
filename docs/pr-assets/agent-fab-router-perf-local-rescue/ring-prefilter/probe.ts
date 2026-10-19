/** Isolated predicate prerequisite; deliberately does not modify production routing. */
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readDsn } from '../../../../src/api.ts';
import { pointInRing, onSeg, orient } from '../../../../src/geom/predicates.ts';
import type { Pt } from '../../../../src/geom/types.ts';
const input = gunzipSync(readFileSync(new URL('../native-profile/board.dsn.gz', import.meta.url)));
const parsed = readDsn(input.toString());
if (!parsed.ok || !parsed.layout.rim) throw Error('input');
const ring = parsed.layout.rim.outline;
// Reject edges outside the CLOSED y interval before onSeg. Equality must remain eligible:
// horizontal, zero-length and vertex boundary hits still require the original exact predicate.
function candidate(pts: readonly Pt[], p: Pt) {
  if (pts.length < 3) return pointInRing(pts, p);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[j]!, b = pts[i]!;
    if (p.y < Math.min(a.y, b.y) || p.y > Math.max(a.y, b.y)) continue;
    if (onSeg(p, a, b)) return 'boundary';
    if ((a.y > p.y) !== (b.y > p.y)) {
      const o = orient(a, b, p);
      if (b.y > a.y ? o > 0 : o < 0) inside = !inside;
    }
  }
  return inside ? 'inside' : 'outside';
}
let seed = 57;
function rand() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; }
let checked = 0;
function verify(r: Pt[], probes: Pt[]) {
  for (const p of probes) {
    if (candidate(r, p) !== pointInRing(r, p)) throw Error(JSON.stringify({r,p}));
    checked++;
  }
}
const xs = ring.map(p => p.x), ys = ring.map(p => p.y);
const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
const probes: Pt[] = [];
for (let i = 0; i < 100000; i++) probes.push({x:minX-10+rand()%(maxX-minX+21), y:minY-10+rand()%(maxY-minY+21)});
for (let i = 0; i < ring.length; i++) {
  const a = ring[i]!, b = ring[(i+1)%ring.length]!;
  for (const p of [a,{x:(a.x+b.x)/2,y:(a.y+b.y)/2}])
    for (const dy of [-1,0,1]) probes.push({x:p.x,y:p.y+dy});
}
verify(ring, probes); verify([...ring].reverse(), probes);
for (let trial = 0; trial < 3000; trial++) {
  const r = Array.from({length:trial%18}, () => ({x:rand()%41-20,y:rand()%41-20}));
  const ps = [...r, ...Array.from({length:40},()=>({x:rand()%61-30,y:rand()%61-30}))];
  verify(r,ps); verify([...r].reverse(),ps);
  if(r.length) { r[0]!.y += 3; verify(r,ps); } // live mutations: no prepared cache
}
const rows: {mode:string,repeat:number,seconds:number,checksum:number}[] = [];
function run(mode: string, repeat: number) {
  const f = mode === 'original' ? pointInRing : candidate;
  let checksum = 0; const start = performance.now();
  for (let k = 0; k < 3; k++) for (const p of probes) { const result = f(ring,p); checksum += result==='inside'?1:result==='boundary'?2:0; }
  rows.push({mode,repeat,seconds:(performance.now()-start)/1000,checksum});
}
run('original',-1);run('candidate',-1);
for(let i=0;i<5;i++) for(const mode of i%2?['candidate','original']:['original','candidate']) run(mode,i);
if(new Set(rows.map(r=>r.checksum)).size!==1) throw Error('checksum');
writeFileSync(process.argv[2]!,JSON.stringify({scope:'Isolated predicate only; no route/native score or adoption',inputSha256:createHash('sha256').update(input).digest('hex'),vertices:ring.length,probes:probes.length,checked,rows},null,2)+'\n');
