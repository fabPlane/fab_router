import type { Track } from "../spec/types/layout.ts";
import { expect, test } from "bun:test";
import { checkDrc, readDsn, route } from "../src/api.ts";
import { outerRings, rimBounds } from "../src/geom/index.ts";
import { buildLattice, rimLegCount } from "../src/lattice/index.ts";
import { ignoreOf, sweepClear } from "../src/route/clear.ts";
import { resolveProfile } from "../src/route/profile.ts";
import { resolveSettings } from "../src/pipeline/index.ts";

// Two disjoint board islands; only the second has a connection to route. Coordinates in um.
const dsn = `(pcb islands (resolution um 10) (unit um)
  (structure (layer F.Cu (type signal))
    (boundary (path pcb 0 0 0 10000 0 10000 10000 0 10000 0 0)
              (path pcb 0 20000 0 30000 0 30000 10000 20000 10000 20000 0)
              (path pcb 0 24000 4000 26000 4000 26000 6000 24000 6000 24000 4000))
    (rule (width 250) (clearance 200)))
  (placement (component pad (place A 22000 5000 front 0) (place B 28000 5000 front 0)))
  (library (image pad (pin smd 1 0 0)) (padstack smd (shape (circle F.Cu 1000))))
  (network (net signal (pins A-1 B-1))))`;

function fixture() {
  const read = readDsn(dsn);
  if (!read.ok) throw new Error(read.error.message);
  return read.layout;
}

for (const detailedRouter of ["off", "lineprobe", "tiles"] as const) test(`routes around a cut-out on the second disjoint outer ring (${detailedRouter})`, () => {
  const layout = fixture();
  const report = route(layout, { viasAllowed: false, maxPasses: 3, detailedRouter });
  expect(report.incompleteBefore).toBe(1);
  expect(report.incompleteAfter).toBe(0);
  expect(report.violationsAdded).toBe(0);
  expect(layout.tracks.length).toBeGreaterThan(0);
  expect(checkDrc(layout).counts.violations).toBe(0);
});

test("indexes every outer edge and keeps clearance to the second island boundary", () => {
  const layout = fixture(), lattice = buildLattice(layout);
  expect(rimLegCount(layout.rim!)).toBe(12);
  const profile = resolveProfile(layout, 0, resolveSettings(undefined, undefined, layout.angleMode));
  const clear = (x: number, y: number) => sweepClear(layout, lattice, 0,
    { a: { x, y }, b: { x: x + 1000, y } }, profile, ignoreOf(0));
  expect(clear(220000, 20000).ok).toBe(true);
  // Centre is inside, but copper is too close to this island's left edge.
  expect(clear(200100, 20000).ok).toBe(false);
  expect(clear(190000, 20000).ok).toBe(false); // gap between the islands
  expect(clear(245000, 50000).ok).toBe(false); // cut-out
  expect(clear(50000, 50000).ok).toBe(true); // first island still works
  // Endpoints in different islands cannot bridge the off-board gap.
  expect(sweepClear(layout, lattice, 0, { a: { x: 50000, y: 20000 }, b: { x: 220000, y: 20000 } },
    profile, ignoreOf(0)).ok).toBe(false);
});

test("DRC accepts second-island copper and rejects off-board or edge-crossing copper", () => {
  for (const [x, y, expected] of [[220000, 20000, 0], [200100, 20000, 1], [190000, 20000, 1], [245000, 50000, 1]]) {
    const layout = fixture();
    (layout.tracks as Track[]).push({ id: 999, net: 0, sheet: 0, pts: [{ x: x!, y: y! }, { x: x! + 1000, y: y! }],
      width: 2500, kind: layout.pads[0]!.kind, hold: "free", origin: "router" });
    expect(checkDrc(layout).counts.violations).toBe(expected!);
  }
});


test("bounds include all islands and legacy single-outline Layouts retain their behavior", () => {
  const rim = fixture().rim!;
  expect(rimBounds(rim)).toEqual({ x0: 0, y0: 0, x1: 300000, y1: 100000 });
  const legacy = { outline: rim.outline, cutouts: [], kind: rim.kind };
  expect(outerRings(legacy)).toEqual([rim.outline]);
  expect(rimBounds(legacy)).toEqual({ x0: 0, y0: 0, x1: 100000, y1: 100000 });
  expect(rimBounds({ ...legacy, outline: [{ x: 1, y: 1 }] })).toBeUndefined();
});
