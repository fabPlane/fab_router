/**
 * Task I4 router core: Journal undo, Theta* pull, A* search, and end-to-end `route()` invariants
 * (R-1 zero added violations, R-2 held/locked untouched, R-4 no Barrels when vias are off, R-5
 * item cap, cancellation). Boards are tiny hand-built Layouts plus the pure modules in isolation.
 */
import { describe, expect, test } from "bun:test";
import type { Layout, Net, NetGroup, Pad, PadForm, Part, Pt, Rim, Sheet, Track } from "../spec/types/layout.ts";
import { makeSpacingTable } from "../src/layout/index.ts";
import { buildLattice } from "../src/lattice/index.ts";
import { createJournal } from "../src/route/journal.ts";
import { pullPath } from "../src/route/pull.ts";
import { aStar, DIRS_8, type SearchSpace } from "../src/route/search.ts";
import { checkDrc, requiredConnections } from "../src/drc/index.ts";
import { route } from "../src/api.ts";

import { runOptimise } from "../src/route/optimise.ts";
import { resolveSettings } from "../src/pipeline/index.ts";

const LU_PER_UM = 10;

/** A one-signal-Sheet board with two same-net Pads and a rectangular Rim; optional obstacle Pads. */
function board(opts: { gap?: number; obstacle?: Pt } = {}): Layout {
  const stack: Sheet[] = [{ id: 0, name: "F.Cu", role: "signal", active: true, preferDir: null }];
  const kinds = ["", "default"];
  const spacing = makeSpacingTable(kinds, stack.length, [], (a, b) => (a === 0 || b === 0 ? 0 : 2000));
  const padForms: PadForm[] = [
    { id: 100, name: "smd", perSheet: new Map([[0, [{ kind: "box", box: { x0: -5000, y0: -5000, x1: 5000, y1: 5000 } }]]]), attachAllowed: false },
  ];
  const gap = opts.gap ?? 200_000;
  const parts: Part[] = [
    { id: 1, ref: "U1", package: "p", side: "front", at: { x: -gap / 2, y: 0 }, rotationDeg: 0 },
    { id: 2, ref: "U2", package: "p", side: "front", at: { x: gap / 2, y: 0 }, rotationDeg: 0 },
  ];
  const pads: Pad[] = [
    { id: 10, part: 1, pinName: "A", net: 0, form: 100, at: { x: -gap / 2, y: 0 }, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" },
    { id: 11, part: 2, pinName: "B", net: 0, form: 100, at: { x: gap / 2, y: 0 }, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" },
  ];
  if (opts.obstacle) {
    pads.push({ id: 12, part: 2, pinName: "X", net: 1, form: 100, at: opts.obstacle, rotationDeg: 0, side: "front", sheets: [0], kind: 1, hold: "locked" });
  }
  const nets: Net[] = [
    { id: 0, name: "SIG", group: 0, pads: [10, 11] },
    { id: 1, name: "OTHER", group: 0, pads: opts.obstacle ? [12] : [] },
  ];
  const netGroups: NetGroup[] = [
    { id: 0, name: "default", nets: [0, 1], trackWidth: 4000, kind: 1, categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 } },
  ];
  const rim: Rim = { outline: [{ x: -400_000, y: -200_000 }, { x: 400_000, y: -200_000 }, { x: 400_000, y: 200_000 }, { x: -400_000, y: 200_000 }], cutouts: [], kind: 1 };
  return {
    name: "t", frame: { luPerUnit: 1, offset: { x: 0, y: 0 }, fileUnit: "um", luPerUm: LU_PER_UM },
    angleMode: "45", stack, padForms, parts, pads, barrels: [], tracks: [], pours: [], fences: [], rim,
    nets, netGroups, spacing, viaRules: [], pinEdgeToTurnLu: 0, warnings: [],
  };
}

describe("Journal", () => {
  test("insert then rewind restores the Layout and Lattice", () => {
    const L = board();
    const lat = buildLattice(L);
    const j = createJournal(L, lat);
    const mark = j.mark();
    const t = j.addTrack({ net: 0, sheet: 0, pts: [{ x: 0, y: 0 }, { x: 10_000, y: 0 }], width: 4000, kind: 1, hold: "free" });
    expect(t.origin).toBe("router");
    expect(L.tracks.length).toBe(1);
    expect(lat.itemOf(t.id)).toBeDefined();
    j.rewind(mark);
    expect(L.tracks.length).toBe(0);
    expect(lat.itemOf(t.id)).toBeUndefined();
  });

  test("remove is journaled and restored by rewind", () => {
    const L = board();
    const existing: Track = { id: 99, net: 0, sheet: 0, pts: [{ x: 0, y: 0 }, { x: 1000, y: 0 }], width: 4000, kind: 1, hold: "free", origin: "file" };
    (L.tracks as Track[]).push(existing);
    const lat = buildLattice(L);
    const j = createJournal(L, lat);
    const mark = j.mark();
    j.remove(99);
    expect(L.tracks.find((t) => t.id === 99)).toBeUndefined();
    j.rewind(mark);
    expect(L.tracks.find((t) => t.id === 99)).toBeDefined();
  });

  test("freshId never collides with existing ids", () => {
    const L = board();
    const lat = buildLattice(L);
    const j = createJournal(L, lat);
    const ids = new Set(L.pads.map((p) => p.id));
    for (let i = 0; i < 5; i++) { const id = j.freshId(); expect(ids.has(id)).toBe(false); ids.add(id); }
  });
});

describe("pull (Theta*)", () => {
  test("a clear staircase collapses to its endpoints", () => {
    const pts: Pt[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }];
    const out = pullPath(pts, () => true);
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[out.length - 1]).toEqual({ x: 20, y: 20 });
    expect(out.length).toBe(2);
  });

  test("with no line of sight the path is kept", () => {
    const pts: Pt[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const out = pullPath(pts, (a, b) => (a.x === b.x || a.y === b.y)); // only axis-aligned legs "clear"
    expect(out.length).toBe(3);
  });
});

