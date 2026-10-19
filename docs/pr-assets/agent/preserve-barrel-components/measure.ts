/** Run from repo root: bun PATH/measure.ts SOURCE DSN PCB OUT. Requires stock pcbnew and kicad-cli. */
import {resolve,join,extname} from 'node:path';
import {mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const [source,dsnPath,pcbPath,outPath]=process.argv.slice(2).map(p=>resolve(p));
assert(source && dsnPath && pcbPath && outPath);
const api=await import(join(source,'src/api.ts'));
const dsn=await Bun.file(dsnPath).text();
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function command(args:string[]){const r=Bun.spawnSync(args,{stdout:'pipe',stderr:'pipe'});assert.equal(r.exitCode,0,r.stderr.toString());}
const rows=[];
for(let repeat=1;repeat<=3;repeat++){
 const dir=join(outPath,`run-${repeat}`);mkdirSync(dir,{recursive:true});
 const read=api.readDsn(dsn);assert(read.ok);const start=performance.now();const report=api.route(read.layout);const route_s=(performance.now()-start)/1000;
 const ses=api.writeSes(read.layout);const session=join(dir,'routed.ses');const board=join(dir,'routed.kicad_pcb');await Bun.write(session,ses);
 command(['/usr/bin/python3','-c','import pcbnew,sys; b=pcbnew.LoadBoard(sys.argv[1]); assert pcbnew.ImportSpecctraSES(b,sys.argv[2]); pcbnew.SaveBoard(sys.argv[3],b)',pcbPath,session,board]);
 for(const suffix of ['.kicad_pro','.kicad_dru']){const side=pcbPath.slice(0,-extname(pcbPath).length)+suffix;if(existsSync(side))copyFileSync(side,join(dir,'routed'+suffix));}
 const drc=join(dir,'drc.rpt');command(['/usr/bin/kicad-cli','pcb','drc','--severity-all','--format','report','-o',drc,board]);
 rows.push({repeat,route_s,session_sha256:hash(ses),tracks:read.layout.tracks.length,barrels:read.layout.barrels.length,report});
}
await Bun.write(join(outPath,'routing.json'),JSON.stringify({dsn_sha256:hash(dsn),pcb_sha256:hash(await Bun.file(pcbPath).text()),rows},null,2)+'\n');
