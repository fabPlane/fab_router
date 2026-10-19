import {test,expect} from 'bun:test';
import {emptyLayout,makeSpacingTable} from '../src/layout/index.ts';
import {resolveSettings} from '../src/pipeline/index.ts';
import {checkDrc,requiredConnections,writeSes} from '../src/api.ts';
import {recoverRemaining} from '../docs/pr-assets/agent-fab-router-perf-local-rescue/recover-remaining.ts';
function fixture(){
 const l=emptyLayout('remaining');
 l.spacing=makeSpacingTable(['null','default'],1,[],()=>100);
 l.stack=[{id:0,name:'top',role:'signal',active:true,preferDir:null}];
 l.padForms=[{id:0,name:'pad',attachAllowed:true,perSheet:new Map([[0,[{kind:'disk',c:{x:0,y:0},r:100}]]])}];
 l.pads=[{x:0,y:0},{x:10000,y:0},{x:5000,y:0},{x:0,y:20000},{x:10000,y:20000}].map((at,id)=>({id,part:0,pinName:String(id),net:id<2?0:id===2?1:2,form:0,at,rotationDeg:0,side:'front' as const,sheets:[0],kind:1,hold:'locked' as const}));
 l.nets=[{id:0,name:'detour',group:0,pads:[0,1]},{id:1,name:'obstacle',group:0,pads:[2]},{id:2,name:'wide',group:1,pads:[3,4]}];
 const kinds={track:1,barrel:1,pin:1,smd:1,area:1};
 l.netGroups=[{id:0,name:'thin',nets:[0,1],trackWidth:200,kind:1,categoryKinds:kinds},{id:1,name:'wide',nets:[2],trackWidth:600,kind:1,categoryKinds:kinds}];
 return l;
}
test('remaining post-pass uses each actual net profile and preserves ignored obstacles',()=>{
 const l=fixture(),settings=resolveSettings({},undefined,l.angleMode),before=writeSes(l);
 expect(recoverRemaining(l,settings).status).toBe('disabled');expect(writeSes(l)).toBe(before);
 const result=recoverRemaining(l,settings,true);
 expect(result.status).toBe('finished');expect(result.targets.map(t=>t.pair.net).sort()).toEqual([0,2]);
 expect(result.targets.map(t=>t.status)).toEqual(['kept','kept']);
 expect(requiredConnections(l)).toEqual([]);expect(checkDrc(l).counts.violations).toBe(0);
 expect(l.tracks.map(t=>[t.net,t.width]).sort()).toEqual([[0,200],[2,600]]);
 expect(l.tracks.find(t=>t.net===0)!.pts.some(p=>p.y!==0)).toBe(true);
 const ignored=fixture();
 const skip=recoverRemaining(ignored,resolveSettings({ignoreNetGroups:['wide']},undefined,ignored.angleMode),true);
 expect(skip.targets.map(t=>t.pair.net)).toEqual([0]);expect(ignored.tracks.map(t=>t.net)).toEqual([0]);
 expect(requiredConnections(ignored).map(c=>c.net)).toEqual([2]);
});
test('remaining post-pass target cap leaves unattempted nets unchanged',()=>{
 const l=fixture(),settings=resolveSettings({},undefined,l.angleMode);
 const result=recoverRemaining(l,settings,true,1);
 expect(result.status).toBe('finished');expect(result.targets).toHaveLength(1);
 if(result.status!=='finished')throw Error('status');expect(result.truncated).toBe(true);
 expect(requiredConnections(l)).toHaveLength(1);expect(checkDrc(l).counts.violations).toBe(0);
});
test('optional copper corners discover a detour around routed foreign copper',()=>{
 const l=fixture();
 // Remove the foreign pad and second connection; the wall is routed copper.
 l.pads=l.pads.filter(p=>p.id<2);l.nets=l.nets.slice(0,1);
 l.tracks=[{id:10,net:1,sheet:0,pts:[{x:5000,y:-1000},{x:5000,y:1000}],width:200,kind:1,hold:'free',origin:'router'}];
 const settings=resolveSettings({},undefined,l.angleMode),before=writeSes(l);
 const padOnly=recoverRemaining(l,settings,true);expect(padOnly.targets.map(t=>t.status)).toEqual(['exhausted']);expect(writeSes(l)).toBe(before);
 const enriched=recoverRemaining(l,settings,true,16,true);expect(enriched.targets.map(t=>t.status)).toEqual(['kept']);
 expect(checkDrc(l).counts.violations).toBe(0);expect(requiredConnections(l)).toEqual([]);
 expect(l.tracks.find(t=>t.id===10)!.pts).toEqual([{x:5000,y:-1000},{x:5000,y:1000}]);
});

test('all-net recovery respects initial route deadline and abort without changing copper',()=>{
 const l=fixture(),settings=resolveSettings({},undefined,l.angleMode),before=writeSes(l);
 const controller=new AbortController();controller.abort();
 const aborted=recoverRemaining(l,settings,true,16,true,{signal:controller.signal});
 expect(aborted.status).toBe('aborted');expect(aborted.targets).toEqual([]);expect(writeSes(l)).toBe(before);
 const expired=recoverRemaining(l,settings,true,16,true,{deadline:performance.now()-1});
 expect(expired.status).toBe('deadline');expect(expired.targets).toEqual([]);expect(writeSes(l)).toBe(before);
 expect(()=>recoverRemaining(l,settings,true,16,true,{deadline:NaN})).toThrow('Invalid recovery deadline');
 // Opt-out does not inspect or validate the optional control.
 expect(recoverRemaining(l,settings,false,16,true,{deadline:NaN}).status).toBe('disabled');
});

test('completed boards return without building a recovery baseline',()=>{
 const l=fixture();l.pads=[];l.nets=[];
 const before=writeSes(l),result=recoverRemaining(l,resolveSettings({},undefined,l.angleMode),true);
 expect(result.status).toBe('finished');expect(result.targets).toEqual([]);expect(result.pending).toBe(0);
 expect(writeSes(l)).toBe(before);
});
