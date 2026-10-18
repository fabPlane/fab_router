import type { Layout, Pad, Track } from '../../spec/types/layout.ts';
import { makeSpacingTable } from '../../src/layout/index.ts';
export function shoveTerminalBoard(branch = false): Layout {
    const pads: Pad[] = [[10, -40000, -40000], [11, -40000, 40000], [12, branch ? 20000 : 0, 20000], [13, -40000, 20000]].map(([id, x, y]) => ({ id: id!, part: 1, pinName: String(id), net: 1, form: 100, at: { x: x!, y: y! }, rotationDeg: 0, side: 'front', sheets: [0], kind: 1, hold: 'locked' }));
    const tracks: Track[] = [{ id: 200, net: 1, sheet: 0, pts: [{ x: -40000, y: -40000 }, { x: 0, y: -40000 }, { x: 0, y: 40000 }, { x: -40000, y: 40000 }], width: 2000, kind: 1, hold: 'free', origin: 'file' }];
    if (branch)
        tracks.push({ id: 201, net: 1, sheet: 0, pts: [{ x: 0, y: 20000 }, { x: 20000, y: 20000 }], width: 2000, kind: 1, hold: 'held', origin: 'file' });
    return {
        name: 'shove-terminal', frame: { luPerUnit: 1, luPerUm: 10, fileUnit: 'um', offset: { x: 0, y: 0 } }, angleMode: 'any',
        stack: [{ id: 0, name: 'F.Cu', role: 'signal', active: true, preferDir: null }],
        padForms: [{ id: 100, name: 'terminal', attachAllowed: false, perSheet: new Map([[0, [{ kind: 'box', box: { x0: -1000, y0: -1000, x1: 1000, y1: 1000 } }]]]) }],
        parts: [{ id: 1, ref: 'J1', package: 'test', side: 'front', at: { x: 0, y: 0 }, rotationDeg: 0 }], pads, tracks, barrels: [], pours: [], fences: [],
        rim: { outline: [{ x: -80000, y: -80000 }, { x: 80000, y: -80000 }, { x: 80000, y: 80000 }, { x: -80000, y: 80000 }], cutouts: [], kind: 1 },
        nets: [{ id: 0, name: 'ACTIVE', group: 0, pads: [] }, { id: 1, name: 'OBSTACLE', group: 0, pads: pads.map(p => p.id) }],
        netGroups: [{ id: 0, name: 'default', nets: [0, 1], trackWidth: 2000, kind: 1, categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 } }],
        spacing: makeSpacingTable(['', 'default'], 1, [], (a, b) => a === 0 || b === 0 ? 0 : 1000), viaRules: [], pinEdgeToTurnLu: 0, warnings: [],
    };
}
export const shoveWanted = { a: { x: -20000, y: 0 }, b: { x: 20000, y: 0 } };
