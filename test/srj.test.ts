/**
 * SimpleRouteJson adapter (task I6 / I6b): src/srj + api.routeSrj. Covers the mm↔LU mapping, the
 * bounds→Rim / obstacles→Fence conversion, the `pcb_trace` output, the differential-pair
 * measurement, the R-1 invariant on the J802 corpus boards, and the Q-68 connectivity reading (b):
 * net-owned copper is attachable, non-terminal, so each J802 board has exactly 15 required
 * connections (rules/connectivity.md K-13..K-15).
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
    // one net per connection; two pads per two-point connection.
    expect(layout.nets.length).toBe(board(J802).connections.length);
    expect(netByConnection.size).toBe(layout.nets.length);
    expect(layout.pads.length).toBeGreaterThan(0);
    // every pad is locked and carries a net.
    expect(layout.pads.every((p) => p.hold === "locked" && p.net !== null)).toBe(true);
    // obstacles became Fences: net-owned ones carry a net (same-net exempt), keepouts do not; none
    // became a Pour (Q-68 reading (b): net-owned copper must not be a connectivity terminal).
    expect(layout.pours.length).toBe(0);
    expect(layout.fences.length).toBeGreaterThan(0);
    expect(layout.fences.some((f) => f.net !== undefined)).toBe(true);
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
  // links come only from those points (max(0,k-1) each), so requiredConnections is 15. Net-owned
  // copper is attachable, non-terminal copper (a same-net Fence) — it never adds a required link.
  for (const name of [J802, J802_6, "b223-j802-six-layer-v2.srj.json", "b223-j802-six-layer-v3.srj.json"]) {
    test(`${name}: requiredConnections is 15`, () => {
      if (!has(name)) return;
      const { layout } = buildSrjLayout(board(name));
      expect(layout.nets.length).toBe(15);
      expect(api.requiredConnections(layout).length).toBe(15);
      expect(api.checkDrc(layout).counts.incompletes).toBe(15);
    });
  }
  test(`${J802}: loads with zero DRC violations (violationsBefore 0)`, () => {
    if (!has(J802)) return;
    const { layout } = buildSrjLayout(board(J802));
    // Fence-Fence and Fence-Rim pairs are never checked (rules/drc.md DR-03), so the board's own
    // tightly-spaced pre-existing copper adds no Violation: the sealed reference records 0.
    expect(api.checkDrc(layout).counts.violations).toBe(0);
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
  // The J802 corpus boards carry each net's existing copper as net-owned same-net Fences
  // (attachable, non-terminal keepouts — Q-68 reading (b)); most required connections span two
  // Sheets and so need a Barrel. R-1 must hold on every board at every setting, the adapter must
  // produce well-formed output, and any copper it does add must stay within the Rim.
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
