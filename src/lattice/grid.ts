/**
 * The Lattice: a per-Sheet uniform bucket grid with an oversize shelf (docs/DESIGN.md §4).
 *
 * Why a grid and not a tree: item counts are 10^4–10^5 with clustered sizes and the queries are
 * clearance-expanded boxes of the same scale, so a grid answers in O(cells touched + hits) with
 * no balancing and — the property that matters for rip-up churn — no dependence on insertion
 * history. Guttman (1984) R-trees and Beckmann et al. (1990) R*-trees were considered and
 * rejected for that reason. Bounds are 8-DOPs (Klosowski et al. 1998), so a swept 45° leg is
 * filtered by its diagonal slabs as well as its box.
 *
 * Layout of the index:
 *   - Every indexed thing is a *slot*: (item id, leg or −1, Sheet, 8-DOP), stored struct-of-arrays.
 *     Track legs and Rim edges are one slot each; a Pad is one slot per Sheet it has copper on.
 *   - Per Sheet: a hash of cell key → slot list, plus the shelf for slots spanning more than
 *     SHELF_CELLS cells. Cells are `floor(coord / cellSize)`; the grid is unbounded.
 *   - A query stamps each slot it sees with the query generation, so a slot reachable from
 *     several cells is reported once without allocating a Set; the result is sorted by (id, leg)
 *     so it never depends on the order slots were inserted.
 *   - Cell size = clamp(4 × median slot diagonal, 0.5 mm, 5 mm), chosen when the index is built
 *     and again when a shelf overflows (amortised: a rebuild is allowed only once the live slot
 *     count has doubled since the last one).
 *
 * Besides the raw `insert(ref, sheet, dop8)` / `remove(ref, sheet)` surface used by the
 * property tests, the Lattice indexes Layout items by category (`insertItem` / `removeItem`),
 * keeps a directory id → item so clearance queries can fetch the copper of a hit, and caches
 * each item's per-Sheet shapes lazily. An item that changes geometry must be removed and
 * re-inserted; the directory holds the object as inserted.
 *
 * Public surface: RIM_ID, SHELF_CELLS, LatticeStats, IndexedItem, Lattice (interface),
 * createLattice, buildLattice.
 */
import type { Barrel, Fence, Layout, Pad, Pour, Rim, Track } from "../../spec/types/layout.ts";
import type { Box, Dop8, Shape } from "../geom/index.ts";
import type { ItemCat } from "./shapes.ts";
import {
  barrelBoundsOn, barrelShapesOn, barrelSheets, fenceBounds, fenceShape, padBoundsOn, padShapesOn, pourBounds, pourShape,
  rimLegBounds, rimLegCount, rimLegShape, trackLegBounds, trackLegCount, trackLegShape,
} from "./shapes.ts";

/** What a query returns: the item id and, for a Track or the Rim, the index of the leg hit. */
export interface LatticeItemRef { id: number; leg?: number }
export type LatticeFilter = (ref: LatticeItemRef) => boolean;

/** The id under which the Rim's edges are indexed (the Rim has no item id of its own). */
export const RIM_ID = -1;
/** A slot spanning more than this many cells goes on the Sheet's shelf. */
export const SHELF_CELLS = 16;

export type LatticeItem = Pad | Barrel | Track | Pour | Fence | Rim;
export interface IndexedItem { cat: ItemCat; item: LatticeItem }

export interface LatticeStats {
  cellSize: number;
  slots: number;
  items: number;
  rebuilds: number;
  perSheet: Array<{ sheet: number; slots: number; shelf: number; cells: number }>;
}

