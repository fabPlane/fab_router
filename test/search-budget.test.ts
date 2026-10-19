import { test, expect } from "bun:test";
import { aStar, aStarLayered, DIRS_8, type SearchSpace } from "../src/route/search.ts";

// The wall forces a detour. Improved paths leave obsolete entries in the heap;
// these must not consume the budget for expanding current best states.
const free = (x: number, y: number) => x !== 15 || y === 29;
const space: SearchSpace = {
  step: 1, pointOf: (x, y) => ({ x, y }), nodeFree: free,
  edgeCost: (_a, b) => ({ blocked: !free(b.x, b.y), extra: 0, rip: [] }),
};
const options = {
  start: { gx: 14, gy: 0 }, goal: { gx: 16, gy: 0 },
  region: { gx0: 0, gy0: 0, gx1: 29, gy1: 29 },
  dirs: DIRS_8, stepCost: () => 1, minCost: 1, bendCost: 10, maxPops: 4000,
};
function search(layered: boolean, extra: { maxPops?: number; signal?: AbortSignal; deadline?: number } = {}) {
  if (!layered) return aStar(space, { ...options, ...extra });
  const result = aStarLayered({ ...space, layers: 1,
    nodeFree: (_layer, x, y) => free(x, y),
    edgeCost: (_layer, a, b) => space.edgeCost(a, b), viaMove: () => null,
  }, { ...options, starts: [{ layer: 0, ...options.start }], goalCell: options.goal,
    goalLayers: [0], viaFloor: 0, ...extra });
  return { ...result, path: result.path.map(step => step.pt) };
}
for (const layered of [false, true]) {
  const name = layered ? "layered" : "single layer";
  test(`${name}: obsolete heap entries leave room for a reachable detour`, () => {
    const reference = search(layered, { maxPops: 32000 });
    expect(reference.ok).toBe(true);
    const result = search(layered);
    expect(result.ok).toBe(true);
    expect(result.path).toEqual(reference.path);
    expect(result.path[0]).toEqual({ x: 14, y: 0 });
    expect(result.path.at(-1)).toEqual({ x: 16, y: 0 });
    expect(result.path.some(p => p.x === 15 && p.y === 29)).toBe(true);
    for (const point of result.path) expect(free(point.x, point.y)).toBe(true);
  });
  test(`${name}: expansion budget still stops search`, () => {
    expect(search(layered, { maxPops: 1 }).ok).toBe(false);
    expect(search(layered, { maxPops: 0 }).ok).toBe(false);
  });
  test(`${name}: cancellation and expired deadlines still stop search`, () => {
    const controller = new AbortController(); controller.abort();
    expect(search(layered, { signal: controller.signal }).aborted).toBe(true);
    const expired = search(layered, { deadline: Date.now() - 1 });
    expect(expired.ok).toBe(false);
    expect(expired.pops).toBe(0);
  });
}
