import { expect, test } from 'bun:test';
import { fixture } from './helpers/prior-target.ts';
import { checkDrc, requiredConnections } from '../src/api.ts';
import { connectivity } from '../src/drc/index.ts';
import { createCtx, routeConnection } from '../src/route/passes.ts';
import { resolveSettings } from '../src/pipeline/index.ts';


for (const concave of [false, true]) for (const reverse of [false, true]) {
  test(`prior target outside filled copper cannot falsely complete attachment (concave=${concave}, reverse=${reverse})`, () => {
    const layout = fixture(concave);
    const preserved = structuredClone({ pads: layout.pads, tracks: layout.tracks, pours: layout.pours });
    expect(checkDrc(layout).counts.violations).toBe(0);
    expect(requiredConnections(layout)).toHaveLength(1);
    const ctx = createCtx(layout, resolveSettings({ viasAllowed: false, optimizerEnabled: false }, undefined, layout.angleMode));
    ctx.conn = connectivity(layout, ctx.lattice);
    const connection = requiredConnections(layout)[0]!;
    expect(routeConnection(ctx, reverse ? { ...connection, from: connection.to, to: connection.from } : connection)).toBe(true);
    expect(requiredConnections(layout)).toHaveLength(0);
    expect(checkDrc(layout).counts.violations).toBe(0);
    expect(layout.pads).toEqual(preserved.pads);
    expect(layout.pours).toEqual(preserved.pours);
    for (const track of preserved.tracks) expect(layout.tracks.find(t => t.id === track.id)).toEqual(track);
    expect(layout.barrels).toHaveLength(0);
    ctx.journal.rewind(0);
    expect(layout.tracks).toEqual(preserved.tracks);
    expect(requiredConnections(layout)).toHaveLength(1);
  });
}

for (const reverse of [false, true]) {
  test(`both terminals attach atomically to a Prior-only region (reverse=${reverse})`, () => {
    const layout = fixture();
    layout.pads[0]!.at = { x: -10_000, y: 0 };
    layout.pads[1]!.at = { x: 10_000, y: 0 };
    layout.pads[2]!.at = { x: 0, y: -20_000 };
    layout.pads[3]!.at = { x: 0, y: 20_000 };
    layout.tracks[0]!.pts = [layout.pads[2]!.at, layout.pads[3]!.at];
    const originalTracks = structuredClone(layout.tracks);
    expect(checkDrc(layout).counts.violations).toBe(0);
    const ctx = createCtx(layout, resolveSettings({ viasAllowed: false, optimizerEnabled: false }, undefined, layout.angleMode));
    ctx.conn = connectivity(layout, ctx.lattice);
    const connection = requiredConnections(layout)[0]!;
    const regionComponent = ctx.conn.componentOf.get(300);
    expect(regionComponent).toBeDefined();
    expect(regionComponent).not.toBe(ctx.conn.componentOf.get(connection.from));
    expect(regionComponent).not.toBe(ctx.conn.componentOf.get(connection.to));
    expect(routeConnection(ctx, reverse ? { ...connection, from: connection.to, to: connection.from } : connection)).toBe(true);
    expect(requiredConnections(layout)).toHaveLength(0);
    expect(checkDrc(layout).counts.violations).toBe(0);
    expect(layout.barrels).toHaveLength(0);
    const routed = connectivity(layout, ctx.lattice);
    expect(routed.componentOf.get(connection.from)).toBe(routed.componentOf.get(300));
    expect(routed.componentOf.get(connection.to)).toBe(routed.componentOf.get(300));
    ctx.journal.rewind(0);
    expect(layout.tracks).toEqual(originalTracks);
    expect(requiredConnections(layout)).toHaveLength(1);
  });
}