export interface Lattice {
  /** Items on `sheet` whose bounds intersect `box`, ascending (id, leg) order, deduplicated. */
  hits(sheet: number, box: Box, filter?: LatticeFilter): LatticeItemRef[];
  /** Items on `sheet` whose 8-DOP intersects `dop8` (a swept 45° leg), ascending (id, leg) order. */
  sweepHits(sheet: number, dop8: Dop8, filter?: LatticeFilter): LatticeItemRef[];
  /** Index one slot. Inserting an existing (ref, sheet) replaces its bounds. */
  insert(ref: LatticeItemRef, sheet: number, bounds: Dop8): void;
  /** Drop one slot; a no-op when absent. */
  remove(ref: LatticeItemRef, sheet: number): void;
  /** Index a Layout item on every Sheet it has copper on (Track legs and Rim edges individually). */
  insertItem(cat: ItemCat, item: LatticeItem): void;
  /** Drop every slot of an item id (all legs, all Sheets) and forget it. */
  removeItem(id: number): void;
  /** The item behind an id, as inserted through `insertItem`. */
  itemOf(id: number): IndexedItem | undefined;
  /** Copper of an indexed item on `sheet` (a Track's leg / a Rim edge when `leg` is given); cached. */
  shapesOf(id: number, sheet: number, leg?: number): readonly Shape[];
  /** Re-bucket everything with a cell size from the current median slot diagonal (or the given size). */
  rebuild(cellSize?: number): void;
  stats(): LatticeStats;
  readonly cellSize: number;
}

export interface LatticeOptions {
  /** LU per micrometre, for the cell-size clamps (default: the Layout's Frame). */
  luPerUm?: number;
  /** Initial cell size in LU (default 1 mm). */
  cellSize?: number;
}

interface SheetGrid {
  cells: Map<number, number[]>;
  shelf: number[];
  count: number;
  cx0: number; cx1: number; cy0: number; cy1: number; // occupied cell range
}

const NO_LEG = -1;
const KEY_OFFSET = 1 << 25;   // cell coordinates are shifted to be non-negative
const KEY_STRIDE = 1 << 26;   // (cx + offset) * stride + (cy + offset) < 2^53
const SHAPE_KEY_SHEETS = 4096; // sheet ids below this pack with the leg into one cache key

