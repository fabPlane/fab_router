/** Keep the allocation-free DR-11 probe traversal equivalent to the original traversal. */
import { expect, test } from "bun:test";
import type { Rim } from "../spec/types/layout.ts";
import { coreOf, hullOf, pointInRing, withinRim, type ConvexShape, type Shape } from "../src/geom/index.ts";
import { mulberry32 } from "./helpers/synth.ts";

// Independent traversal oracle: materialise the valid rings, convex parts and probe lists.
function reference(rim: Rim, shapes: readonly Shape[]): boolean {
  const outline = rim.outline.length >= 3 ? rim.outline : undefined;
  const cutouts = rim.cutouts.filter((c) => c.length >= 3);
  if (!outline && cutouts.length === 0) return true;
  const parts: ConvexShape[] = [];
  for (const s of shapes) { if (s.kind === "pieces") parts.push(...s.parts); else parts.push(s); }
  for (const part of parts) {
    const core = coreOf(part);
    const probes = core.r > 0 ? core.pts.slice(0, 1) : core.pts;
    for (const p of probes) {
      if (outline && pointInRing(outline, p) === "outside") return false;
      for (const c of cutouts) if (pointInRing(c, p) === "inside") return false;
    }
  }
  return true;
}

const square = (a: number, b: number) => [{ x: a, y: a }, { x: b, y: a }, { x: b, y: b }, { x: a, y: b }];

test("withinRim preserves boundary, degenerate-ring and mixed-part decisions", () => {
  const rnd = mulberry32(119);
  const point = () => ({ x: Math.floor(rnd() * 241) - 120, y: Math.floor(rnd() * 241) - 120 });
  const rims: Rim[] = [
    { kind: 0, outline: [], cutouts: [] },
    { kind: 0, outline: [{ x: 0, y: 0 }], cutouts: [[], square(-30, 30).slice(0, 2)] },
    { kind: 0, outline: [], cutouts: [square(-30, 30)] },
    { kind: 0, outline: square(-100, 100), cutouts: [] },
    { kind: 0, outline: square(-100, 100).reverse(), cutouts: [square(-30, 30).reverse(), []] },
    { kind: 0, outline: [{ x: -100, y: -100 }, { x: 100, y: -100 }, { x: 0, y: 0 }, { x: 100, y: 100 }, { x: -100, y: 100 }], cutouts: [square(-60, -40), square(20, 30)] },
  ];
  const fixtures: Shape[][] = [[], [{ kind: "pieces", parts: [] }],
    [{ kind: "hull", pts: [] }], [{ kind: "rounded", pts: [], r: 5 }],
    [{ kind: "box", x0: -100, y0: -100, x1: 100, y1: 100 }],
    [{ kind: "disk", c: { x: -100, y: 0 }, r: 10 }],
    [{ kind: "capsule", a: { x: 0, y: 0 }, b: { x: 120, y: 0 }, r: 1 }],
    [{ kind: "capsule", a: { x: 0, y: 0 }, b: { x: 120, y: 0 }, r: 0 }],
  ];
  for (let i = 0; i < 1000; i++) {
    const a = point(), b = point(), pts = hullOf([point(), point(), point(), point()]);
    const parts: ConvexShape[] = [
      { kind: "disk", c: a, r: i % 7 }, { kind: "capsule", a, b: i % 2 ? b : a, r: i % 3 },
      { kind: "box", x0: a.x, y0: a.y, x1: b.x, y1: b.y },
      { kind: "hull", pts }, { kind: "rounded", pts, r: i % 5 },
    ];
    fixtures.push(parts, [{ kind: "pieces", parts }]);
    for (const part of parts) fixtures.push([part]);
  }
  for (const rim of rims) for (const shapes of fixtures) {
    expect(withinRim(rim, shapes)).toBe(reference(rim, shapes));
  }
});
