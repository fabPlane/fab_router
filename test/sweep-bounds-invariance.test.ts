import { expect, test } from "bun:test";
import { dop8OfPts, dop8OfSeg, type Pt } from "../src/geom/index.ts";

test("two-endpoint sweep bounds preserve all eight slabs and signed zeros", () => {
  const points: Pt[] = [];
  for (const x of [-(2 ** 25), -1, -0, 0, 1, 2 ** 25]) {
    for (const y of [-(2 ** 25), -1, -0, 0, 1, 2 ** 25]) points.push({ x, y });
  }
  const check = (a: Pt, b: Pt, r: number) => {
    const expected = dop8OfPts([a, b], r), actual = dop8OfSeg(a, b, r);
    for (const field of ["x0", "x1", "y0", "y1", "s0", "s1", "d0", "d1"] as const) {
      expect(Object.is(actual[field], expected[field])).toBe(true);
    }
  };
  for (const a of points) for (const b of points) {
    for (const r of [0, -0, 0.1, 0.5, 1, Math.SQRT2, 1024.25]) check(a, b, r);
  }
  let seed = 0x41324;
  const next = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  for (let i = 0; i < 10000; i++) {
    const a = { x: (next() % 2 ** 26) - 2 ** 25, y: (next() % 2 ** 26) - 2 ** 25 };
    const b = i % 4 === 0 ? a : { x: (next() % 2 ** 26) - 2 ** 25, y: (next() % 2 ** 26) - 2 ** 25 };
    check(a, b, (next() % 100000) / 8);
    check(b, a, (next() % 100000) / 8);
  }
});
