import { expect, test } from "bun:test";
import { onSeg, orient, pointInConvex, pointInRing } from "../src/geom/predicates.ts";
import type { Pt } from "../src/geom/types.ts";
function reference(pts: readonly Pt[], p: Pt) {
  if (pts.length < 3) return pointInConvex(pts, p);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[j]!, b = pts[i]!;
    if (onSeg(p, a, b)) return "boundary";
    if ((a.y > p.y) !== (b.y > p.y)) {
      const o = orient(a, b, p);
      if (b.y > a.y ? o > 0 : o < 0) inside = !inside;
    }
  }
  return inside ? "inside" : "outside";
}
test("ring interval rejection preserves exact boundary and crossing decisions", () => {
  let seed = 8743;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) % 41 - 20; };
  const rings: Pt[][] = [[], [{x:0,y:0}], [{x:-2,y:0},{x:2,y:0}],
    [{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:2,y:2},{x:0,y:4}]];
  for (let i = 0; i < 200; i++) rings.push(Array.from({length: 3 + i % 15}, () => ({x:rand(), y:rand()})));
  for (const ring of rings) for (const scale of [1, 1000000]) {
    const scaled = ring.map(p => ({x:p.x*scale,y:p.y*scale}));
    const probes = [...scaled];
    for (let i = 0; i < 500; i++) probes.push({x:rand()*scale,y:rand()*scale});
    for (const p of probes) expect(pointInRing(scaled,p)).toBe(reference(scaled,p));
  }
});
