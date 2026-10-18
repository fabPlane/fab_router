import { expect, test } from "bun:test";
import { route, checkDrc } from "../src/api.ts";
import { fanoutBoard } from "./helpers/fanout-budget.ts";

for (const cap of [0, 1, 2, 3, 4]) test(`fanout respects item cap ${cap} atomically`, () => {
  const L = fanoutBoard();
  const r = route(L, { fanoutEnabled: true, routerEnabled: false, optimizerEnabled: false, fanoutMaxItems: cap });
  expect(L.tracks.length + L.barrels.length).toBeLessThanOrEqual(cap);
  expect(L.tracks.length).toBe(L.barrels.length);
  expect(r.added.tracks).toBe(L.tracks.length);
  expect(r.added.barrels).toBe(L.barrels.length);
  expect(checkDrc(L).counts.violations).toBe(0);
  if (cap >= 2) expect(L.barrels.length).toBeGreaterThan(0);
});

test("one-item budget still permits a via attached directly to a pad", () => {
  const L = fanoutBoard(true);
  route(L, { fanoutEnabled: true, routerEnabled: false, optimizerEnabled: false, fanoutMaxItems: 1 });
  expect(L.barrels.length).toBe(1);
  expect(L.tracks.length).toBe(0);
  expect(checkDrc(L).counts.violations).toBe(0);
});