/** Build an empty Lattice bound to `layout` (items are inserted through `insertItem`). */
export function createLattice(layout: Layout, opts: LatticeOptions = {}): Lattice {
  const luPerUm = opts.luPerUm ?? layout.frame.luPerUm;
  const minCell = Math.max(1, Math.round(500 * luPerUm));   // 0.5 mm
  const maxCell = Math.max(minCell, Math.round(5000 * luPerUm)); // 5 mm
  let cellSize = Math.max(1, Math.round(opts.cellSize ?? 1000 * luPerUm));

  // ---- slots (struct of arrays) ----
  const sId: number[] = [], sLeg: number[] = [], sSheet: number[] = [];
  const sX0: number[] = [], sY0: number[] = [], sX1: number[] = [], sY1: number[] = [];
  const sS0: number[] = [], sS1: number[] = [], sD0: number[] = [], sD1: number[] = [];
  const sStamp: number[] = [], sShelf: boolean[] = [], sLive: boolean[] = [];
  const freeSlots: number[] = [];
  let live = 0, countAtBuild = 0, rebuilds = 0, gen = 0;

  const sheets = new Map<number, SheetGrid>();
  const slotsOf = new Map<number, number[]>(); // item id → its slots
  const directory = new Map<number, IndexedItem & { cache: Map<number, readonly Shape[]> }>();

  function gridOf(sheet: number): SheetGrid {
    let g = sheets.get(sheet);
    if (!g) {
      g = { cells: new Map(), shelf: [], count: 0, cx0: Infinity, cx1: -Infinity, cy0: Infinity, cy1: -Infinity };
      sheets.set(sheet, g);
    }
    return g;
  }
  const cellOf = (v: number): number => Math.floor(v / cellSize);
  const keyOf = (cx: number, cy: number): number => (cx + KEY_OFFSET) * KEY_STRIDE + (cy + KEY_OFFSET);

  function bucket(slot: number): void {
    const g = gridOf(sSheet[slot]!);
    g.count++;
    const cx0 = cellOf(sX0[slot]!), cx1 = cellOf(sX1[slot]!), cy0 = cellOf(sY0[slot]!), cy1 = cellOf(sY1[slot]!);
    if ((cx1 - cx0 + 1) * (cy1 - cy0 + 1) > SHELF_CELLS) {
      sShelf[slot] = true;
      g.shelf.push(slot);
      return;
    }
    sShelf[slot] = false;
    if (cx0 < g.cx0) g.cx0 = cx0; if (cx1 > g.cx1) g.cx1 = cx1;
    if (cy0 < g.cy0) g.cy0 = cy0; if (cy1 > g.cy1) g.cy1 = cy1;
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const k = keyOf(cx, cy);
        const list = g.cells.get(k);
        if (list) list.push(slot); else g.cells.set(k, [slot]);
      }
    }
  }

  function unbucket(slot: number): void {
    const g = sheets.get(sSheet[slot]!);
    if (!g) return;
    g.count--;
    if (sShelf[slot]) {
      const i = g.shelf.indexOf(slot);
      if (i >= 0) { g.shelf[i] = g.shelf[g.shelf.length - 1]!; g.shelf.pop(); }
      return;
    }
    const cx0 = cellOf(sX0[slot]!), cx1 = cellOf(sX1[slot]!), cy0 = cellOf(sY0[slot]!), cy1 = cellOf(sY1[slot]!);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const k = keyOf(cx, cy);
        const list = g.cells.get(k);
        if (!list) continue;
        const i = list.indexOf(slot);
        if (i >= 0) { list[i] = list[list.length - 1]!; list.pop(); }
        if (list.length === 0) g.cells.delete(k);
      }
    }
  }

  function findSlot(id: number, leg: number, sheet: number): number {
    const list = slotsOf.get(id);
    if (!list) return -1;
    for (const s of list) if (sLeg[s] === leg && sSheet[s] === sheet) return s;
    return -1;
  }

  function allocSlot(id: number, leg: number, sheet: number, b: Dop8): number {
    const slot = freeSlots.length ? freeSlots.pop()! : sId.length;
    sId[slot] = id; sLeg[slot] = leg; sSheet[slot] = sheet;
    sX0[slot] = b.x0; sY0[slot] = b.y0; sX1[slot] = b.x1; sY1[slot] = b.y1;
    sS0[slot] = b.s0; sS1[slot] = b.s1; sD0[slot] = b.d0; sD1[slot] = b.d1;
    sStamp[slot] = 0; sShelf[slot] = false; sLive[slot] = true;
    const list = slotsOf.get(id);
    if (list) list.push(slot); else slotsOf.set(id, [slot]);
    live++;
    return slot;
  }

  function releaseSlot(slot: number): void {
    const list = slotsOf.get(sId[slot]!);
    if (list) {
      const i = list.indexOf(slot);
      if (i >= 0) { list[i] = list[list.length - 1]!; list.pop(); }
      if (list.length === 0) slotsOf.delete(sId[slot]!);
    }
    sLive[slot] = false;
    freeSlots.push(slot);
    live--;
  }

  function insertRaw(id: number, leg: number, sheet: number, b: Dop8): void {
    if (!(b.x0 <= b.x1 && b.y0 <= b.y1)) return; // empty bounds: nothing to index
    const existing = findSlot(id, leg, sheet);
    if (existing >= 0) { unbucket(existing); releaseSlot(existing); }
    const slot = allocSlot(id, leg, sheet, b);
    bucket(slot);
    maybeRebuild(sheet);
  }

  function removeRaw(id: number, leg: number, sheet: number): void {
    const slot = findSlot(id, leg, sheet);
    if (slot < 0) return;
    unbucket(slot);
    releaseSlot(slot);
  }

  function shelfLimit(): number {
    return 64 + Math.floor(live / 16);
  }

  function maybeRebuild(sheet: number): void {
    const g = sheets.get(sheet);
    if (!g || g.shelf.length <= shelfLimit()) return;
    if (live < 2 * countAtBuild) return; // amortise: at most one rebuild per doubling
    rebuild();
  }

  function medianDiagonal(): number {
    const diags: number[] = [];
    for (let s = 0; s < sId.length; s++) {
      if (!sLive[s]) continue;
      const dx = sX1[s]! - sX0[s]!, dy = sY1[s]! - sY0[s]!;
      diags.push(Math.sqrt(dx * dx + dy * dy));
    }
    if (diags.length === 0) return 0;
    diags.sort((a, b) => a - b);
    return diags[diags.length >> 1]!;
  }

  function rebuild(size?: number): void {
    const wanted = size ?? 4 * medianDiagonal();
    cellSize = Math.max(1, Math.round(Math.min(maxCell, Math.max(minCell, wanted))));
    sheets.clear();
    for (let s = 0; s < sId.length; s++) if (sLive[s]) bucket(s);
    countAtBuild = live;
    rebuilds++;
  }

  function collect(sheet: number, q: Dop8, sweep: boolean, filter: LatticeFilter | undefined): LatticeItemRef[] {
    const out: LatticeItemRef[] = [];
    const g = sheets.get(sheet);
    if (!g) return out;
    gen++;
    const test = (s: number): boolean => {
      if (q.x0 > sX1[s]! || sX0[s]! > q.x1 || q.y0 > sY1[s]! || sY0[s]! > q.y1) return false;
      if (sweep && (q.s0 > sS1[s]! || sS0[s]! > q.s1 || q.d0 > sD1[s]! || sD0[s]! > q.d1)) return false;
      return true;
    };
    const push = (s: number) => {
      const leg = sLeg[s]!;
      const ref: LatticeItemRef = leg === NO_LEG ? { id: sId[s]! } : { id: sId[s]!, leg };
      if (filter && !filter(ref)) return;
      out.push(ref);
    };
    const cx0 = Math.max(cellOf(q.x0), g.cx0), cx1 = Math.min(cellOf(q.x1), g.cx1);
    const cy0 = Math.max(cellOf(q.y0), g.cy0), cy1 = Math.min(cellOf(q.y1), g.cy1);
    if (cx0 <= cx1 && cy0 <= cy1) {
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cy = cy0; cy <= cy1; cy++) {
          const list = g.cells.get(keyOf(cx, cy));
          if (!list) continue;
          for (const s of list) {
            if (sStamp[s] === gen) continue;
            sStamp[s] = gen;
            if (test(s)) push(s);
          }
        }
      }
    }
    for (const s of g.shelf) if (test(s)) push(s);
    out.sort((a, b) => a.id - b.id || (a.leg ?? NO_LEG) - (b.leg ?? NO_LEG));
    return out;
  }

  // ---- items ----
  function signalSheets(): number[] {
    return layout.stack.filter((s) => s.role === "signal").map((s) => s.id);
  }

  function insertItem(cat: ItemCat, item: LatticeItem): void {
    const id = cat === "rim" ? RIM_ID : (item as Exclude<LatticeItem, Rim>).id;
    if (directory.has(id)) removeItem(id);
    directory.set(id, { cat, item, cache: new Map() });
    switch (cat) {
      case "pad": {
        const pad = item as Pad;
        for (const sheet of pad.sheets) {
          const b = padBoundsOn(layout, pad, sheet);
          if (b) insertRaw(id, NO_LEG, sheet, b);
        }
        break;
      }
      case "barrel": {
        const barrel = item as Barrel;
        for (const sheet of barrelSheets(layout, barrel)) {
          const b = barrelBoundsOn(layout, barrel, sheet);
          if (b) insertRaw(id, NO_LEG, sheet, b);
        }
        break;
      }
      case "track": {
        const track = item as Track;
        if (track.pts.length === 0) break;
        const n = trackLegCount(track);
        for (let leg = 0; leg < n; leg++) insertRaw(id, leg, track.sheet, trackLegBounds(track, leg));
        break;
      }
      case "pour": {
        const pour = item as Pour;
        if (pour.outline.length > 0) insertRaw(id, NO_LEG, pour.sheet, pourBounds(pour));
        break;
      }
      case "fence": {
        const fence = item as Fence;
        const b = fenceBounds(fence);
        const targets = fence.sheet === "all-signal" ? signalSheets() : [fence.sheet];
        for (const sheet of targets) insertRaw(id, NO_LEG, sheet, b);
        break;
      }
      case "rim": {
        const rim = item as Rim;
        const n = rimLegCount(rim);
        for (const sheet of layout.stack) {
          for (let leg = 0; leg < n; leg++) {
            const b = rimLegBounds(rim, leg);
            if (b) insertRaw(id, leg, sheet.id, b);
          }
        }
        break;
      }
    }
  }

  function removeItem(id: number): void {
    const list = slotsOf.get(id);
    if (list) for (const slot of list.slice()) { unbucket(slot); releaseSlot(slot); }
    directory.delete(id);
  }

  function shapesOf(id: number, sheet: number, leg?: number): readonly Shape[] {
    const entry = directory.get(id);
    if (!entry) return [];
    const ck = (leg === undefined ? 0 : leg + 1) * SHAPE_KEY_SHEETS + sheet;
    const cached = entry.cache.get(ck);
    if (cached) return cached;
    let shapes: Shape[];
    switch (entry.cat) {
      case "pad": shapes = padShapesOn(layout, entry.item as Pad, sheet); break;
      case "barrel": shapes = barrelShapesOn(layout, entry.item as Barrel, sheet); break;
      case "track": {
        const t = entry.item as Track;
        shapes = t.sheet === sheet && t.pts.length > 0 ? [trackLegShape(t, leg ?? 0)] : [];
        break;
      }
      case "pour": { const p = entry.item as Pour; shapes = p.sheet === sheet ? pourShape(p) : []; break; }
      case "fence": {
        const f = entry.item as Fence;
        const on = f.sheet === "all-signal" ? signalSheets().includes(sheet) : f.sheet === sheet;
        shapes = on ? fenceShape(f) : [];
        break;
      }
      case "rim": { const s = rimLegShape(entry.item as Rim, leg ?? 0); shapes = s ? [s] : []; break; }
    }
    entry.cache.set(ck, shapes);
    return shapes;
  }

  function stats(): LatticeStats {
    const perSheet = [...sheets.entries()].sort((a, b) => a[0] - b[0])
      .map(([sheet, g]) => ({ sheet, slots: g.count, shelf: g.shelf.length, cells: g.cells.size }));
    return { cellSize, slots: live, items: directory.size, rebuilds, perSheet };
  }

  return {
    hits: (sheet, box, filter) => collect(sheet, { ...box, s0: -Infinity, s1: Infinity, d0: -Infinity, d1: Infinity }, false, filter),
    sweepHits: (sheet, dop8, filter) => collect(sheet, dop8, true, filter),
    insert: (ref, sheet, bounds) => insertRaw(ref.id, ref.leg ?? NO_LEG, sheet, bounds),
    remove: (ref, sheet) => removeRaw(ref.id, ref.leg ?? NO_LEG, sheet),
    insertItem,
    removeItem,
    itemOf: (id) => { const e = directory.get(id); return e ? { cat: e.cat, item: e.item } : undefined; },
    shapesOf,
    rebuild,
    stats,
    get cellSize() { return cellSize; },
  };
}

/** Index every item of a Layout (Pads, Barrels, Tracks, Pours, Fences, Rim) with a cell size from the median item diagonal. */
export function buildLattice(layout: Layout, opts: LatticeOptions = {}): Lattice {
  const lattice = createLattice(layout, opts);
  for (const pad of layout.pads) lattice.insertItem("pad", pad);
  for (const barrel of layout.barrels) lattice.insertItem("barrel", barrel);
  for (const track of layout.tracks) lattice.insertItem("track", track);
  for (const pour of layout.pours) lattice.insertItem("pour", pour);
  for (const fence of layout.fences) lattice.insertItem("fence", fence);
  if (layout.rim) lattice.insertItem("rim", layout.rim);
  lattice.rebuild(opts.cellSize);
  return lattice;
}
