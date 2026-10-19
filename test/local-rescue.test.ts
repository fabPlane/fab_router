import { expect, test } from "bun:test";
import { DEFAULT_ROUTE_SETTINGS } from "../spec/types/settings.ts";
import { board, fixture } from "./fixtures/local-rescue.ts";
import { checkDrc, connectivity } from "../src/drc/index.ts";
import { buildLattice } from "../src/lattice/index.ts";
import { createCtx } from "../src/route/passes.ts";
import { runLocalRescue } from "../src/route/local-rescue.ts";
const settings = { ...DEFAULT_ROUTE_SETTINGS, localRescue: true, optimizerEnabled: false, viasAllowed: false };
test("local rescue repairs a partial board and preserves its rerouted neighbour", () => {
  const L = fixture();
  expect(checkDrc(L).counts).toEqual({violations:0,incompletes:1});
  const logs: string[] = [];
  runLocalRescue(createCtx(L, settings, {onLog: (_, message) => logs.push(message)}));
  expect(checkDrc(L).counts).toEqual({violations:0,incompletes:0});
  expect(logs.some(x => x.includes("closed"))).toBe(true);
  expect(L.tracks.every(t => t.width === 4000)).toBe(true);
});
test("failed local trials restore all original copper and lattice connectivity", () => {
  const L = board([{net:1,pts:[{x:0,y:-95000},{x:0,y:95000}]}]);
  L.tracks[0]!.origin = "router";
  const before = JSON.stringify(L.tracks);
  const ctx = createCtx(L, settings);
  const stats = ctx.journal.stats();
  runLocalRescue(ctx);
  expect(ctx.journal.stats()).toEqual(stats);
  expect(connectivity(L, ctx.lattice).joins).toEqual(connectivity(L, buildLattice(L)).joins);
  expect(JSON.stringify(L.tracks)).toBe(before);
  expect(checkDrc(L).counts).toEqual({violations:0,incompletes:1});
});
for (const mode of ["off", "held", "file", "ignored", "abort", "deadline", "item-cap"] as const) {
  test(`local rescue honours ${mode}`, () => {
    const L = fixture();
    if (mode === "held") L.tracks[0]!.hold = "held";
    if (mode === "file") L.tracks[0]!.origin = "file";
    // Ignoring the group also ignores the target, so no mutation is permitted.
    const controller = new AbortController();
    if (mode === "abort") controller.abort();
    const ctx = createCtx(L, {...settings, ...(mode === "off" ? {localRescue:false} : {}),
      ...(mode === "ignored" ? {ignoreNetGroups:["default"]} : {}),
      ...(mode === "item-cap" ? {maxItems:1} : {})}, {signal:controller.signal});
    if (mode === "deadline") ctx.deadline = Date.now() - 1;
    const before = JSON.stringify(L.tracks);
    runLocalRescue(ctx);
    // A hard-only retry can route around protected copper; that copper itself must survive.
    expect(L.tracks.find(t => t.id === 200)).toEqual(JSON.parse(before)[0]);
    if (["off","ignored","abort","deadline","item-cap"].includes(mode)) expect(JSON.stringify(L.tracks)).toBe(before);
    expect(checkDrc(L).counts.violations).toBe(0);
  });
}
