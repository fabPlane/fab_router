/** Real-board deletion fixture for the local recovery experiment. The default router currently
 * leaves 10→62 open. Pin legal progress and determinism, while allowing a future legal closure.
 * Removed pads are a diagnostic intervention, not proof of physical route feasibility.
 */
import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readDsn,route,requiredConnections,checkDrc,writeSes} from '../src/api.ts';
import type {RouteSettings} from '../spec/types/settings.ts';
const input=readFileSync(new URL('./data/near-complete-endpoint.dsn',import.meta.url),'utf8');
const fixture=JSON.parse(readFileSync(new URL('./data/near-complete-endpoint.json',import.meta.url),'utf8')) as {
 input_sha256:string;kept:number[];terminalIds:number[];settings:Partial<RouteSettings>;
};
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
test('near-complete endpoint context preserves legal progress and deterministic retained copper',()=>{
 expect(sha(input)).toBe(fixture.input_sha256);
 const fingerprints=[];
 for(let repeat=0;repeat<2;repeat++){
  const read=readDsn(input);if(!read.ok)throw Error('Fixture parse failed');const l=read.layout;
  l.pads=l.pads.filter(p=>fixture.kept.includes(p.id));
  l.nets=l.nets.map(n=>({...n,pads:n.pads.filter(id=>fixture.kept.includes(id))}));
  const groups=l.netGroups,offset=Math.max(...groups.map(g=>g.id))+1,target=4;
  l.netGroups=[...groups.map(g=>({...g,nets:g.nets.filter(n=>n===target)})),...groups.map(g=>({...g,id:g.id+offset,name:`isolation-ignore-${g.id}`,nets:g.nets.filter(n=>n!==target)}))];
  l.nets=l.nets.map(n=>n.id===target?n:{...n,group:n.group+offset});
  const settings={...fixture.settings,ignoreNetGroups:groups.map(g=>`isolation-ignore-${g.id}`)};
  const retained=JSON.stringify({pads:l.pads,tracks:l.tracks,barrels:l.barrels,pours:l.pours});
  expect(l.pads.filter(p=>p.net===target).map(p=>p.id)).toEqual(fixture.terminalIds);
  expect(requiredConnections(l).filter(c=>c.net===target)).toHaveLength(2);
  expect(checkDrc(l).counts.violations).toBe(0);
  const report=route(l,settings),left=requiredConnections(l).filter(c=>c.net===target);
  expect(report.aborted||report.timedOut).toBe(false);
  expect(report.violationsAdded).toBe(0);
  expect(checkDrc(l).counts.violations).toBe(0);
  expect(left.length).toBeLessThanOrEqual(1);
  // The short 9→10 branch must stay joined even if the longer connection stalls.
  expect(left.every(c=>c.from===10&&c.to===62)).toBe(true);
  expect(JSON.stringify({pads:l.pads,tracks:l.tracks.filter(t=>t.origin!=='router'),barrels:l.barrels.filter(b=>b.origin!=='router'),pours:l.pours})).toBe(retained);
  fingerprints.push(sha(writeSes(l)));
 }
 expect(fingerprints[0]).toBe(fingerprints[1]);
},30_000);
