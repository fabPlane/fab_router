/**
 * Property tests for the Lattice: random rectangles and segments on random Sheets against a
 * brute-force scan (identical (id, leg) lists over ≥ 10 000 queries with interleaved inserts and
 * removes), determinism across insertion orders, rebuild behaviour, and item indexing of a
 * synthetic Layout against per-item bounds.
 */
import { describe, expect, test } from "bun:test";
import type { Dop8, Box } from "../src/geom/index.ts";
import { boxIntersects, dop8Intersects, dop8OfPts } from "../src/geom/index.ts";
import type { LatticeItemRef } from "../src/lattice/index.ts";
import { barrelSheets, buildLattice, createLattice, drillOfBarrel, drillOfPad, RIM_ID, SHELF_CELLS } from "../src/lattice/index.ts";
import { emptyLayout } from "../src/layout/index.ts";
import { mulberry32, synthLayout } from "./helpers/synth.ts";

interface Entry { ref: LatticeItemRef; sheet: number; d: Dop8 }

const key = (r: LatticeItemRef) => `${r.id}:${r.leg ?? -1}`;

function makeGen(seed: number) {
  const rnd = mulberry32(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const SPAN = 1_000_000;
  /** A random item: a rectangle (leg-less) or a segment (a leg of a multi-leg item). */
  const randomEntry = (id: number): Entry => {
    const sheet = int(0, 3);
    const cx = int(-SPAN, SPAN), cy = int(-SPAN, SPAN);
    if (rnd() < 0.5) {
      const w = rnd() < 0.1 ? int(50_000, 400_000) : int(100, 20_000);
      const h = rnd() < 0.1 ? int(50_000, 400_000) : int(100, 20_000);
      const d = dop8OfPts([{ x: cx, y: cy }, { x: cx + w, y: cy + h }]);
      return { ref: { id }, sheet, d };
    }
    const len = rnd() < 0.1 ? int(100_000, 500_000) : int(100, 30_000);
    const dir = int(0, 7);
    const dxs = [1, 1, 0, -1, -1, -1, 0, 1], dys = [0, 1, 1, 1, 0, -1, -1, -1];
    const a = { x: cx, y: cy }, b = { x: cx + dxs[dir]! * len, y: cy + dys[dir]! * len };
    return { ref: { id, leg: int(0, 5) }, sheet, d: dop8OfPts([a, b], int(0, 3000)) };
  };
  const randomQuery = (): { sheet: number; box: Box; dop: Dop8; sweep: boolean } => {
    const sheet = int(0, 3);
    const cx = int(-SPAN, SPAN), cy = int(-SPAN, SPAN);
    const big = rnd() < 0.05;
    const w = big ? int(100_000, 2_000_000) : int(0, 40_000), h = big ? int(100_000, 2_000_000) : int(0, 40_000);
    const box = { x0: cx, y0: cy, x1: cx + w, y1: cy + h };
    const dir = int(0, 7);
    const dxs = [1, 1, 0, -1, -1, -1, 0, 1], dys = [0, 1, 1, 1, 0, -1, -1, -1];
    const len = big ? int(100_000, 1_000_000) : int(0, 60_000);
    const dop = dop8OfPts([{ x: cx, y: cy }, { x: cx + dxs[dir]! * len, y: cy + dys[dir]! * len }], int(0, 5000));
    return { sheet, box, dop, sweep: rnd() < 0.5 };
  };
  return { rnd, int, randomEntry, randomQuery };
}

function bruteHits(entries: Map<string, Entry>, sheet: number, box: Box): LatticeItemRef[] {
  const out: LatticeItemRef[] = [];
  for (const e of entries.values()) if (e.sheet === sheet && boxIntersects(e.d, box)) out.push(e.ref);
  return sortRefs(out);
}
function bruteSweep(entries: Map<string, Entry>, sheet: number, dop: Dop8): LatticeItemRef[] {
  const out: LatticeItemRef[] = [];
  for (const e of entries.values()) if (e.sheet === sheet && dop8Intersects(e.d, dop)) out.push(e.ref);
  return sortRefs(out);
}
function sortRefs(refs: LatticeItemRef[]): LatticeItemRef[] {
  return refs.slice().sort((a, b) => a.id - b.id || (a.leg ?? -1) - (b.leg ?? -1));
}

describe("Lattice property tests", () => {
  test("hits / sweepHits equal a brute-force scan over 10 000 queries with interleaved inserts and removes", () => {
    const g = makeGen(7);
    const layout = emptyLayout("prop");
    const lattice = createLattice(layout, { luPerUm: 10 });
    const entries = new Map<string, Entry>(); // key(ref) + sheet → entry
    const ekey = (e: Entry) => `${key(e.ref)}@${e.sheet}`;
    let nextId = 0;
    const insert = () => {
      const e = g.randomEntry(nextId++);
      entries.set(ekey(e), e);
      lattice.insert(e.ref, e.sheet, e.d);
    };
    for (let i = 0; i < 3000; i++) insert();
    let checked = 0, nonEmpty = 0;
    for (let q = 0; q < 10_000; q++) {
      // churn: a few inserts and removes between queries
      const ops = g.int(0, 3);
      for (let k = 0; k < ops; k++) {
        if (g.rnd() < 0.5 || entries.size < 500) insert();
        else {
          const keys = [...entries.keys()];
          const victim = entries.get(keys[g.int(0, keys.length - 1)]!)!;
          entries.delete(ekey(victim));
          lattice.remove(victim.ref, victim.sheet);
        }
      }
      const { sheet, box, dop, sweep } = g.randomQuery();
      const got = sweep ? lattice.sweepHits(sheet, dop) : lattice.hits(sheet, box);
      const want = sweep ? bruteSweep(entries, sheet, dop) : bruteHits(entries, sheet, box);
      expect(got.map(key)).toEqual(want.map(key));
      // ascending, deduplicated
      for (let i = 1; i < got.length; i++) {
        const a = got[i - 1]!, b = got[i]!;
        expect(a.id < b.id || (a.id === b.id && (a.leg ?? -1) < (b.leg ?? -1))).toBe(true);
      }
      checked++;
      if (want.length) nonEmpty++;
    }
    expect(checked).toBe(10_000);
    expect(nonEmpty).toBeGreaterThan(1000);
  });

  test("a shelf overflow triggers a rebuild that re-buckets the items, and queries still agree", () => {
    const g = makeGen(5);
    const lattice = createLattice(emptyLayout("shelf"), { luPerUm: 10 }); // 1 mm cells to start
    const entries = new Map<string, Entry>();
    for (let i = 0; i < 3000; i++) {
      // 3.5 mm squares: 4–5 cells per axis at 1 mm, more than SHELF_CELLS → shelf
      const cx = g.int(-1_000_000, 1_000_000), cy = g.int(-1_000_000, 1_000_000);
      const e: Entry = { ref: { id: i }, sheet: g.int(0, 1), d: dop8OfPts([{ x: cx, y: cy }, { x: cx + 35_000, y: cy + 35_000 }]) };
      entries.set(`${key(e.ref)}@${e.sheet}`, e);
      lattice.insert(e.ref, e.sheet, e.d);
    }
    const st = lattice.stats();
    expect(st.rebuilds).toBeGreaterThan(0);
    expect(st.cellSize).toBe(50_000); // clamped to 5 mm: the squares now span ≤ 4 cells
    for (const p of st.perSheet) expect(p.shelf).toBe(0);
    for (let q = 0; q < 1000; q++) {
      const { sheet, box, dop, sweep } = g.randomQuery();
      const got = sweep ? lattice.sweepHits(sheet, dop) : lattice.hits(sheet, box);
      const want = sweep ? bruteSweep(entries, sheet, dop) : bruteHits(entries, sheet, box);
      expect(got.map(key)).toEqual(want.map(key));
    }
  });

  test("filter is applied and results stay sorted", () => {
    const g = makeGen(11);
    const lattice = createLattice(emptyLayout("f"), { luPerUm: 10 });
    const entries = new Map<string, Entry>();
    for (let i = 0; i < 2000; i++) { const e = g.randomEntry(i); entries.set(`${key(e.ref)}@${e.sheet}`, e); lattice.insert(e.ref, e.sheet, e.d); }
    for (let q = 0; q < 500; q++) {
      const { sheet, box } = g.randomQuery();
      const odd = (r: LatticeItemRef) => r.id % 2 === 1;
      const got = lattice.hits(sheet, box, odd);
      const want = bruteHits(entries, sheet, box).filter(odd);
      expect(got.map(key)).toEqual(want.map(key));
    }
  });

  test("two insertion orders (and a remove/re-insert history) give identical query results", () => {
    const g = makeGen(23);
    const items: Entry[] = [];
    for (let i = 0; i < 4000; i++) items.push(g.randomEntry(i));
    const a = createLattice(emptyLayout("a"), { luPerUm: 10 });
    for (const e of items) a.insert(e.ref, e.sheet, e.d);
    const b = createLattice(emptyLayout("b"), { luPerUm: 10 });
    const shuffled = items.slice();
    for (let i = shuffled.length - 1; i > 0; i--) { const j = g.int(0, i); [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]; }
    for (const e of shuffled) b.insert(e.ref, e.sheet, e.d);
    // c: insert everything, remove a third, re-insert them in another order
    const c = createLattice(emptyLayout("c"), { luPerUm: 10 });
    for (const e of shuffled) c.insert(e.ref, e.sheet, e.d);
    const removed = items.filter((_, i) => i % 3 === 0);
    for (const e of removed) c.remove(e.ref, e.sheet);
    for (const e of removed.slice().reverse()) c.insert(e.ref, e.sheet, e.d);
    for (let q = 0; q < 2000; q++) {
      const { sheet, box, dop, sweep } = g.randomQuery();
      const ra = sweep ? a.sweepHits(sheet, dop) : a.hits(sheet, box);
      const rb = sweep ? b.sweepHits(sheet, dop) : b.hits(sheet, box);
      const rc = sweep ? c.sweepHits(sheet, dop) : c.hits(sheet, box);
      expect(rb).toEqual(ra);
      expect(rc).toEqual(ra);
    }
  });

  test("re-inserting an existing (ref, sheet) replaces its bounds; removing an unknown ref is a no-op", () => {
    const lattice = createLattice(emptyLayout("r"), { luPerUm: 10 });
    const d1 = dop8OfPts([{ x: 0, y: 0 }, { x: 100, y: 100 }]);
    const d2 = dop8OfPts([{ x: 50_000, y: 50_000 }, { x: 50_100, y: 50_100 }]);
    lattice.insert({ id: 5 }, 0, d1);
    lattice.insert({ id: 5 }, 0, d2);
    expect(lattice.hits(0, { x0: -10, y0: -10, x1: 10, y1: 10 })).toEqual([]);
    expect(lattice.hits(0, { x0: 50_000, y0: 50_000, x1: 50_001, y1: 50_001 })).toEqual([{ id: 5 }]);
    expect(lattice.stats().slots).toBe(1);
    lattice.remove({ id: 99 }, 0);
    lattice.remove({ id: 5 }, 2);
    expect(lattice.stats().slots).toBe(1);
    lattice.remove({ id: 5 }, 0);
    expect(lattice.stats().slots).toBe(0);
    expect(lattice.hits(0, { x0: 50_000, y0: 50_000, x1: 50_001, y1: 50_001 })).toEqual([]);
  });

  test("cell size comes from the median diagonal and is clamped to [0.5 mm, 5 mm]; big items go to the shelf", () => {
    const layout = emptyLayout("cs");
    const tiny = createLattice(layout, { luPerUm: 10 });
    for (let i = 0; i < 100; i++) tiny.insert({ id: i }, 0, dop8OfPts([{ x: i * 10, y: 0 }, { x: i * 10 + 5, y: 5 }]));
    tiny.rebuild();
    expect(tiny.cellSize).toBe(5000); // 0.5 mm at 10 LU/µm
    const huge = createLattice(layout, { luPerUm: 10 });
    for (let i = 0; i < 100; i++) huge.insert({ id: i }, 0, dop8OfPts([{ x: i * 1000, y: 0 }, { x: i * 1000 + 300_000, y: 300_000 }]));
    huge.rebuild();
    expect(huge.cellSize).toBe(50_000); // 5 mm
    const mid = createLattice(layout, { luPerUm: 10 });
    for (let i = 0; i < 101; i++) mid.insert({ id: i }, 0, dop8OfPts([{ x: i * 1000, y: 0 }, { x: i * 1000 + 3000, y: 4000 }]));
    mid.rebuild();
    expect(mid.cellSize).toBe(20_000); // 4 × 5000
    // an item spanning more than SHELF_CELLS cells sits on the shelf
    mid.insert({ id: 500 }, 0, dop8OfPts([{ x: 0, y: 0 }, { x: 20_000 * 5, y: 20_000 * 5 }]));
    const s = mid.stats().perSheet.find((p) => p.sheet === 0)!;
    expect(s.shelf).toBe(1);
    expect(SHELF_CELLS).toBe(16);
    expect(mid.hits(0, { x0: 90_000, y0: 90_000, x1: 90_001, y1: 90_001 })).toEqual([{ id: 500 }]);
  });
});

describe("Lattice over a synthetic Layout", () => {
  test("buildLattice indexes every item on every Sheet it has copper (or a drill) on; Track legs and Rim edges individually", () => {
    const layout = synthLayout({ seed: 3 });
    const lattice = buildLattice(layout);
    const st = lattice.stats();
    expect(st.items).toBe(layout.pads.length + layout.barrels.length + layout.tracks.length + layout.pours.length + layout.fences.length + 1);
    // every Track leg is found by a query at its midpoint
    for (const t of layout.tracks) {
      for (let leg = 0; leg + 1 < t.pts.length; leg++) {
        const a = t.pts[leg]!, b = t.pts[leg + 1]!;
        const m = { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) };
        const refs = lattice.hits(t.sheet, { x0: m.x, y0: m.y, x1: m.x, y1: m.y });
        expect(refs.some((r) => r.id === t.id && r.leg === leg)).toBe(true);
        expect(lattice.hits((t.sheet + 1) % 4, { x0: m.x, y0: m.y, x1: m.x, y1: m.y }).some((r) => r.id === t.id)).toBe(false);
      }
    }
    // every Pad on each of its Sheets and on every Sheet its drill passes through (DR-06a), and not on others
    let drillOnly = 0;
    for (const p of layout.pads) {
      const d = drillOfPad(layout, p);
      for (const s of layout.stack) {
        const refs = lattice.hits(s.id, { x0: p.at.x, y0: p.at.y, x1: p.at.x, y1: p.at.y });
        const copper = p.sheets.includes(s.id);
        const hole = d !== undefined && s.id >= d.fromSheet && s.id <= d.toSheet;
        expect(refs.some((r) => r.id === p.id)).toBe(copper || hole);
        if (hole && !copper) { drillOnly++; expect(lattice.shapesOf(p.id, s.id)).toEqual([]); }
      }
    }
    expect(drillOnly).toBeGreaterThan(0); // the `th-outer` form: copper on the outer Sheets, hole through the inner ones
    // every Barrel on the Sheets of its span and of its drill, and not on others
    for (const b of layout.barrels) {
      const d = drillOfBarrel(layout, b);
      const copper = barrelSheets(layout, b);
      for (const s of layout.stack) {
        const refs = lattice.hits(s.id, { x0: b.at.x, y0: b.at.y, x1: b.at.x, y1: b.at.y });
        const hole = d !== undefined && s.id >= d.fromSheet && s.id <= d.toSheet;
        expect(refs.some((r) => r.id === b.id)).toBe(copper.includes(s.id) || hole);
      }
    }
    // the Rim's edges on every Sheet, with legs
    const rimEdges = layout.rim!.outline.length + layout.rim!.cutouts[0]!.length;
    for (const s of layout.stack) {
      const refs = lattice.hits(s.id, { x0: -1e7, y0: -1e7, x1: 1e7, y1: 1e7 }, (r) => r.id === RIM_ID);
      expect(refs.length).toBe(rimEdges);
      expect(refs.map((r) => r.leg)).toEqual([...Array(rimEdges).keys()]);
    }
    // an "all-signal" Fence is on every signal Sheet and on no plane Sheet
    const fence = layout.fences.find((f) => f.sheet === "all-signal")!;
    const probe = { x0: -200000, y0: 170000, x1: -200000, y1: 170000 };
    for (const s of layout.stack) expect(lattice.hits(s.id, probe).some((r) => r.id === fence.id)).toBe(s.role === "signal");
    // removeItem drops every leg; insertItem brings them back
    const t0 = layout.tracks[0]!;
    lattice.removeItem(t0.id);
    expect(lattice.itemOf(t0.id)).toBeUndefined();
    expect(lattice.hits(t0.sheet, { x0: -1e7, y0: -1e7, x1: 1e7, y1: 1e7 }, (r) => r.id === t0.id)).toEqual([]);
    lattice.insertItem("track", t0);
    expect(lattice.hits(t0.sheet, { x0: -1e7, y0: -1e7, x1: 1e7, y1: 1e7 }, (r) => r.id === t0.id).length).toBe(t0.pts.length - 1);
    expect(lattice.itemOf(t0.id)?.cat).toBe("track");
  });
});
