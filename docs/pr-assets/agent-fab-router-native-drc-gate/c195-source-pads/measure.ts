/** Audit all retained candidate pairs, including strict source-pad preflight failures. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { checkNativeBoards } from '../../../../tools/native-drc-gate.ts';
import { assertSourcePads } from '../../../../tools/kicad-board-rules.ts';
const prior = resolve(process.argv[2]!), out = resolve(process.argv[3]!);
await mkdir(out);
const rows = [];
const hash = (bytes: Buffer) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
for (const row of await Bun.file(join(prior,'results.json')).json()) {
 const paths = Object.keys(row.source_hashes).filter(x=>x.endsWith('.kicad_pcb'));
 for (const [path, expected] of Object.entries(row.source_hashes)) {
  if(hash(await readFile(path)) !== expected) throw Error(`Source changed: ${path}`);
 }
 let preflightError: string | null = null;
 try { assertSourcePads(await Bun.file(paths[0]!).text(),await Bun.file(paths[1]!).text()); }
 catch (error) { preflightError = String(error); }
 let accepted = false, nativeChecks = 0;
 if (preflightError) {
  try { await checkNativeBoards(paths[0]!,paths[1]!); throw Error('Expected source-pad rejection'); }
  catch (error) { if(String(error)!==preflightError) throw error; }
 } else {
  const result=await checkNativeBoards(paths[0]!,paths[1]!); nativeChecks=2; accepted=result.accepted;
  if(result.newErrors.length!==row.new_errors || result.opensAfter!==row.opens_after) throw Error('Native counts changed');
  await writeFile(join(out,`${rows.length}.json`),JSON.stringify(result,null,2));
 }
 for (const [path, expected] of Object.entries(row.source_hashes)) if(hash(await readFile(path))!==expected) throw Error('Source mutated');
 rows.push({...row, before_accepted:row.accepted, accepted, preflightError, nativeChecks});
 await writeFile(join(out,'results.json'),JSON.stringify(rows,null,2));
 console.log(rows.length,row.case,row.seed,preflightError ?? `native accepted=${accepted}`);
}
if(rows.length!==78) throw Error('Incomplete suite');
const summary={cases:26,candidates:78,beforeAccepted:rows.filter(r=>r.before_accepted).length,afterAccepted:rows.filter(r=>r.accepted).length,padRejected:rows.filter(r=>r.preflightError).length,nativeChecks:rows.reduce((a,r)=>a+r.nativeChecks,0),routerRerun:false};
await writeFile(join(out,'summary.json'),JSON.stringify(summary,null,2));console.log(summary);
