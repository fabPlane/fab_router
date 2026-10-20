import {test,expect} from 'bun:test';
import {emptyLayout,makeSpacingTable} from '../src/layout/index.ts';
import {resolveSettings} from '../src/pipeline/index.ts';
import {checkDrc,requiredConnections,writeSes} from '../src/api.ts';
import {recoverRemaining} from '../src/route/recover-remaining.ts';
import {recoveryEndpoint} from '../src/route/recovery-endpoint.ts';

function fixture(){
 const l=emptyLayout('barrel-stall');
 l.spacing=makeSpacingTable(['null','default'],1,[],()=>100);
 l.stack=[0,1,2].map(id=>({id,name:`sheet-${id}`,role:'signal' as const,active:true,preferDir:null}));
 l.padForms=[{id:0,name:'round',attachAllowed:true,perSheet:new Map([0,1,2].map(id=>[id,[{kind:'disk' as const,c:{x:0,y:0},r:300}]])),drill:{diameter:200,fromSheet:0,toSheet:2}}];
 l.pads=[{id:0,part:0,pinName:'0',net:0,form:0,at:{x:0,y:0},rotationDeg:0,side:'front' as const,sheets:[0],kind:1,hold:'locked' as const}];
 l.barrels=[{id:1,net:0,at:{x:10000,y:0},form:0,fromSheet:0,toSheet:1,kind:1,hold:'locked' as const,origin:'file' as const}];
 l.pads=[...l.pads,{...l.pads[0]!,id:2,pinName:'2',at:{x:12000,y:0},sheets:[1]}];
 l.tracks=[{id:3,net:0,sheet:1,pts:[{x:10000,y:0},{x:12000,y:0}],width:200,kind:1,hold:'locked',origin:'file'}];
 l.nets=[{id:0,name:'target',group:0,pads:[0,2]}];
 l.netGroups=[{id:0,name:'default',nets:[0],trackWidth:200,kind:1,categoryKinds:{track:1,barrel:1,pin:1,smd:1,area:1}}];
 return l;
}

test('remaining recovery closes a pad-to-barrel stall without changing retained copper',()=>{
 const sessions=[];
 for(let repeat=0;repeat<3;repeat++){
  const l=fixture(),retained=JSON.stringify(l.barrels),settings=resolveSettings({},undefined,l.angleMode);
  expect(requiredConnections(l).map(c=>[c.from,c.to])).toEqual([[0,1]]);
  const result=recoverRemaining(l,settings,true);
  expect(result.targets.map(t=>t.status)).toEqual(['kept']);
  expect(requiredConnections(l)).toEqual([]);expect(checkDrc(l).counts.violations).toBe(0);
  expect(JSON.stringify(l.barrels)).toBe(retained);expect(l.tracks.filter(t=>t.origin==='router').map(t=>t.sheet)).toEqual([0]);
  sessions.push(writeSes(l));
 }
 expect(new Set(sessions).size).toBe(1);
});

test('barrel point anchors respect net identity and physical copper span',()=>{
 const l=fixture();
 expect(recoveryEndpoint(l,1,0)?.sheets).toEqual([0,1]);
 expect(recoveryEndpoint(l,1,1)).toBeUndefined();expect(recoveryEndpoint(l,999,0)).toBeUndefined();
 // Pad is on sheet 2, outside the barrel span despite form copper on sheet 2.
 l.pads=l.pads.map(p=>p.id===0?{...p,sheets:[2]}:p);
 const before=writeSes(l),result=recoverRemaining(l,resolveSettings({},undefined,l.angleMode),true);
 expect(result.targets.map(t=>t.status)).toEqual(['exhausted']);expect(writeSes(l)).toBe(before);
 expect(requiredConnections(l)).toHaveLength(1);expect(checkDrc(l).counts.violations).toBe(0);
});
