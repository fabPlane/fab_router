import { expect, test } from "bun:test";
import { aStarLayered, DIRS_4, type LayeredOptions, type LayeredSpace } from "../src/route/search.ts";

// The actual terminal is off grid. Its rounded cell (2, 0) cannot attach to it;
// the approach through (2, 1) can. A cheap path to the rounded cell must not stop
// the search before it explores that other approach.
const space: LayeredSpace = {
  step: 100,
  layers: 2,
  pointOf: (gx, gy) => ({ x: gx * 100, y: gy * 100 }),
  nodeFree: () => true,
  edgeCost: () => ({ blocked: false, extra: 0, rip: [] }),
  viaMove: () => ({ extra: 10, rip: [] }),
};
const options: LayeredOptions = {
  starts: [{ layer: 0, gx: 0, gy: 0 }],
  goalCell: { gx: 2, gy: 0 },
  goalLayers: [0, 1],
  region: { gx0: 0, gy0: 0, gx1: 3, gy1: 2 },
  dirs: DIRS_4,
  stepCost: () => 1,
  minCost: 1,
  bendCost: 0,
  viaFloor: 10,
  maxPops: 1000,
};

test("layered search continues past a rounded goal with a blocked terminal attachment", () => {
  const result = aStarLayered(space, { ...options,
    reachGoal: (layer, gx, gy) => layer === 1 && gx === 2 && gy === 1,
  });
  expect(result.ok).toBe(true);
  expect(result.path.at(-1)).toMatchObject({ layer: 1, pt: { x: 200, y: 100 } });
  expect(result.path.some((step) => step.via)).toBe(true);
});

test("layered search fails when no goal cell can attach to the actual terminal", () => {
  const result = aStarLayered(space, { ...options, reachGoal: () => false });
  expect(result.ok).toBe(false);
  expect(result.path).toEqual([]);
});

test("a clear rounded-goal attachment still finishes at that cell", () => {
  const result = aStarLayered(space, { ...options, reachGoal: (_layer, gx, gy) => gx === 2 && gy === 0 });
  expect(result.ok).toBe(true);
  expect(result.path.at(-1)).toMatchObject({ layer: 0, pt: { x: 200, y: 0 } });
});

test("callers without an attachment predicate keep exact grid-goal behavior", () => {
  const result = aStarLayered(space, options);
  expect(result.ok).toBe(true);
  expect(result.path.at(-1)).toMatchObject({ layer: 0, pt: { x: 200, y: 0 } });
});