describe("A* search", () => {
  test("finds a straight path across free space", () => {
    const space: SearchSpace = {
      step: 10,
      pointOf: (gx, gy) => ({ x: gx * 10, y: gy * 10 }),
      nodeFree: () => true,
      edgeCost: () => ({ blocked: false, extra: 0, rip: [] }),
    };
    const res = aStar(space, {
      start: { gx: 0, gy: 0 }, goal: { gx: 5, gy: 0 },
      region: { gx0: -2, gy0: -2, gx1: 7, gy1: 2 },
      dirs: DIRS_8, stepCost: () => 1, minCost: 1, bendCost: 0, maxPops: 10_000,
    });
    expect(res.ok).toBe(true);
    expect(res.path[0]).toEqual({ x: 0, y: 0 });
    expect(res.path[res.path.length - 1]).toEqual({ x: 50, y: 0 });
  });

  test("routes around a blocked column", () => {
    const blockedX = 2;
    const space: SearchSpace = {
      step: 10,
      pointOf: (gx, gy) => ({ x: gx * 10, y: gy * 10 }),
      nodeFree: (gx, gy) => !(gx === blockedX && gy <= 1),
      edgeCost: (a, b) => {
        const bx = Math.round(b.x / 10), by = Math.round(b.y / 10);
        return bx === blockedX && by <= 1 ? { blocked: true, extra: 0, rip: [] } : { blocked: false, extra: 0, rip: [] };
      },
    };
    const res = aStar(space, {
      start: { gx: 0, gy: 0 }, goal: { gx: 5, gy: 0 },
      region: { gx0: -2, gy0: -3, gx1: 7, gy1: 4 },
      dirs: DIRS_8, stepCost: () => 1, minCost: 1, bendCost: 0, maxPops: 50_000,
    });
    expect(res.ok).toBe(true);
    // The winning path must avoid the blocked column at y ≤ 10.
    for (const p of res.path) expect(p.x === 20 && p.y <= 10).toBe(false);
  });

  test("respects an abort signal", () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const space: SearchSpace = { step: 10, pointOf: (gx, gy) => ({ x: gx * 10, y: gy * 10 }), nodeFree: () => true, edgeCost: () => ({ blocked: false, extra: 0, rip: [] }) };
    const res = aStar(space, {
      start: { gx: 0, gy: 0 }, goal: { gx: 99, gy: 0 },
      region: { gx0: -100, gy0: -100, gx1: 200, gy1: 100 },
      dirs: DIRS_8, stepCost: () => 1, minCost: 1, bendCost: 0, maxPops: 10_000_000, signal: ctrl.signal,
    });
    expect(res.aborted).toBe(true);
    expect(res.ok).toBe(false);
  });
});

