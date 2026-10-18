import { expect, test } from "bun:test";
import { coreOf, dist2Pts, type Shape } from "../src/geom/index.ts";
import { closerThan, overlaps } from "../src/route/clear.ts";

// The original core-view comparison remains the oracle, including degenerate capsules.
function original(a: Shape, b: Shape, required: number, touching: boolean): boolean {
  if (a.kind === "pieces") return a.parts.some(p => original(p, b, required, touching));
  if (b.kind === "pieces") return b.parts.some(p => original(a, p, required, touching));
  const ca = coreOf(a), cb = coreOf(b);
  const need = required + ca.r + cb.r;
  const d2 = dist2Pts(ca.pts, cb.pts);
  return touching ? d2 <= need * need : d2 < need * need;
}

test("capsule clearance preserves strict boundaries, endpoint order, degeneracy and fallback", () => {
  let state = 731;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
  const point = () => ({ x: next() % 20001 - 10000, y: next() % 20001 - 10000 });
  const capsule = (i: number): Shape => {
    const a = point(), b = i % 7 === 0 ? { ...a } : point();
    return { kind: "capsule", a, b, r: next() % 100 };
  };
  const check = (a: Shape, b: Shape, required: number) => {
    expect(closerThan(a, b, required)).toBe(required > 0 && original(a, b, required, false));
    expect(overlaps(a, b)).toBe(original(a, b, 0, true));
    expect(closerThan(b, a, required)).toBe(required > 0 && original(b, a, required, false));
    expect(overlaps(b, a)).toBe(original(b, a, 0, true));
  };
  for (let i = 0; i < 10000; i++) {
    const a = capsule(i), b = capsule(i + 1);
    check(a, b, next() % 201 - 1);
    if (i % 100 === 0) {
      check(a, { kind: "disk", c: point(), r: next() % 100 }, 50);
      check(a, { kind: "box", x0: -100, y0: -100, x1: 100, y1: 100 }, 50);
      check({ kind: "pieces", parts: [a as Exclude<Shape, {kind: "pieces"}>] }, b, 50);
    }
  }
  for (const offset of [0, 33553000, -33553000]) {
    const a: Shape = { kind: "capsule", a: {x: offset, y: offset}, b: {x: offset + 1000, y: offset}, r: 10 };
    for (const y of [0, 19, 20, 21, 29, 30, 31]) {
      const b: Shape = { kind: "capsule", a: {x: offset + 1000, y: offset + y}, b: {x: offset, y: offset + y}, r: 10 };
      for (const required of [-1, 0, 1, 9, 10, 11]) check(a, b, required);
    }
  }
});
