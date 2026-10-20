import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {route,routeDsn,writeSes,checkDrc} from '../src/api.ts';
import {emptyLayout,makeSpacingTable} from '../src/layout/index.ts';

function fixture(){
 const l=emptyLayout('public-recovery');
 l.spacing=makeSpacingTable(['null','default'],1,[],()=>100);
 l.stack=[{id:0,name:'top',role:'signal',active:true,preferDir:null}];
 l.padForms=[{id:0,name:'pad',attachAllowed:true,perSheet:new Map([[0,[{kind:'disk',c:{x:0,y:0},r:100}]]])}];
 l.pads=[{x:0,y:0},{x:10000,y:0},{x:5000,y:0},{x:0,y:20000},{x:10000,y:20000}].map((at,id)=>({id,part:0,pinName:String(id),net:id<2?0:id===2?1:2,form:0,at,rotationDeg:0,side:'front' as const,sheets:[0],kind:1,hold:'locked' as const}));
 l.nets=[{id:0,name:'detour',group:0,pads:[0,1]},{id:1,name:'obstacle',group:0,pads:[2]},{id:2,name:'wide',group:1,pads:[3,4]}];
 const kinds={track:1,barrel:1,pin:1,smd:1,area:1};
 l.netGroups=[{id:0,name:'thin',nets:[0,1],trackWidth:200,kind:1,categoryKinds:kinds},{id:1,name:'wide',nets:[2],trackWidth:600,kind:1,categoryKinds:kinds}];return l;
}
const settings={maxPasses:0,optimizerEnabled:false,fanoutEnabled:false};
test('public recovery defaults off and reports actual inserted copper, completion and hooks',()=>{
 const off=fixture(),before=writeSes(off);const disabled=route(off,settings);
 expect(writeSes(off)).toBe(before);expect(disabled.incompleteAfter).toBe(2);
 const l=fixture(),events:unknown[]=[],logs:string[]=[];
 const report=route(l,{...settings,localRecovery:true},{onConnection:e=>events.push(e),onLog:(_level,message)=>logs.push(message)});
 expect(report.incompleteAfter).toBe(0);expect(report.stoppedBy).toBe('complete');
 expect(report.attempted).toBe(2);expect(report.completed).toBe(2);expect(report.added).toEqual({tracks:2,barrels:0});
 expect(report.perNet.map(n=>n.incomplete)).toEqual([0,0]);expect(events).toHaveLength(2);
 expect(logs.some(s=>s.includes('"status":"kept"'))).toBe(true);
 expect(checkDrc(l).counts.violations).toBe(0);expect(l.tracks.map(t=>t.width).sort()).toEqual([200,600]);
});
test('public recovery obeys remaining item cap, ignored nets and routing opt-out',()=>{
 const l=fixture(),r=route(l,{...settings,localRecovery:true,maxItems:1});
 expect(r.added).toEqual({tracks:1,barrels:0});expect(r.incompleteAfter).toBe(1);expect(r.stoppedBy).toBe('maxItems');
 const ignored=fixture(),skip=route(ignored,{...settings,localRecovery:true,ignoreNetGroups:['wide']});
 expect(skip.incompleteAfter).toBe(0);expect(ignored.tracks.map(t=>t.net)).toEqual([0]);
 const no=fixture(),before=writeSes(no);route(no,{...settings,localRecovery:true,routerEnabled:false});expect(writeSes(no)).toBe(before);
 const zero=fixture();expect(route(zero,{...settings,localRecovery:true,maxItems:0}).added.tracks).toBe(0);
});
test('public recovery observes hook cancellation before proposals and deadline after normal passes',()=>{
 const l=fixture(),before=writeSes(l),controller=new AbortController();
 const report=route(l,{...settings,localRecovery:true},{signal:controller.signal,onLog:()=>controller.abort()});
 expect(report.aborted).toBe(true);expect(report.stoppedBy).toBe('abort');expect(writeSes(l)).toBe(before);
 const timed=fixture(),deadline=route(timed,{...settings,localRecovery:true,timeBudgetMs:0});
 expect(deadline.timedOut).toBe(true);expect(deadline.stoppedBy).toBe('timeBudget');expect(timed.tracks).toEqual([]);
});
test('public opt-in closes the real all-net near-complete stall',()=>{
 const input=readFileSync(new URL('./data/near-complete-endpoint.dsn',import.meta.url),'utf8');
 const opts=JSON.parse(readFileSync(new URL('./data/near-complete-endpoint.json',import.meta.url),'utf8')).settings;
 const before=routeDsn(input,opts),after=routeDsn(input,{...opts,localRecovery:true});
 if(!before.ok||!after.ok)throw Error('parse');
 expect(before.report.incompleteAfter).toBe(6);expect(after.report.incompleteAfter).toBe(4);
 expect(after.report.added.tracks).toBe(before.report.added.tracks+2);expect(after.report.violationsAdded).toBe(0);
 expect(after.statsAfter.violations.total).toBe(0);expect(after.report.perNet.reduce((s,n)=>s+n.incomplete,0)).toBe(4);
},120000);
