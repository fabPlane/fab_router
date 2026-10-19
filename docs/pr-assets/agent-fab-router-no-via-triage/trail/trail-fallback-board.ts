import type { Layout } from '../../spec/types/layout.ts';
import { makeSpacingTable } from '../../src/layout/index.ts';

/** Four pads: a skewed connection between two neighbouring obstacle pads. LU = 0.1 µm. */
export function trailFallbackBoard(): Layout {
  const pads: Layout['pads'] = [
    { id: 10, part: 1, pinName: 'A', net: 0, form: 0, at: { x: 0, y: 0 }, rotationDeg: 0, side: 'front', sheets: [0], kind: 1, hold: 'locked' },
    { id: 11, part: 1, pinName: 'B', net: 0, form: 0, at: { x: -25100, y: -4000 }, rotationDeg: 0, side: 'front', sheets: [0], kind: 1, hold: 'locked' },
    { id: 12, part: 1, pinName: 'C', net: 1, form: 0, at: { x: 0, y: -8000 }, rotationDeg: 0, side: 'front', sheets: [0], kind: 1, hold: 'locked' },
    { id: 13, part: 1, pinName: 'D', net: 2, form: 0, at: { x: -25100, y: 4000 }, rotationDeg: 0, side: 'front', sheets: [0], kind: 1, hold: 'locked' },
  ];
  return {
    name: 'trail-fallback', frame: {luPerUnit: 1, offset: {x: 0, y: 0}, fileUnit: 'um', luPerUm: 10}, angleMode: '45',
    stack: [{id: 0, name: 'top', role: 'signal', active: true, preferDir: null}],
    padForms: [{id: 0, name: 'pad', attachAllowed: false, perSheet: new Map([[0, [{kind: 'box', box: {x0: -9000, y0: -1750, x1: 9000, y1: 1750}}]]])}],
    parts: [{id: 1, ref: 'J1', package: 'p', side: 'front', at: {x: 0, y: 0}, rotationDeg: 0}], pads,
    nets: [{id: 0, name: 'signal', group: 0, pads: [10,11]}, {id: 1, name: 'obstacle-a', group: 0, pads: [12]}, {id: 2, name: 'obstacle-b', group: 0, pads: [13]}],
    netGroups: [{id: 0, name: 'default', nets: [0,1,2], trackWidth: 2500, kind: 1, categoryKinds: {track: 1, barrel: 1, pin: 1, smd: 1, area: 1}}],
    spacing: makeSpacingTable(['', 'default'], 1, [], (a,b) => a && b ? 2002 : 0),
    rim: null, barrels: [], tracks: [], pours: [], fences: [], viaRules: [], pinEdgeToTurnLu: 0, warnings: [],
  };
}