describe("route() end to end", () => {
  test("connects two same-net Pads on one Sheet with no added violation (R-1)", () => {
    const L = board();
    expect(requiredConnections(L).length).toBe(1);
    const before = checkDrc(L).counts.violations;
    const rep = route(L, { viasAllowed: false, maxPasses: 10, timeBudgetMs: 10_000 });
    const after = checkDrc(L).counts.violations;
    expect(rep.violationsAdded).toBe(0);
    expect(after).toBe(before);
    expect(rep.completed).toBe(1);
    expect(rep.incompleteAfter).toBe(0);
    expect(L.tracks.length).toBe(1);
    expect(L.tracks[0]!.origin).toBe("router");
    // R-3: reported additions equal the item-count change.
    expect(rep.added.tracks).toBe(1);
  });

  test("routes around an obstacle of another net, still clean (R-1)", () => {
    const L = board({ gap: 200_000, obstacle: { x: 0, y: 0 } });
    const rep = route(L, { viasAllowed: false, maxPasses: 10, timeBudgetMs: 10_000 });
    expect(rep.violationsAdded).toBe(0);
    expect(checkDrc(L).counts.violations).toBe(0);
  });

  test("adds no Barrel when vias are disabled (R-4)", () => {
    const L = board();
    const rep = route(L, { viasAllowed: false, maxPasses: 5 });
    expect(rep.added.barrels).toBe(0);
    expect(L.barrels.length).toBe(0);
  });

  test("never touches locked Pads (R-2)", () => {
    const L = board();
    const padsBefore = L.pads.map((p) => ({ ...p, at: { ...p.at } }));
    route(L, { viasAllowed: false, maxPasses: 5 });
    for (let i = 0; i < padsBefore.length; i++) {
      expect(L.pads[i]!.at).toEqual(padsBefore[i]!.at);
      expect(L.pads[i]!.hold).toBe("locked");
    }
  });

  test("maxItems caps completed connections and added items (R-5)", () => {
    const L = board();
    const rep = route(L, { viasAllowed: false, maxItems: 0, maxPasses: 5 });
    expect(rep.completed).toBe(0);
    expect(rep.added.tracks + rep.added.barrels).toBeLessThanOrEqual(0);
    expect(rep.stoppedBy).toBe("maxItems");
  });

  test("is deterministic: same input and settings give identical Tracks", () => {
    const a = board();
    const b = board();
    route(a, { viasAllowed: false, maxPasses: 10, seed: 1 });
    route(b, { viasAllowed: false, maxPasses: 10, seed: 1 });
    expect(a.tracks.map((t) => ({ pts: t.pts, w: t.width }))).toEqual(b.tracks.map((t) => ({ pts: t.pts, w: t.width })));
  });

  test("an aborted run returns report.aborted and holds R-1", () => {
    const L = board();
    const ctrl = new AbortController();
    ctrl.abort();
    const rep = route(L, { viasAllowed: false, maxPasses: 10 }, { signal: ctrl.signal });
    expect(rep.aborted).toBe(true);
    expect(rep.violationsAdded).toBe(0);
  });
});

