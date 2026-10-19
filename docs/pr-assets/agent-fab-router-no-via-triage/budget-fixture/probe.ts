// Engine-only finite-grid diagnostic. No production changes or routing safety claim.
import { aStar, DIRS_8, type SearchSpace } from '../../../../src/route/search.ts';
import { strict as assert } from 'node:assert';
const size = 30, wall = 15;
const free = (x: number, y: number) => x !== wall || y === size - 1;
const space: SearchSpace = {
  step: 1, pointOf: (x, y) => ({ x, y }), nodeFree: free,
  edgeCost: (_a, b) => ({ blocked: !free(b.x, b.y), extra: 0, rip: [] }),
};
const options = {
  start: { gx: 14, gy: 0 }, goal: { gx: 16, gy: 0 },
  region: { gx0: 0, gy0: 0, gx1: 29, gy1: 29 },
  dirs: DIRS_8, stepCost: () => 1, minCost: 1, bendCost: 10,
  // Same formula as the driver's hard single-layer rung on this 900-cell grid.
  maxPops: Math.max(4000, size * size),
};
// Independent cell flood with exactly the same node/edge predicates and bounds.
const queue = [{ x: 14, y: 0 }], seen = new Set(['14,0']);
for (let head = 0; head < queue.length; head++) {
  const p = queue[head]!;
  for (const [dx, dy] of DIRS_8) {
    const x = p.x + dx, y = p.y + dy, key = `${x},${y}`;
    if (x < 0 || y < 0 || x >= size || y >= size || seen.has(key) || !free(x, y)) continue;
    seen.add(key); queue.push({ x, y });
  }
}
assert(seen.has('16,0'));
assert.equal(seen.size, 871);
const runs = [];
for (let repeat = 1; repeat <= 3; repeat++) {
  const limited = aStar(space, options);
  const expanded = aStar(space, { ...options, maxPops: options.maxPops * 8 });
  assert.equal(limited.ok, false); assert.equal(limited.pops, 4001); assert.equal(limited.aborted, false);
  assert.equal(expanded.ok, true); assert.equal(expanded.pops, 4437); assert.equal(expanded.aborted, false);
  assert.deepEqual(expanded.path[0], { x: 14, y: 0 });
  assert.deepEqual(expanded.path.at(-1), { x: 16, y: 0 });
  assert.equal(expanded.path.length, 61);
  assert(expanded.path.some(p => p.x === wall && p.y === 29));
  for (let i = 0; i < expanded.path.length; i++) {
    const p = expanded.path[i]!;
    assert(p.x >= 0 && p.y >= 0 && p.x < size && p.y < size && free(p.x, p.y));
    if (i) {
      const before = expanded.path[i - 1]!;
      assert(DIRS_8.some(([dx, dy]) => p.x - before.x === dx && p.y - before.y === dy));
      assert.equal(space.edgeCost(before, p).blocked, false);
    }
  }
  runs.push({ repeat, limited, expanded });
}
console.log(JSON.stringify({ size, wall, options: { ...options, stepCost: undefined }, reachableCells: seen.size, runs }, null, 2));
