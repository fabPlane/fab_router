/** Complete production replay with a diagnostic-only quilt observer. */
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const [source,input,out]=process.argv.slice(2);
if(!source||!input||!out)throw Error('SOURCE INPUT UNUSED_OUTPUT');
process.argv=[process.argv[0]!,process.argv[1]!,source,input,out];
await import('../point-components/profile.ts');
const census=(globalThis as any).__quiltCensus;
if(!census)throw Error('observer absent');
writeFileSync(resolve(out,'census.json'),JSON.stringify(census,null,2)+'\n');
