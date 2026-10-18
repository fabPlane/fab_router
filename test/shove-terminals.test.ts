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
import { makeSpacingTable } from '../src/layout/index.ts';
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

for (const interior of [true, false]) test(`shove ${interior ? 'preserves an interior via connection to a back pad' : 'allows a safe endpoint via connection'}`, () => {
    const L = shoveTerminalBoard();
    const viaAt = { x: interior ? 0 : -40000, y: interior ? 20000 : 40000 };
    L.stack = [...L.stack, { id: 1, name: 'B.Cu', role: 'signal', active: true, preferDir: null }];
    L.spacing = makeSpacingTable(['', 'default'], 2, [], (a, b) => a === 0 || b === 0 ? 0 : 1000);
    const box = { kind: 'box' as const, box: { x0: -1000, y0: -1000, x1: 1000, y1: 1000 } };
    L.padForms = [...L.padForms,
        { id: 101, name: 'back-pad', attachAllowed: false, perSheet: new Map([[1, [box]]]) },
        { id: 102, name: 'through-via', attachAllowed: false,
            perSheet: new Map([[0, [box]], [1, [box]]]), drill: { diameter: 1000, fromSheet: 0, toSheet: 1 } },
    ];
    L.pads = L.pads.map(p => p.id === 12 ? {
        ...p, at: { x: 20000, y: viaAt.y }, side: 'back', sheets: [1], form: 101,
    } : p);
    L.barrels = [{ id: 300, net: 1, at: viaAt, form: 102, fromSheet: 0, toSheet: 1, kind: 1, hold: 'locked', origin: 'file' }];
    L.tracks = [...L.tracks, { id: 201, net: 1, sheet: 1,
        pts: [viaAt, { x: 20000, y: viaAt.y }], width: 2000, kind: 1, hold: 'held', origin: 'file' }];
    const lat = buildLattice(L), j = createJournal(L, lat);
    const tracks = structuredClone([...L.tracks]), barrels = structuredClone([...L.barrels]);
    const mark = j.mark(), profile = resolveProfile(L, 0, DEFAULT_ROUTE_SETTINGS);
    const assertConnected = () => {
        // Compare the live index with a fresh one: rollback must restore both views.
        for (const index of [lat, buildLattice(L)]) {
            const c = connectivity(L, index);
            expect(c.componentOf.get(10)).toBeDefined();
            for (const id of [11, 12, 200, 201, 300])
                expect(c.componentOf.get(id)).toBe(c.componentOf.get(10));
        }
    };
    assertConnected();
    expect(checkDrc(L).counts.violations).toBe(0);
    const accepted = shoveClear(L, lat, j, 0, shoveWanted, profile, ignoreOf(0), {windowLu:80000, maxDepth:4, maxMoved:12});
    expect(accepted).toBe(!interior);
    // Successful moves replace the free track id, so validate pad/via membership separately.
    for (const index of [lat, buildLattice(L)]) {
        const c = connectivity(L, index);
        for (const id of [11, 12, 201, 300])
            expect(c.componentOf.get(id)).toBe(c.componentOf.get(10));
    }
    expect([...L.barrels]).toEqual(barrels);
    expect(L.tracks.find(t => t.id === 201)).toEqual(tracks.find(t => t.id === 201));
    expect(sweepClear(L, lat, 0, shoveWanted, profile, ignoreOf(0)).ok).toBe(accepted);
    if (!accepted) {
        expect([...L.tracks].sort((a,b) => a.id-b.id)).toEqual(tracks);
        expect(j.mark()).toBe(mark);
    }
    if (accepted) {
        j.addTrack({ net: 0, sheet: 0, pts: [shoveWanted.a, shoveWanted.b], width: profile.width, kind: profile.trackKind, hold: 'free' });
    }
    expect(checkDrc(L).counts.violations).toBe(0);
    j.rewind(mark);
    expect([...L.tracks].sort((a,b) => a.id-b.id)).toEqual(tracks);
    expect([...L.barrels]).toEqual(barrels);
    expect(j.mark()).toBe(mark);
    assertConnected();
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
