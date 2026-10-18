import { expect, test } from 'bun:test';
import { buildLattice } from '../src/lattice/index.ts';
import { createJournal } from '../src/route/journal.ts';
import { nudgeClear } from '../src/route/nudge.ts';
import { resolveProfile } from '../src/route/profile.ts';
import { ignoreOf, sweepClear } from '../src/route/clear.ts';
import { DEFAULT_ROUTE_SETTINGS } from '../spec/types/settings.ts';
import { checkDrc } from '../src/api.ts';
import { connectivity } from '../src/drc/index.ts';
import { nudgeTerminalBoard, nudgeWanted } from './helpers/nudge-terminal-board.ts';
for (const branch of [false, true])
    test(`nudge rejects terminal exchange through ${branch ? 'a held branch' : 'an interior pad'} and restores the live index`, () => {
        const L = nudgeTerminalBoard(branch), lat = buildLattice(L), j = createJournal(L, lat);
        const before = structuredClone([...L.tracks]), initial = checkDrc(L).counts;
        const mark = j.mark();
        const profile = resolveProfile(L, 0, DEFAULT_ROUTE_SETTINGS);
        expect(nudgeClear(L, lat, j, 0, nudgeWanted, profile, ignoreOf(0), (net, sheet, from, to) => {
            j.addTrack({ net, sheet, pts: [from, to], width: 2000, kind: 1, hold: 'free' });
            // This replacement is clear and keeps the endpoints AND total open count,
            // but exchanges connected terminal 12 for previously isolated terminal 13.
            expect(checkDrc(L).counts).toEqual(initial);
            const c = connectivity(L, lat);
            expect(c.componentOf.get(10)).not.toBe(c.componentOf.get(12));
            return true;
        })).toBe(false);
        expect([...L.tracks].sort((a, b) => a.id - b.id)).toEqual(before);
        expect(j.mark()).toBe(mark);
        expect(lat.itemOf(200)).toBeDefined();
        expect(checkDrc(L).counts).toEqual(initial);
        expect(sweepClear(L, lat, 0, nudgeWanted, profile, ignoreOf(0)).ok).toBe(false);
    });
test('nudge accepts a clear replacement retaining every previously connected terminal', () => {
    const L = nudgeTerminalBoard(), lat = buildLattice(L), j = createJournal(L, lat);
    const profile = resolveProfile(L, 0, DEFAULT_ROUTE_SETTINGS);
    expect(nudgeClear(L, lat, j, 0, nudgeWanted, profile, ignoreOf(0), (net, sheet, from, to) => {
        j.addTrack({ net, sheet, pts: [from, { x: 40000, y: -40000 }, { x: 40000, y: 40000 }, { x: 0, y: 20000 }, to], width: 2000, kind: 1, hold: 'free' });
        return true;
    })).toBe(true);
    const c = connectivity(L, lat);
    expect(c.componentOf.get(10)).toBe(c.componentOf.get(12));
    expect(sweepClear(L, lat, 0, nudgeWanted, profile, ignoreOf(0)).ok).toBe(true);
    expect(checkDrc(L).counts.violations).toBe(0);
});
