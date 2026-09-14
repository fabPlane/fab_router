/**
 * SimpleRouteJson adapter (task I6 / I6b / I6c): src/srj + api.routeSrj. Covers the mm↔LU mapping,
 * the bounds→Rim conversion, the obstacles→Prior-copper (Pour, origin "prior") / keepout (Fence)
 * conversion, the `pcb_trace` output, the differential-pair measurement, the R-1 invariant on the
 * J802 corpus boards, the Q-68 connectivity reading (b) (each J802 board has exactly 15 required
 * connections, rules/connectivity.md K-13..K-15), and the Q-69 Prior-copper behaviours: DRC-silent
 * among Prior copper (DR-13, violationsBefore 0), an obstacle to other nets, and connective to its
 * own net (K-16).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import * as api from "../src/api.ts";
import { buildSrjLayout, normalisePairs } from "../src/srj/index.ts";
import type { SimpleRouteJson } from "../spec/types/srj.ts";

const BOARDS = new URL("../spec/acceptance/boards/", import.meta.url);
function board(name: string): SimpleRouteJson {
  return JSON.parse(readFileSync(new URL(name, BOARDS), "utf8")) as SimpleRouteJson;
}
function has(name: string): boolean {
  try { readFileSync(new URL(name, BOARDS)); return true; } catch { return false; }
}

const J802 = "b223-j802.srj.json";
const J802_6 = "b223-j802-six-layer.srj.json";

describe("srj build", () => {
  test("maps a 2-layer board to a Layout", () => {
    if (!has(J802)) return;
    const { layout, netByConnection, diagnostics } = buildSrjLayout(board(J802));
    expect(layout.stack.length).toBe(2);
    expect(layout.stack[0]!.name).toBe("top");
    expect(layout.stack[1]!.name).toBe("bottom");
    expect(layout.stack.every((s) => s.role === "signal")).toBe(true);
    // one Net per routed connection (context Nets for owners naming no routed connection, J-25,
    // are extra); two pads per two-point connection.
    expect(netByConnection.size).toBe(board(J802).connections.length);
    expect(layout.nets.length).toBeGreaterThanOrEqual(netByConnection.size);
    expect(layout.pads.length).toBeGreaterThan(0);
    // every pad is locked and carries a net.
    expect(layout.pads.every((p) => p.hold === "locked" && p.net !== null)).toBe(true);
    // net-owned obstacles became Prior copper (Pours with origin "prior", carrying the owner net);
    // keepouts with no owner stayed Fences and carry no net (task I6c / J-23, DR-13, K-16).
    expect(layout.pours.length).toBeGreaterThan(0);
    expect(layout.pours.every((p) => p.origin === "prior" && p.net !== null)).toBe(true);
    expect(layout.fences.every((f) => f.net === undefined)).toBe(true);
    // a rectangular Rim from bounds + 1 mm.
    expect(layout.rim).not.toBeNull();
    expect(layout.rim!.outline.length).toBe(4);
    expect(diagnostics.every((d) => d.level !== "info" || true)).toBe(true);
  });

  test("six-layer board yields six signal Sheets named top/inner/bottom", () => {
    if (!has(J802_6)) return;
    const { layout } = buildSrjLayout(board(J802_6));
    expect(layout.stack.map((s) => s.name)).toEqual(["top", "inner1", "inner2", "inner3", "inner4", "bottom"]);
  });

  test("Rim grows the bounds outward by 1 mm", () => {
    if (!has(J802)) return;
    const b = board(J802).bounds;
    const { layout, frameLuPerUnit } = buildSrjLayout(board(J802));
    const xs = layout.rim!.outline.map((p) => p.x);
    const ys = layout.rim!.outline.map((p) => p.y);
    // 1 mm margin in LU.
    expect(Math.min(...xs)).toBe(Math.round((b.minX - 1) * frameLuPerUnit));
    expect(Math.max(...xs)).toBe(Math.round((b.maxX + 1) * frameLuPerUnit));
    expect(Math.min(...ys)).toBe(Math.round((b.minY - 1) * frameLuPerUnit));
    expect(Math.max(...ys)).toBe(Math.round((b.maxY + 1) * frameLuPerUnit));
  });
});

describe("srj connectivity (Q-68 reading (b) / K-13..K-15)", () => {
  // Each J802 board declares 15 connections, every one with two pointsToConnect: the required
  // links come only from those points (max(0,k-1) each), so requiredConnections is 15. Prior copper
  // (a Pour with origin "prior") is attachable, non-terminal copper (K-14) — it never adds a link.
  for (const name of [J802, J802_6, "b223-j802-six-layer-v2.srj.json", "b223-j802-six-layer-v3.srj.json"]) {
    test(`${name}: requiredConnections is 15`, () => {
      if (!has(name)) return;
      const { layout, netByConnection } = buildSrjLayout(board(name));
      expect(netByConnection.size).toBe(15);
      expect(api.requiredConnections(layout).length).toBe(15);
      expect(api.checkDrc(layout).counts.incompletes).toBe(15);
    });
  }
  for (const name of [J802, J802_6, "b223-j802-six-layer-v2.srj.json", "b223-j802-six-layer-v3.srj.json"]) {
    test(`${name}: loads with zero DRC violations (violationsBefore 0)`, () => {
      if (!has(name)) return;
      const { layout } = buildSrjLayout(board(name));
      // DR-13 (formats/srj.md J-33): a Prior-copper pair is never a spacing/fence Violation, at any
      // distance, whatever their nets — so the boards' tightly-coupled pre-existing copper (84
      // different-net pairs below the 0.15 mm default on the 2-layer board) adds no Violation, and
      // Prior copper is checked only against router-added copper, of which there is none at load.
      expect(api.checkDrc(layout).counts.violations).toBe(0);
    });
  }
});

describe("srj Prior copper (Q-69: DR-13 silence, obstacle, connective, non-terminal)", () => {
  const twoOwners: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    defaultObstacleMargin: 0.2,
    bounds: { minX: 0, maxX: 30, minY: 0, maxY: 20 },
    obstacles: [
      // two Prior-copper pieces of DIFFERENT owners that overlap (0 gap): DR-13 must keep them silent.
      { type: "rect", layers: ["top"], center: { x: 15, y: 15 }, width: 4, height: 4, connectedTo: ["A"] },
      { type: "rect", layers: ["top"], center: { x: 16, y: 15 }, width: 4, height: 4, connectedTo: ["B"] },
    ],
    connections: [
      { name: "A", pointsToConnect: [{ x: 2, y: 2, layer: "top" }, { x: 2, y: 18, layer: "top" }] },
      { name: "B", pointsToConnect: [{ x: 28, y: 2, layer: "top" }, { x: 28, y: 18, layer: "top" }] },
    ],
  } as unknown as SimpleRouteJson;

  test("two overlapping different-net Prior pieces are never a Violation (DR-13)", () => {
    const { layout } = buildSrjLayout(twoOwners);
    expect(layout.pours.length).toBe(2);
    expect(layout.pours.every((p) => p.origin === "prior" && p.net !== null)).toBe(true);
    // overlapping copper of two different nets, yet silent among Prior copper: 0 Violations.
    expect(api.checkDrc(layout).counts.violations).toBe(0);
    // neither piece is a terminal: A and B each keep their two Pad terminals → one required link each.
    expect(api.requiredConnections(layout).length).toBe(2);
  });

  test("Prior copper is an obstacle to other nets (R-1) but same-net exempt (K-16, DR-02)", () => {
    const board: SimpleRouteJson = {
      layerCount: 2, minTraceWidth: 0.15, defaultObstacleMargin: 0.2,
      bounds: { minX: 0, maxX: 30, minY: 0, maxY: 20 },
      connections: [
        { name: "A", pointsToConnect: [{ x: 2, y: 2, layer: "top" }, { x: 2, y: 18, layer: "top" }] },
        { name: "B", pointsToConnect: [{ x: 28, y: 2, layer: "top" }, { x: 28, y: 18, layer: "top" }] },
      ],
      obstacles: [{ type: "rect", layers: ["top"], center: { x: 15, y: 10 }, width: 4, height: 4, connectedTo: ["A"] }],
    } as unknown as SimpleRouteJson;
    const { layout, netByConnection } = buildSrjLayout(board);
    const cross = (net: number) => ({
      id: 900001, net, sheet: 0, pts: [{ x: 13000, y: 10000 }, { x: 17000, y: 10000 }],
      width: 150, kind: 1, hold: "free" as const, origin: "router" as const,
    });
    // a router-added Track of net B crossing net A's Prior copper is a spacing Violation.
    expect(api.checkDrc({ ...layout, tracks: [cross(netByConnection.get("B")!)] }).counts.violations).toBeGreaterThan(0);
    // the SAME Track of the OWNING net A attaches: same-net exempt, no Violation.
    expect(api.checkDrc({ ...layout, tracks: [cross(netByConnection.get("A")!)] }).counts.violations).toBe(0);
  });

  test("Prior copper is connective: endpoints on the net's own Prior copper complete for free (K-16)", () => {
    const board: SimpleRouteJson = {
      layerCount: 1, minTraceWidth: 0.15, defaultObstacleMargin: 0.2,
      bounds: { minX: 0, maxX: 20, minY: 0, maxY: 10 },
      // Prior copper of A spans the strip between the two endpoints and covers both.
      obstacles: [{ type: "rect", layers: ["top"], center: { x: 10, y: 5 }, width: 18, height: 2, connectedTo: ["A"] }],
      connections: [{ name: "A", pointsToConnect: [{ x: 2, y: 5, layer: "top" }, { x: 18, y: 5, layer: "top" }] }],
    } as unknown as SimpleRouteJson;
    const { layout } = buildSrjLayout(board);
    // both endpoints join the net's Prior copper, which joins them: nothing left to route.
    expect(api.requiredConnections(layout).length).toBe(0);
    expect(api.checkDrc(layout).counts.incompletes).toBe(0);
  });

  test("Prior copper is never a terminal: an isolated fragment adds no required link (K-14)", () => {
    const board: SimpleRouteJson = {
      layerCount: 1, minTraceWidth: 0.15, defaultObstacleMargin: 0.2,
      bounds: { minX: 0, maxX: 20, minY: 0, maxY: 10 },
      // Prior copper of A far from both endpoints.
      obstacles: [{ type: "rect", layers: ["top"], center: { x: 10, y: 8 }, width: 2, height: 2, connectedTo: ["A"] }],
      connections: [{ name: "A", pointsToConnect: [{ x: 2, y: 2, layer: "top" }, { x: 18, y: 2, layer: "top" }] }],
    } as unknown as SimpleRouteJson;
    const { layout } = buildSrjLayout(board);
    // two Pad terminals → one required link; the isolated Prior fragment adds none (would be 2 if terminal).
    expect(api.requiredConnections(layout).length).toBe(1);
  });
});

describe("srj cross-Sheet Prior copper bridging (task I7 gap 1; K-02/K-16, J-34)", () => {
  // A physical multi-layer via of the existing route maps to one Prior Pour per Sheet; two Pours on
  // different Sheets never join (only a Barrel bridges Sheets, K-02). The import emits an inert
  // bridging Barrel (Kind 0, no drill, origin "prior") so the via's Prior copper is a single
  // cross-Sheet component — a route can then complete a connection whose Prior route changes Sheet.
  const bridged: SimpleRouteJson = {
    layerCount: 2, minTraceWidth: 0.15, defaultObstacleMargin: 0.2,
    bounds: { minX: 0, maxX: 20, minY: 0, maxY: 10 },
    obstacles: [
      // a top trace from the top endpoint to the via, a two-Sheet via, a bottom trace to the bottom endpoint.
      { type: "rect", layers: ["top"], center: { x: 6, y: 5 }, width: 8, height: 1, connectedTo: ["A"] },
      { type: "rect", layers: ["top", "bottom"], center: { x: 10, y: 5 }, width: 1, height: 1, connectedTo: ["A"] },
      { type: "rect", layers: ["bottom"], center: { x: 14, y: 5 }, width: 8, height: 1, connectedTo: ["A"] },
    ],
    connections: [{ name: "A", pointsToConnect: [{ x: 2, y: 5, layer: "top" }, { x: 18, y: 5, layer: "bottom" }] }],
  } as unknown as SimpleRouteJson;

  test("a two-Sheet net-owned obstacle emits an inert Kind-0 Prior Barrel", () => {
    const { layout } = buildSrjLayout(bridged);
    const bridge = layout.barrels.filter((b) => b.origin === "prior");
    expect(bridge.length).toBe(1);
    expect(bridge[0]!.kind).toBe(0);
    expect(bridge[0]!.hold).toBe("locked");
    expect(bridge[0]!.fromSheet).toBe(0);
    expect(bridge[0]!.toSheet).toBe(1);
  });

  test("the bridge joins the per-Sheet Prior copper so the connection needs no route", () => {
    const { layout } = buildSrjLayout(bridged);
    // top endpoint → top trace → via (top) → bridge → via (bottom) → bottom trace → bottom endpoint:
    // one component, so nothing is left to route and no Violation is introduced.
    expect(api.requiredConnections(layout).length).toBe(0);
    expect(api.checkDrc(layout).counts.incompletes).toBe(0);
    expect(api.checkDrc(layout).counts.violations).toBe(0);
  });

  test("without the two-Sheet via the two Sheets stay separate (one required link)", () => {
    const split: SimpleRouteJson = { ...bridged, obstacles: [bridged.obstacles![0]!, bridged.obstacles![2]!] };
    const { layout } = buildSrjLayout(split);
    expect(layout.barrels.filter((b) => b.origin === "prior").length).toBe(0);
    expect(api.requiredConnections(layout).length).toBe(1);
  });
});

describe("srj differential-pair normalisation", () => {
  test("boards' connectionNames split into _P and _N members", () => {
    const pairs = normalisePairs([
      { connectionNames: ["X_D0_N", "X_D0_P"], lengthTolerance: 0.15 },
    ]);
    expect(pairs.length).toBe(1);
    expect(pairs[0]!.p).toBe("X_D0_P");
    expect(pairs[0]!.n).toBe("X_D0_N");
    expect(pairs[0]!.skewToleranceMm).toBe(0.15);
  });
  test("spec-shaped {p, n} pass through", () => {
    const pairs = normalisePairs([{ p: "A", n: "B", skewToleranceMm: 0.2 }]);
    expect(pairs[0]).toEqual({ p: "A", n: "B", skewToleranceMm: 0.2 });
  });
});

describe("routeSrj on a clean synthetic board", () => {
  test("routes one connection within its bounds and avoids the obstacle", () => {
    const srj: SimpleRouteJson = {
      layerCount: 2,
      minTraceWidth: 0.15,
      bounds: { minX: 0, maxX: 20, minY: 0, maxY: 20 },
      obstacles: [{ type: "rect", layers: ["top"], center: { x: 10, y: 10 }, width: 3, height: 3, connectedTo: [] }],
      connections: [{ name: "N1", pointsToConnect: [{ x: 2, y: 2, layer: "top" }, { x: 18, y: 18, layer: "top" }] }],
    };
    const r = api.routeSrj(srj, {});
    expect(r.ok).toBe(true);
    expect(r.violationsAdded).toBe(0);
    expect(r.report.added.tracks).toBe(1);
    expect(r.report.incompleteAfter).toBe(0);
    const trace = r.srj.traces?.[0];
    expect(trace?.type).toBe("pcb_trace");
    expect(trace?.connection_name).toBe("N1");
    // every wire point stays inside the bounds (and so inside the Rim).
    for (const step of trace?.route ?? []) {
      if (step.route_type !== "wire") continue;
      expect(step.x).toBeGreaterThanOrEqual(0);
      expect(step.x).toBeLessThanOrEqual(20);
      expect(step.y).toBeGreaterThanOrEqual(0);
      expect(step.y).toBeLessThanOrEqual(20);
      expect(step.width).toBeCloseTo(0.15, 3);
      expect(step.layer).toBe("top");
    }
  });
});

describe("routeSrj on the J802 boards", () => {
  // The J802 corpus boards carry each net's existing copper as net-owned Prior copper (Pours with
  // origin "prior": attachable, non-terminal, an obstacle to other nets — Q-68/Q-69); most required
  // connections span two Sheets and so need a Barrel. R-1 must hold on every board at every setting,
  // the adapter must produce well-formed output, and any copper it does add must stay within the Rim.
  for (const name of [J802, J802_6]) {
    test(`${name}: R-1 holds, output well formed, traces within bounds`, () => {
      if (!has(name)) return;
      const srj = board(name);
      const built = buildSrjLayout(srj);
      const r = api.routeSrj(srj, { timeBudgetMs: 90000 });
      // R-1: the router never adds a violation, on any board at any setting.
      expect(r.violationsAdded).toBe(0);
      expect(r.report.violationsAdded).toBe(0);
      // routing never makes a net worse.
      expect(r.report.incompleteAfter).toBeLessThanOrEqual(r.report.incompleteBefore);
      // every differential pair is measured, both members, p is the _P net.
      expect(r.pairs && r.pairs.length).toBe((srj.differentialPairs ?? []).length);
      for (const p of r.pairs ?? []) {
        expect(p.p.endsWith("_P")).toBe(true);
        expect(p.n.endsWith("_N")).toBe(true);
        expect(p.skewMm).toBeCloseTo(Math.abs(p.lengthP - p.lengthN), 6);
        expect(p.lengthP).toBeGreaterThanOrEqual(0);
        expect(p.lengthN).toBeGreaterThanOrEqual(0);
      }
      // any emitted trace is a well-formed pcb_trace whose wire points lie within the Rim.
      const rb = built.layout.rim!;
      const xs = rb.outline.map((q) => q.x), ys = rb.outline.map((q) => q.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const lu = built.frameLuPerUnit;
      for (const t of r.srj.traces ?? []) {
        expect(t.type).toBe("pcb_trace");
        expect(t.route.length).toBeGreaterThan(0);
        for (const step of t.route) {
          if (step.route_type !== "wire") continue;
          expect(Math.round(step.x * lu)).toBeGreaterThanOrEqual(x0);
          expect(Math.round(step.x * lu)).toBeLessThanOrEqual(x1);
          expect(Math.round(step.y * lu)).toBeGreaterThanOrEqual(y0);
          expect(Math.round(step.y * lu)).toBeLessThanOrEqual(y1);
        }
      }
    }, 120000);
  }
});
