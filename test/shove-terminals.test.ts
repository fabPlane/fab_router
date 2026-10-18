import { expect, test } from 'bun:test';
import { buildLattice } from '../src/lattice/index.ts';
import { createJournal } from '../src/route/journal.ts';
import { shoveClear } from '../src/route/shove.ts';
import { resolveProfile } from '../src/route/profile.ts';
import { ignoreOf, sweepClear } from '../src/route/clear.ts';
import { DEFAULT_ROUTE_SETTINGS } from '../spec/types/settings.ts';
import { checkDrc } from '../src/api.ts';
import { connectivity } from '../src/drc/index.ts';
import { shoveTerminalBoard, shoveWanted } from './helpers/shove-terminal-board.ts';
for (const branch of [false, true]) test(`shove preserves ${branch ? 'held branch' : 'interior pad'} terminals or rolls back`, () => {
    const L = shoveTerminalBoard(branch), lat = buildLattice(L), j = createJournal(L, lat);
    const before = structuredClone([...L.tracks]), initial = checkDrc(L).counts;
    const mark = j.mark(), profile = resolveProfile(L, 0, DEFAULT_ROUTE_SETTINGS);
    expect(shoveClear(L, lat, j, 0, shoveWanted, profile, ignoreOf(0), {windowLu:80000, maxDepth:4, maxMoved:12})).toBe(false);
    expect([...L.tracks].sort((a,b) => a.id-b.id)).toEqual(before);
    expect(j.mark()).toBe(mark);
    expect(lat.itemOf(200)).toBeDefined();
    const c = connectivity(L, lat);
    expect(c.componentOf.get(10)).toBe(c.componentOf.get(12));
    expect(checkDrc(L).counts).toEqual(initial);
    expect(sweepClear(L, lat, 0, shoveWanted, profile, ignoreOf(0)).ok).toBe(false);
});

for (const origin of ['file', 'prior'] as const) test(`shove ${origin === 'prior' ? 'may detach a prior helper pour' : 'preserves an interior pour terminal'}`, () => {
    const L = shoveTerminalBoard();
    L.pads = L.pads.filter(p => p.id !== 12);
    L.nets.find(n => n.id === 1)!.pads = L.pads.map(p => p.id);
    L.pours = [{ id: 300, net: 1, sheet: 0, kind: 1, hold: 'locked', origin,
        outline: [{ x: -1000, y: 19000 }, { x: 1000, y: 19000 }, { x: 1000, y: 21000 }, { x: -1000, y: 21000 }], holes: [] }];
    const lat = buildLattice(L), j = createJournal(L, lat);
    const initial = structuredClone([...L.tracks]), mark = j.mark();
    const profile = resolveProfile(L, 0, DEFAULT_ROUTE_SETTINGS);
    const before = connectivity(L, lat);
    expect(before.componentOf.get(300)).toBe(before.componentOf.get(10));
    expect(checkDrc(L).counts.violations).toBe(0);
    const accepted = shoveClear(L, lat, j, 0, shoveWanted, profile, ignoreOf(0), {windowLu:80000, maxDepth:4, maxMoved:12});
    expect(accepted).toBe(origin === 'prior');
    const after = connectivity(L, lat);
    expect(after.componentOf.get(10)).toBe(after.componentOf.get(11));
    expect(checkDrc(L).counts.violations).toBe(0);
    expect(sweepClear(L, lat, 0, shoveWanted, profile, ignoreOf(0)).ok).toBe(accepted);
    if (origin === 'file') {
        expect(after.componentOf.get(300)).toBe(after.componentOf.get(10));
        expect([...L.tracks].sort((a,b) => a.id-b.id)).toEqual(initial);
        expect(j.mark()).toBe(mark);
        expect(lat.itemOf(200)).toBeDefined();
    } else {
        expect(after.componentOf.get(300)).not.toBe(after.componentOf.get(10));
        j.addTrack({ net: 0, sheet: 0, pts: [shoveWanted.a, shoveWanted.b], width: profile.width, kind: profile.trackKind, hold: 'free' });
        expect(checkDrc(L).counts.violations).toBe(0);
        j.rewind(mark);
        expect([...L.tracks].sort((a,b) => a.id-b.id)).toEqual(initial);
        expect(j.mark()).toBe(mark);
        expect(connectivity(L, lat).componentOf.get(300)).toBe(connectivity(L, lat).componentOf.get(10));
    }
});
