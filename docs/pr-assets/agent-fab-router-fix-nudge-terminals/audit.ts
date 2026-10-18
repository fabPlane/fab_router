/** Run from the repository root: bun run docs/pr-assets/agent-fab-router-fix-nudge-terminals/audit.ts [source-root] */
import { resolve } from 'node:path';
import { nudgeTerminalBoard, nudgeWanted } from '../../../test/helpers/nudge-terminal-board.ts';
import { buildLattice } from '../../../src/lattice/index.ts';
import { createJournal } from '../../../src/route/journal.ts';
import { resolveProfile } from '../../../src/route/profile.ts';
import { ignoreOf } from '../../../src/route/clear.ts';
import { DEFAULT_ROUTE_SETTINGS } from '../../../spec/types/settings.ts';
import { connectivity } from '../../../src/drc/index.ts';
import { checkDrc } from '../../../src/api.ts';
const root = resolve(process.argv[2] ?? '.');
const { nudgeClear } = await import(root + '/src/route/nudge.ts');
const results = [];
for (const branch of [false, true])
    for (let repeat = 1; repeat <= 3; repeat++) {
        const L = nudgeTerminalBoard(branch), lat = buildLattice(L), j = createJournal(L, lat);
        const before = structuredClone(L.tracks);
        const accepted = nudgeClear(L, lat, j, 0, nudgeWanted, resolveProfile(L, 0, DEFAULT_ROUTE_SETTINGS), ignoreOf(0), (net: number | null, sheet: number, from: {
            x: number;
            y: number;
        }, to: {
            x: number;
            y: number;
        }) => {
            j.addTrack({ net, sheet, pts: [from, to], width: 2000, kind: 1, hold: 'free' });
            return true;
        });
        const c = connectivity(L, lat);
        results.push({ branch, repeat, accepted, terminalPreserved: c.componentOf.get(10) === c.componentOf.get(12), drc: checkDrc(L).counts, before, after: L.tracks, pads: L.pads, wanted: nudgeWanted });
    }
console.log(JSON.stringify(results, null, 2));
