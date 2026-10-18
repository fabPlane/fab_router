import { shoveTerminalBoard, shoveWanted } from '../../../test/helpers/shove-terminal-board.ts';
import { buildLattice } from '../../../src/lattice/index.ts';
import { createJournal } from '../../../src/route/journal.ts';
import { resolveProfile } from '../../../src/route/profile.ts';
import { ignoreOf } from '../../../src/route/clear.ts';
import { DEFAULT_ROUTE_SETTINGS } from '../../../spec/types/settings.ts';
import { connectivity } from '../../../src/drc/index.ts';
import { checkDrc } from '../../../src/api.ts';
const { shoveClear } = await import(process.argv[2] || '../../../src/route/shove.ts');
const rows=[];
for(let repeat=1;repeat<=3;repeat++) for(const branch of [false,true]) {
 const L=shoveTerminalBoard(branch),lat=buildLattice(L),j=createJournal(L,lat);
 const before=structuredClone(L.tracks), beforeCounts=checkDrc(L).counts;
 const ok=shoveClear(L,lat,j,0,shoveWanted,resolveProfile(L,0,DEFAULT_ROUTE_SETTINGS),ignoreOf(0),{windowLu:80000,maxDepth:4,maxMoved:12});
 const c=connectivity(L,lat);
 rows.push({repeat,branch,ok,preserved:c.componentOf.get(10)===c.componentOf.get(12),beforeCounts,afterCounts:checkDrc(L).counts,before,after:L.tracks,pads:L.pads});
}
console.log(JSON.stringify(rows,null,2));
