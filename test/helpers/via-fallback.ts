import { synthLayout } from './synth.ts';
export function viaFallbackBoard(sheet = 0) {
  const layout = synthLayout({ parts: 0, tracks: 0, barrels: 0 });
  layout.stack = layout.stack.map(({ planeNet, ...s }) => ({ ...s, role: 'signal' as const }));
  layout.fences = []; layout.pours = []; layout.tracks = []; layout.barrels = [];
  layout.parts = [{ id: 1, ref: 'U1', package: 'test', side: 'front', at: { x: 0, y: 0 }, rotationDeg: 0 }];
  layout.padForms = [...layout.padForms, { id: 100, name: 'terminal', attachAllowed: true,
    perSheet: new Map([[sheet, [{ kind: 'disk' as const, c: { x: 0, y: 0 }, r: 5000 }]]]) }];
  layout.pads = [{ id: 10, part: 1, pinName: '1', net: 0, form: 100, at: { x: 0, y: 0 }, rotationDeg: 0, side: 'front', sheets: [sheet], kind: 1, hold: 'locked' }];
  layout.nets = [{ id: 0, name: 'SIG', group: 0, pads: [10] }];
  layout.netGroups = [{ id: 0, name: 'default', nets: [0], trackWidth: 2000, kind: 1,
    categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 }, viaRule: 0 }];
  layout.viaRules = [{ id: 0, name: 'through', forms: [4], entries: [{ form: 4, kind: 1, attach: true }] }];
  return layout;
}

export function blockedFirstViaBoard() {
  const layout = viaFallbackBoard();
  // A narrow barrel keepout corridor admits the second via but excludes the first.
  layout.padForms = [...layout.padForms, { id: 101, name: 'wide-via', attachAllowed: true,
    drill: { diameter: 3000, fromSheet: 0, toSheet: 3 },
    perSheet: new Map(layout.stack.map(s => [s.id, [{ kind: 'disk' as const, c: { x: 0, y: 0 }, r: 6000 }]])) }];
  layout.fences = [
    { id: 200, sheet: 0, scope: 'barrel', shape: { kind: 'box', box: { x0: 7000, y0: -100000, x1: 100000, y1: 100000 } }, kind: 1 },
    { id: 201, sheet: 0, scope: 'barrel', shape: { kind: 'box', box: { x0: -100000, y0: -100000, x1: -7000, y1: 100000 } }, kind: 1 },
  ];
  // A bottom-layer terminal region makes the missing escape an actual open.
  layout.pours = [{ id: 11, net: 0, sheet: 3, kind: 1, hold: 'locked', holes: [],
    outline: [{ x: -5000, y: -5000 }, { x: 5000, y: -5000 }, { x: 5000, y: 5000 }, { x: -5000, y: 5000 }] }];
  layout.viaRules = [{ id: 0, name: 'ordered', forms: [101, 4], entries: [
    { form: 101, kind: 1, attach: true }, { form: 4, kind: 1, attach: true }] }];
  return layout;
}