describe("optimiser orphan copper", () => {
  function setup() {
    const layout = board();
    const lattice = buildLattice(layout);
    const journal = createJournal(layout, lattice);
    const orphan = journal.addTrack({ net: 0, sheet: 0, pts: [{ x: 0, y: 50000 }, { x: 30000, y: 50000 }], width: 4000, kind: 1, hold: "free" });
    return { layout, lattice, journal, orphan };
  }
  const settings = (extra = {}) => resolveSettings({ optimizerEnabled: true, ...extra }, undefined, "45");

  test("removes a detached router fragment ignored by terminal connectivity", () => {
    const { layout, lattice, journal, orphan } = setup();
    const before = checkDrc(layout).counts.incompletes;
    runOptimise(layout, lattice, journal, settings(), new Set());
    expect(layout.tracks).toHaveLength(0);
    expect(lattice.itemOf(orphan.id)).toBeUndefined();
    expect(checkDrc(layout).counts.incompletes).toBe(before);
  });

  for (const retained of [{ hold: "held" as const }, { hold: "locked" as const }, { origin: "file" as const }, { origin: "session" as const }]) {
    test(`preserves the entire island when it contains retained copper ${JSON.stringify(retained)}`, () => {
      const { layout, lattice, journal, orphan } = setup();
      Object.assign(orphan, retained);
      const sibling = journal.addTrack({ net: 0, sheet: 0, pts: [{ x: 30000, y: 50000 }, { x: 60000, y: 50000 }], width: 4000, kind: 1, hold: "free" });
      runOptimise(layout, lattice, journal, settings(), new Set());
      expect(layout.tracks.map(t => t.id).sort()).toEqual([orphan.id, sibling.id].sort());
    });
  }

  test("keeps a router stub attached to a pad", () => {
    const { layout, lattice, journal } = setup();
    const attached = journal.addTrack({ net: 0, sheet: 0, pts: [{ x: -100000, y: 0 }, { x: -50000, y: 0 }], width: 4000, kind: 1, hold: "free" });
    runOptimise(layout, lattice, journal, settings(), new Set());
    expect(layout.tracks.map(t => t.id)).toEqual([attached.id]);
  });

  for (const extra of [{ optimizerEnabled: false }, { optimizerMaxItems: 0 }]) {
    test(`respects optimiser limits ${JSON.stringify(extra)}`, () => {
      const { layout, lattice, journal } = setup();
      runOptimise(layout, lattice, journal, settings(extra), new Set());
      expect(layout.tracks).toHaveLength(1);
    });
  }

  test("preserves ignored nets", () => {
    const { layout, lattice, journal } = setup();
    runOptimise(layout, lattice, journal, settings(), new Set([0]));
    expect(layout.tracks).toHaveLength(1);
  });
  test("removes a whole track/via island atomically and supports journal rewind", () => {
    const { layout, lattice, journal, orphan } = setup();
    const form = { id: 101, name: "via", perSheet: new Map([[0, [{ kind: "disk" as const, c: { x: 0, y: 0 }, r: 3000 }]]]), attachAllowed: false };
    (layout.padForms as typeof form[]).push(form);
    const via = journal.addBarrel({ net: 0, at: orphan.pts[0]!, form: 101, fromSheet: 0, toSheet: 0, kind: 1, hold: "free" });
    const mark = journal.mark();
    runOptimise(layout, lattice, journal, settings({ optimizerMaxItems: 1 }), new Set());
    // A one-item budget may eliminate the redundant via; the remaining track must survive
    // until another invocation can spend the additional cleanup operation.
    expect(layout.tracks).toHaveLength(1);
    journal.rewind(mark);
    expect(lattice.itemOf(via.id)).toBeDefined();
    runOptimise(layout, lattice, journal, settings(), new Set());
    expect(layout.tracks).toHaveLength(0);
    expect(layout.barrels).toHaveLength(0);
    journal.rewind(mark);
    expect(lattice.itemOf(orphan.id)).toBeDefined();
    expect(lattice.itemOf(via.id)).toBeDefined();
  });

  test("keeps router copper touching a Prior pour", () => {
    const { layout, lattice, journal } = setup();
    const pour = { id: 999, net: 0, sheet: 0, outline: [{ x: 0, y: 40000 }, { x: 10000, y: 40000 }, { x: 10000, y: 60000 }, { x: 0, y: 60000 }], holes: [], kind: 1, hold: "locked" as const, origin: "prior" as const };
    (layout.pours as typeof pour[]).push(pour);
    lattice.insertItem("pour", pour);
    runOptimise(layout, lattice, journal, settings(), new Set());
    expect(layout.tracks).toHaveLength(1);
  });

});
