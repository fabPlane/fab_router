import { expect, test } from "bun:test";
import { aStar, DIRS_4, type SearchOptions, type SearchSpace } from "../src/route/search.ts";

const space: SearchSpace = {
  step: 1,
  pointOf: (x, y) => ({ x, y }),
  nodeFree: () => true,
  edgeCost: () => ({ blocked: false, extra: 0, rip: [] }),
};
const options: SearchOptions = {
  start: { gx: 0, gy: 0 }, goal: { gx: 0, gy: 1 },
  region: { gx0: 0, gy0: 0, gx1: 2, gy1: 2 },
  dirs: DIRS_4, stepCost: () => 1, minCost: 1, bendCost: 0, maxPops: 100,
};

for (const start of [{ gx: 3, gy: 0 }, { gx: -1, gy: 1 }, { gx: 0, gy: -1 }, { gx: 0, gy: 3 }]) {
  test(`single-sheet search rejects out-of-region start ${JSON.stringify(start)}`, () => {
    const result = aStar(space, { ...options, start });
    expect(result.ok).toBe(false);
    expect(result.path).toEqual([]);
    expect(result.pops).toBe(0);
  });
}

test("single-sheet search rejects a goal outside its inclusive region", () => {
  expect(aStar(space, { ...options, goal: { gx: 3, gy: 0 } })).toMatchObject({ ok: false, path: [], pops: 0 });
});

test("inclusive boundary endpoints keep their exact coordinates", () => {
  const result = aStar(space, { ...options, start: { gx: 2, gy: 0 }, goal: { gx: 0, gy: 2 } });
  expect(result.ok).toBe(true);
  expect(result.path[0]).toEqual({ x: 2, y: 0 });
  expect(result.path.at(-1)).toEqual({ x: 0, y: 2 });
  expect(result.path.every(p => p.x >= 0 && p.x <= 2 && p.y >= 0 && p.y <= 2)).toBe(true);
});
