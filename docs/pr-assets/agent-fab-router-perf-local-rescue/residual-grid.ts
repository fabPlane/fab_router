/** Replay a genuine native stall and identify its final residual connection keys.
 * bun residual-grid.ts CONTROL_SOURCE NATIVE_WORK UNUSED_OUTPUT
 */
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [source,work,output]=process.argv.slice(2);
if(!source || !work || !output || existsSync(output)) throw new Error('Expected CONTROL_SOURCE NATIVE_WORK UNUSED_OUTPUT');
const api=await import(pathToFileURL(resolve(source,'src/api.ts')).href);
const original=JSON.parse(readFileSync(resolve(work,'router-summary.json'),'utf8'));
const input=readFileSync(resolve(work,'board.dsn'),'utf8');
const loaded=api.readDsn(input);
if(!loaded.ok) throw new Error('DSN failed');
const report=api.route(loaded.layout,original.settings);
const ses=api.writeSes(loaded.layout);
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
if(sha(ses)!==sha(readFileSync(resolve(work,'board.ses'),'utf8'))) throw new Error('Replay SES differs');
const connections=api.requiredConnections(loaded.layout).map((c:any)=>({
  ...c,key:`${c.net}:${c.from}:${c.to}`,
  netName:loaded.layout.nets.find((n:any)=>n.id===c.net)?.name,
}));
writeFileSync(output,JSON.stringify({scope:'Final engine residuals from exact native-session replay; no rescue or new native check',input_sha256:sha(input),ses_sha256:sha(ses),settings:original.settings,report,connections},null,2)+'\n');
