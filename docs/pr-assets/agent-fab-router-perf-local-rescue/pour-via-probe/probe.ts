/** Offline local via experiment; never imported by the production router. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readDsn,applySes,requiredConnections,checkDrc,writeSes} from '../../../../src/api.ts';
import {buildLattice} from '../../../../src/lattice/index.ts';
import {createJournal} from '../../../../src/route/journal.ts';
import {resolveSettings} from '../../../../src/pipeline/index.ts';
import {resolveProfile} from '../../../../src/route/profile.ts';
import {barrelFits,ignoreOf} from '../../../../src/route/clear.ts';
import {tryRecoveryTransaction} from '../../../../src/route/recovery-transaction.ts';
import {boxOfPts} from '../../../../src/geom/index.ts';
const [dsnPath,sesPath,manifestPath,out]=process.argv.slice(2);if(!dsnPath||!sesPath||!manifestPath||!out)throw Error('probe.ts DSN SES MANIFEST OUT');
mkdirSync(out,{recursive:true});
const dsn=readFileSync(dsnPath,'utf8'),ses=readFileSync(sesPath,'utf8'),sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const rules=JSON.parse(readFileSync(manifestPath,'utf8')).native_rules;
for(const key of ['min_copper_edge_clearance','min_hole_clearance'])if(!Number.isFinite(rules[key])||rules[key]<0)throw Error('Missing trusted rule '+key);
const rows=[];
for(let repeat=1;repeat<=3;repeat++){
 const parsed=readDsn(dsn);if(!parsed.ok)throw Error('parse');const l=parsed.layout;if(!applySes(l,ses).ok)throw Error('session');
 const lattice=buildLattice(l),journal=createJournal(l,lattice),settings=resolveSettings({copperToEdgeClearanceUm:rules.min_copper_edge_clearance*1000,holeClearanceUm:rules.min_hole_clearance*1000,fanoutEnabled:false,neckWidthUm:0},undefined,l.angleMode);
 const pending=requiredConnections(l),pair=pending.find(p=>l.pours.some(q=>q.id===p.from)&&l.pours.some(q=>q.id===p.to));
 if(!pair)throw Error('No pour-to-pour residual');
 const a=l.pours.find(p=>p.id===pair.from)!,b=l.pours.find(p=>p.id===pair.to)!,profile=resolveProfile(l,pair.net,settings);
 const ba=boxOfPts(a.outline),bb=boxOfPts(b.outline),overlap={x0:Math.max(ba.x0,bb.x0),y0:Math.max(ba.y0,bb.y0),x1:Math.min(ba.x1,bb.x1),y1:Math.min(ba.y1,bb.y1)};
 if(overlap.x0>overlap.x1||overlap.y0>overlap.y1)throw Error('No XY overlap');
 const centre={x:Math.round((overlap.x0+overlap.x1)/2),y:Math.round((overlap.y0+overlap.y1)/2)},pitch=profile.width+profile.maxSpacing;
 const region={x0:centre.x-16*pitch,y0:centre.y-16*pitch,x1:centre.x+16*pitch,y1:centre.y+16*pitch};
 if(checkDrc(l).counts.violations)throw Error('Dirty baseline');
 const fixed=JSON.stringify([l.pads,l.pours,l.fences,l.tracks,l.barrels]),beforeExact=checkDrc(l).counts,beforeSes=writeSes(l);
 writeFileSync(`${out}/before-${repeat}.ses`,beforeSes);
 const trials:any[]=[],start=performance.now(),deadline=start+15000;let selected:any;
 outer:for(let radius=0;radius<=15;radius++)for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++){
  if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
  const at={x:centre.x+dx*pitch,y:centre.y+dy*pitch};
  for(const candidate of profile.barrelForms){
   if(trials.length>=100000||performance.now()>=deadline)break outer;
   const fit=barrelFits(l,lattice,at,candidate,profile,ignoreOf(pair.net));
   const row:any={at,candidate,fit};trials.push(row);
   if(!fit.ok)continue;
   const saved=writeSes(l),count=l.barrels.length;
   row.outcome=tryRecoveryTransaction(l,lattice,journal,pair,()=>{journal.addBarrel({net:pair.net,at,form:candidate.form,fromSheet:candidate.fromSheet,toSheet:candidate.toSheet,kind:candidate.kind,hold:'free'});},region,()=>{if(performance.now()>=deadline)throw Error('deadline');});
   if(row.outcome==='kept'){selected={...row,barrel:l.barrels.at(-1)};break outer;}
   if(writeSes(l)!==saved||l.barrels.length!==count)throw Error('Failed trial did not rewind');
  }
 }
 if(JSON.stringify([l.pads,l.pours,l.fences,l.tracks,selected?l.barrels.slice(0,-1):l.barrels])!==fixed)throw Error('Retained geometry changed');
 const finalSes=writeSes(l);writeFileSync(`${out}/after-${repeat}.ses`,finalSes);
 rows.push({repeat,pair,settings,profile,overlap,centre,pitch,region,beforeExact,afterExact:checkDrc(l).counts,beforePending:pending,afterPending:requiredConnections(l),seconds:(performance.now()-start)/1000,trials,selected: selected??null,beforeSesSha256:sha(beforeSes),afterSesSha256:sha(finalSes)});
 console.log(repeat,trials.length,selected?.outcome,checkDrc(l).counts);
}
if(new Set(rows.map(r=>r.afterSesSha256)).size!==1)throw Error('Nondeterministic output');
writeFileSync(`${out}/probe.json`,JSON.stringify({scope:'Offline residual experiment; NOT a full routing benchmark or production change',dsnSha256:sha(dsn),sesSha256:sha(ses),rows},null,2)+'\n');
