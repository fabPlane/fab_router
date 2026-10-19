/** Retain exact before/after terminal-signature witnesses without changing gate sources. */
import { resolve, join } from 'node:path';
const prior = resolve(process.argv[2]!), out=resolve(process.argv[3]!);
// A disposable instrumented copy exposes only the existing comparison inventories.
const rules = await Bun.file('tools/kicad-board-rules.ts').text();
const needle='if (inventory(input) !== inventory(candidate)) throw new Error("Candidate source pads differ from input");';
if(rules.split(needle).length!==2) throw Error('Unexpected comparator source');
const temporary=join(out,'inventory.ts');
await Bun.write(temporary,rules.replace(needle,'return [JSON.parse(inventory(input)), JSON.parse(inventory(candidate))];'));
const {assertSourcePads}=await import(temporary);
const differences=[];
for(const row of await Bun.file(join(prior,'results.json')).json()) {
 const paths=Object.keys(row.source_hashes).filter(x=>x.endsWith('.kicad_pcb'));
 const [before,after]=assertSourcePads(await Bun.file(paths[0]!).text(),await Bun.file(paths[1]!).text());
 if(JSON.stringify(before)!==JSON.stringify(after)) differences.push({case:row.case,seed:row.seed,source_hashes:row.source_hashes,before:before.filter((x:string)=>!after.includes(x)).map((x:string)=>JSON.parse(x)),after:after.filter((x:string)=>!before.includes(x)).map((x:string)=>JSON.parse(x))});
}
await Bun.write(join(out,'pad-differences.json'),JSON.stringify(differences,null,2));
console.log(`${differences.length} changed candidate pad inventories`);
