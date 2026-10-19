/** Geometry-only drawing input; coordinates remain in original LU. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {readDsn} from '../../../src/api.ts';
import {padShapesOn} from '../../../src/lattice/shapes.ts';
const out=process.argv[2];if(!out||existsSync(out))throw Error('Expected UNUSED_OUTPUT');
const r=readDsn(readFileSync(new URL('../../../test/data/near-complete-endpoint.dsn',import.meta.url),'utf8'));if(!r.ok)throw Error('parse');
const f=JSON.parse(readFileSync(new URL('../../../test/data/near-complete-endpoint.json',import.meta.url),'utf8')) as {kept:number[]};
writeFileSync(out,JSON.stringify({luPerUm:r.layout.frame.luPerUm,pads:r.layout.pads.filter(p=>f.kept.includes(p.id)).map(p=>({id:p.id,at:p.at,net:p.net,shapes:padShapesOn(r.layout,p,1)}))},null,2)+'\n');
