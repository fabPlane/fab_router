import { expect, test } from 'bun:test';
import { board } from './helpers/prior-connectivity.ts';
import { checkDrc, requiredConnections } from '../src/api.ts';
import { connectivity } from '../src/drc/index.ts';
import { createCtx, routeConnection } from '../src/route/passes.ts';
import { resolveSettings } from '../src/pipeline/index.ts';

function fixture() {
  const base = board([{ net: 1, pts: [{ x: 0, y: -20_000 }, { x: 0, y: 20_000 }], hold: 'locked' }]);
  return { ...base,
    pours: [{ id: 300, net: 0, sheet: 0,
      outline: [{ x: 38_000, y: -2_000 }, { x: 42_000, y: -2_000 }, { x: 42_000, y: 2_000 }, { x: 38_000, y: 2_000 }],
      holes: [], kind: 1, hold: 'locked' as const, origin: 'prior' as const }],
    tracks: [...base.tracks, { id: 201, net: 0, sheet: 0,
      pts: [{ x: -20_000, y: 0 }, { x: -20_000, y: 80_000 }, { x: 40_000, y: 80_000 }, { x: 40_000, y: 0 }],
      width: 4_000, kind: 1, hold: 'free' as const, origin: 'file' as const }],
  };
}

for (const reverse of [false, true]) {
  test(`prior attachment uses live connectivity after rip-up (reverse=${reverse})`, () => {
    const layout = fixture();
    const retained = layout.tracks[0]!;
    const pours = structuredClone(layout.pours);
    expect(checkDrc(layout).counts.violations).toBe(0);
    const ctx = createCtx(layout, resolveSettings({ viasAllowed: false, optimizerEnabled: false }, undefined, layout.angleMode));
    // Model an earlier connection in the pass ripping the bridge to Prior copper.
    ctx.conn = connectivity(layout, ctx.lattice);
    ctx.journal.remove(201);
    const mark = ctx.journal.mark();
    const connection = requiredConnections(layout)[0]!;
    expect(routeConnection(ctx, reverse ? { ...connection, from: connection.to, to: connection.from } : connection)).toBe(true);
    expect(requiredConnections(layout)).toHaveLength(0);
    expect(checkDrc(layout).counts.violations).toBe(0);
    expect(layout.tracks.find(t => t.id === retained.id)).toEqual(retained);
    expect(layout.pours).toEqual(pours);
    expect(layout.barrels).toHaveLength(0);
    ctx.journal.rewind(mark);
    expect(requiredConnections(layout)).toHaveLength(1);
    expect(layout.tracks).toEqual([retained]);
    expect(connectivity(layout, ctx.lattice).componentOf.get(10)).not.toBe(connectivity(layout, ctx.lattice).componentOf.get(11));
  });
}

test('prior attachment preserves an existing bridge and joins the other terminal', () => {
  const layout = fixture();
  const original = structuredClone(layout.tracks);
  const ctx = createCtx(layout, resolveSettings({ viasAllowed: false, optimizerEnabled: false }, undefined, layout.angleMode));
  ctx.conn = connectivity(layout, ctx.lattice);
  expect(routeConnection(ctx, requiredConnections(layout)[0]!)).toBe(true);
  expect(requiredConnections(layout)).toHaveLength(0);
  expect(checkDrc(layout).counts.violations).toBe(0);
  for (const track of original) expect(layout.tracks.find(t => t.id === track.id)).toEqual(track);
});
