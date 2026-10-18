import type { Layout, Pt } from '../../spec/types/layout.ts';
import { makeSpacingTable } from '../../src/layout/index.ts';

function rect(x0: number, y0: number, x1: number, y1: number): Pt[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}
export function planeBoard(mode: 'under-pad' | 'distant' | 'hole'): Layout {
  const disk = { kind: 'disk' as const, c: { x: 0, y: 0 }, r: 3000 };
  return {
    name: 'plane-contact', frame: { luPerUnit: 1, luPerUm: 10, fileUnit: 'um', offset: { x: 0, y: 0 } }, angleMode: 'any',
    stack: [{ id: 0, name: 'F.Cu', role: 'signal', active: true, preferDir: null }, { id: 1, name: 'In1.Cu', role: 'plane', active: true, preferDir: null, planeNet: 0 }],
    padForms: [{ id: 100, name: 'smd', attachAllowed: false, perSheet: new Map([[0, [disk]]]) }, { id: 101, name: 'via', attachAllowed: true, perSheet: new Map([[0, [disk]], [1, [disk]]]), drill: { diameter: 2000, fromSheet: 0, toSheet: 1 } }],
    parts: [{ id: 1, ref: 'U1', package: 'test', at: { x: 0, y: 0 }, side: 'front', rotationDeg: 0 }],
    pads: [{ id: 10, part: 1, pinName: '1', net: 0, form: 100, at: { x: 0, y: 0 }, side: 'front', rotationDeg: 0, sheets: [0], kind: 1, hold: 'locked' }],
    barrels: [], tracks: [], fences: [],
    pours: [{ id: 20, net: 0, sheet: 1, outline: mode === 'distant' ? rect(30000, -10000, 50000, 10000) : rect(-50000, -50000, 50000, 50000), holes: mode === 'hole' ? [rect(-25000, -25000, 25000, 25000)] : [], kind: 1, hold: 'locked' }],
    rim: { outline: rect(-80000, -80000, 80000, 80000), cutouts: [], kind: 1 },
    nets: [{ id: 0, name: 'GND', group: 0, pads: [10] }],
    netGroups: [{ id: 0, name: 'default', nets: [0], trackWidth: 2000, kind: 1, categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 } }],
    spacing: makeSpacingTable(['', 'default'], 2, [], () => 1000),
    viaRules: [{ id: 0, name: 'default', forms: [101], entries: [{ form: 101, kind: 1, attach: true }] }], pinEdgeToTurnLu: 0, warnings: [],
  };
}

export function reachablePlane(hole: boolean) {
  const layout = planeBoard(hole ? 'hole' : 'distant');
  const rect = [{ x: -9000, y: -9000 }, { x: 9000, y: -9000 }, { x: 9000, y: 9000 }, { x: -9000, y: 9000 }];
  if (hole) layout.pours[0]!.holes = [rect];
  else layout.pours[0]!.outline = [{ x: 9000, y: -10000 }, { x: 50000, y: -10000 }, { x: 50000, y: 10000 }, { x: 9000, y: 10000 }];
  return layout;
}
