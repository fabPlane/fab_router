import type { Layout, Pad, Track } from '../../spec/types/layout.ts';
import { makeSpacingTable } from '../../src/layout/index.ts';
export function endcapBoard(): Layout {
    const pads: Pad[] = [[10, 0, 0, 0, 100], [11, 40000, 0, 0, 100], [12, 0, 6500, 1, 101], [13, 0, -6500, 1, 101]].map(([id, x, y, net, form]) => ({ id: id!, part: 1, pinName: String(id), net: id! >= 12 ? null : net!, form: form!, at: { x: x!, y: y! }, rotationDeg: 0, side: 'front', sheets: [0], kind: 1, hold: 'locked' }));
    const tracks: Track[] = [];
    return {
        name: 'endcap-access', frame: { luPerUnit: 1, luPerUm: 10, fileUnit: 'um', offset: { x: 0, y: 0 } }, angleMode: 'any',
        stack: [{ id: 0, name: 'F.Cu', role: 'signal', active: true, preferDir: null }],
        padForms: [{ id: 100, name: 'terminal', attachAllowed: false, perSheet: new Map([[0, [{ kind: 'box', box: { x0: -7250, y0: -2250, x1: 7250, y1: 2250 } }]]]) }, { id: 101, name: 'neighbour', attachAllowed: false, perSheet: new Map([[0, [{ kind: 'box', box: { x0: -7250, y0: -2250, x1: 7250, y1: 2250 } }]]]) }],
        parts: [{ id: 1, ref: 'J1', package: 'test', side: 'front', at: { x: 0, y: 0 }, rotationDeg: 0 }], pads, tracks, barrels: [], pours: [], fences: [],
        rim: { outline: [{ x: -80000, y: -80000 }, { x: 80000, y: -80000 }, { x: 80000, y: 80000 }, { x: -80000, y: 80000 }], cutouts: [], kind: 1 },
        nets: [{ id: 0, name: 'POWER', group: 0, pads: [10, 11] }, { id: 1, name: 'OBSTACLE', group: 0, pads: [] }],
        netGroups: [{ id: 0, name: 'default', nets: [0, 1], trackWidth: 5000, kind: 1, categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 } }],
        spacing: makeSpacingTable(['', 'default'], 1, [], (a, b) => a === 0 || b === 0 ? 0 : 2000), viaRules: [], pinEdgeToTurnLu: 0, warnings: [],
    };
}
