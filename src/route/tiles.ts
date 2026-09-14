/**
 * Tiles — a corner-stitched decomposition of one `(Sheet, Profile)`'s free space into maximal
 * rectangular free tiles (docs/DESIGN.md §9b-2). Literature: Ousterhout (1984) "Corner stitching:
 * a data-structuring technique for VLSI layout tools" — space tiles as maximal horizontal strips;
 * Dion & Monier (1995) "Contour: a tile-based gridless router" — decomposing free space into cells
 * a search walks so a route threads a channel a uniform grid is too coarse to represent.
 *
 * The plane of one Sheet is cut into horizontal bands at every obstacle edge; inside a band each
 * obstacle either covers the band's whole y-range or misses it, so the free x-intervals of a band
 * are exact and each becomes a rectangle that is *maximal in x* — the canonical corner-stitching
 * space tile. Vertically-contiguous rectangles that share an x-interval are merged, so a clear
 * corridor beside one tall obstacle is a single tile, not a stack. Obstacles are the Dop8-expanded
 * Lattice hits: each blocking item's copper bounds on the Sheet expanded by `halfWidth + spacing`,
 * so a *free tile is a set of clear centreline positions* — a Track centred anywhere inside it
 * keeps its clearance, and a positive-width portal between two tiles is exactly "wide enough for
 * the width" (the width and its clearances were already subtracted by the expansion). The Rim is
 * handled by clipping the region to its bounding box and by the exact re-check downstream.
 *
 * This is a *proposal generator*, like the Quilt: expanding conservatively (an item's AABB, the
 * larger Dop8 box) can only shrink free space, so the channel router (src/route/channel.ts) that
 * walks these tiles may miss a route but can never propose copper that violates — every leg it
 * produces is still legalised and re-checked with the exact `sweepClear` predicate before it
 * reaches the Journal (R-1/R-2 by construction, docs/DESIGN.md §9b).
 *
 * The field is built lazily (only when the detailed rung is reached) over one connection's region
 * and bounded by `detailedMaxTiles`: past the budget the field reports `overBudget` and the caller
 * declines, so a pathological region cannot blow up. Determinism: bands and intervals in ascending
 * coordinate order, tiles numbered in that order, neighbours returned ascending.
 *
 * Public surface: Tile, Portal, TileField, TileFieldOptions, buildTileField.
 */
import type { Layout, Pt } from "../../spec/types/layout.ts";
import type { Box } from "../geom/index.ts";
import { boxExpand } from "../geom/index.ts";
import type { Lattice } from "../lattice/index.ts";
import { RIM_ID, boundsOfShapes } from "../lattice/index.ts";
import type { IgnoreSet } from "./clear.ts";
import type { Profile } from "./profile.ts";

/** One maximal free rectangle. `id` is its index in the field's tile list. */
export interface Tile { id: number; box: Box }

/** A shared horizontal edge between two vertically-adjacent free tiles. */
export interface Portal {
  /** Left and right x of the overlap, the shared y, and the overlap length (> 0). */
  lo: number;
  hi: number;
  at: number;
  width: number;
  /** Integer midpoint of the portal: a clear centreline waypoint from one tile to the other. */
  mid: Pt;
}

export interface TileField {
  readonly sheet: number;
  readonly region: Box;
  /** True when the decomposition hit the `detailedMaxTiles` budget (the caller should decline). */
  readonly overBudget: boolean;
  /** Every free tile, in ascending band-then-x order. */
  tiles(): readonly Tile[];
  /** Number of tiles decided. */
  count(): number;
  /** The free tile containing `p` (inclusive of its edges), or undefined when `p` is blocked. */
  tileAt(p: Pt): Tile | undefined;
  /** Ids of the tiles sharing a positive-length edge with tile `id`, ascending. */
  freeNeighbours(id: number): number[];
  /** The shared edge between tiles `a` and `b`, or undefined when they are not adjacent. */
  portal(a: number, b: number): Portal | undefined;
}

export interface TileFieldOptions {
  /** The connection's own items and net (their copper is not an obstacle). */
  ignore?: IgnoreSet | undefined;
  /** Copper width for the expansion (default `profile.width`). */
  width?: number | undefined;
  /** Upper bound on tiles before the field reports `overBudget` (default 20000). */
  maxTiles?: number | undefined;
}

const DEFAULT_MAX_TILES = 20_000;

/** Intersect two boxes; undefined when the overlap has no positive area. */
function clipBox(a: Box, b: Box): Box | undefined {
  const x0 = Math.max(a.x0, b.x0), y0 = Math.max(a.y0, b.y0);
  const x1 = Math.min(a.x1, b.x1), y1 = Math.min(a.y1, b.y1);
  return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : undefined;
}

/**
 * Collect the Dop8-expanded obstacle boxes on `sheet` within `region`. Mirrors the blocking
 * decisions of src/route/clear.ts `hitBlocks` at box granularity: same-net copper, ordinary
 * Pours, `place` Fences and Kind-0 signal copper never push a route; a Prior Pour, a `track` /
 * `barrel` Fence and other-net Pad / Barrel / Track copper do, each expanded by
 * `halfWidth + spacing(trackKind, itemKind, sheet)` (a Kind-0 wall Fence by `halfWidth` only).
 * Missing or over-including an obstacle only changes which routes are *proposed*; the exact
 * re-check downstream is the DRC gate, so R-1 is unaffected either way.
 */
function collectObstacles(
  layout: Layout, lattice: Lattice, sheet: number, region: Box, profile: Profile, ignore: IgnoreSet, halfWidth: number,
): Box[] {
  const table = layout.spacing;
  const out: Box[] = [];
  const sameNet = (n: number | null | undefined): boolean =>
    n !== undefined && n !== null && ignore.net !== null && n === ignore.net;
  for (const ref of lattice.hits(sheet, region)) {
    if (ref.id === RIM_ID || ignore.ids.has(ref.id)) continue;
    const entry = lattice.itemOf(ref.id);
    if (!entry) continue;
    const item = entry.item as { net?: number | null; kind?: number; origin?: string; scope?: string };
    if (sameNet(item.net)) continue;
    let margin: number | undefined;
    switch (entry.cat) {
      case "pour": {
        if (item.origin !== "prior") continue; // ordinary Pours never block (K-05, L-07)
        if (item.kind === 0 || item.kind === undefined) continue;
        margin = halfWidth + table.get(profile.trackKind, item.kind, sheet);
        break;
      }
      case "fence": {
        if (item.scope === "place") continue;
        if (item.scope === "barrel") continue; // a `barrel` Fence blocks Barrels only, not a Track
        margin = item.kind === 0 || item.kind === undefined
          ? halfWidth // a Kind-0 wall: copper must merely not touch it (DR-03, Q-I3-22)
          : halfWidth + table.get(profile.trackKind, item.kind, sheet);
        break;
      }
      case "pad": case "barrel": case "track": {
        if (item.kind === 0 || item.kind === undefined) continue; // Kind-0 copper never pushes (C-01)
        margin = halfWidth + table.get(profile.trackKind, item.kind, sheet);
        break;
      }
      default: continue;
    }
    const b = boundsOfShapes(lattice.shapesOf(ref.id, sheet, ref.leg));
    if (!b) continue;
    const clipped = clipBox(boxExpand(b, margin), region);
    if (clipped) out.push(clipped);
  }
  return out;
}

/** The free x-intervals of `[x0, x1]` minus the covering intervals (each `[a, b]`), ascending. */
function freeIntervals(x0: number, x1: number, covers: Array<[number, number]>): Array<[number, number]> {
  if (covers.length === 0) return x0 < x1 ? [[x0, x1]] : [];
  covers.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const out: Array<[number, number]> = [];
  let cursor = x0;
  for (const [a, b] of covers) {
    const lo = Math.max(a, x0), hi = Math.min(b, x1);
    if (hi <= cursor) continue;
    if (lo > cursor) out.push([cursor, lo]);
    cursor = Math.max(cursor, hi);
  }
  if (cursor < x1) out.push([cursor, x1]);
  return out;
}

/**
 * Decompose `region` minus the obstacle boxes into maximal free rectangles: horizontal bands cut
 * at every obstacle edge, each band's free x-intervals maximal, vertically-contiguous equal
 * intervals merged. Stops and flags `over` once the tile count would exceed `maxTiles`.
 */
function decompose(region: Box, obstacles: readonly Box[], maxTiles: number): { tiles: Tile[]; over: boolean } {
  // Band boundaries: the region's y-range plus every obstacle edge strictly inside it.
  const ySet = new Set<number>([region.y0, region.y1]);
  for (const o of obstacles) {
    if (o.y0 > region.y0 && o.y0 < region.y1) ySet.add(o.y0);
    if (o.y1 > region.y0 && o.y1 < region.y1) ySet.add(o.y1);
  }
  const ys = [...ySet].sort((a, b) => a - b);

  const tiles: Tile[] = [];
  // Rectangles still growing upward from a lower band, keyed by their exact x-interval.
  let open: Array<{ x0: number; x1: number; y0: number }> = [];
  let over = false;
  const emit = (r: { x0: number; x1: number; y0: number }, y1: number): void => {
    if (tiles.length >= maxTiles) { over = true; return; }
    tiles.push({ id: tiles.length, box: { x0: r.x0, y0: r.y0, x1: r.x1, y1 } });
  };

  for (let i = 0; i < ys.length - 1 && !over; i++) {
    const yb = ys[i]!, yt = ys[i + 1]!;
    // Obstacles that cover this band's whole y-range project to covering x-intervals.
    const covers: Array<[number, number]> = [];
    for (const o of obstacles) {
      if (o.y0 <= yb && o.y1 >= yt) covers.push([o.x0, o.x1]);
    }
    const intervals = freeIntervals(region.x0, region.x1, covers);

    const nextOpen: Array<{ x0: number; x1: number; y0: number }> = [];
    const matched = new Array<boolean>(open.length).fill(false);
    for (const [a, b] of intervals) {
      let k = -1;
      for (let j = 0; j < open.length; j++) {
        if (!matched[j] && open[j]!.x0 === a && open[j]!.x1 === b) { k = j; break; }
      }
      if (k >= 0) { matched[k] = true; nextOpen.push(open[k]!); }
      else nextOpen.push({ x0: a, x1: b, y0: yb });
    }
    // Rectangles that did not continue into this band end at the band's bottom.
    for (let j = 0; j < open.length && !over; j++) if (!matched[j]) emit(open[j]!, yb);
    open = nextOpen;
    if (over) break;
  }
  for (const r of open) { if (over) break; emit(r, region.y1); }
  return { tiles, over };
}

/**
 * Build the corner-stitched tile field for `sheet` and `profile` over `region`. Lazy — called only
 * when the detailed rung fires. Bounded by `opts.maxTiles`.
 */
export function buildTileField(
  layout: Layout, lattice: Lattice, sheet: number, profile: Profile, region: Box, opts: TileFieldOptions = {},
): TileField {
  const ignore = opts.ignore ?? { ids: new Set<number>(), net: profile.net };
  const halfWidth = (opts.width ?? profile.width) / 2;
  const maxTiles = opts.maxTiles ?? DEFAULT_MAX_TILES;
  const clipped = clampToRim(layout, region);

  const obstacles = collectObstacles(layout, lattice, sheet, clipped, profile, ignore, halfWidth);
  const { tiles, over } = decompose(clipped, obstacles, maxTiles);

  // Adjacency: two tiles share a horizontal edge when one's top y equals the other's bottom y and
  // their x-intervals overlap by a positive length. Index tiles by their bottom edge so each shared
  // edge is discovered once (tile below `t` looks up tiles whose bottom equals `t`'s top).
  const byBottom = new Map<number, number[]>();
  for (const t of tiles) (byBottom.get(t.box.y0) ?? byBottom.set(t.box.y0, []).get(t.box.y0)!).push(t.id);
  const adj: number[][] = tiles.map(() => []);
  for (const t of tiles) {
    for (const uid of byBottom.get(t.box.y1) ?? []) {
      const u = tiles[uid]!;
      const lo = Math.max(t.box.x0, u.box.x0), hi = Math.min(t.box.x1, u.box.x1);
      if (hi > lo) { adj[t.id]!.push(uid); adj[uid]!.push(t.id); }
    }
  }
  for (const list of adj) list.sort((a, b) => a - b);

  const tileAt = (p: Pt): Tile | undefined => {
    for (const t of tiles) {
      if (p.x >= t.box.x0 && p.x <= t.box.x1 && p.y >= t.box.y0 && p.y <= t.box.y1) return t;
    }
    return undefined;
  };

  const portal = (a: number, b: number): Portal | undefined => {
    const ta = tiles[a], tb = tiles[b];
    if (!ta || !tb) return undefined;
    let at: number;
    if (ta.box.y1 === tb.box.y0) at = ta.box.y1;
    else if (ta.box.y0 === tb.box.y1) at = ta.box.y0;
    else return undefined;
    const lo = Math.max(ta.box.x0, tb.box.x0), hi = Math.min(ta.box.x1, tb.box.x1);
    if (hi <= lo) return undefined;
    return { lo, hi, at, width: hi - lo, mid: { x: Math.round((lo + hi) / 2), y: at } };
  };

  return {
    sheet,
    region: clipped,
    overBudget: over,
    tiles: () => tiles,
    count: () => tiles.length,
    tileAt,
    freeNeighbours: (id: number): number[] => (adj[id] ?? []).slice(),
    portal,
  };
}

/** Clip `region` to the Rim's bounding box, keeping it non-empty (copper must stay on the board). */
function clampToRim(layout: Layout, region: Box): Box {
  if (!layout.rim || layout.rim.outline.length < 2) return region;
  let rx0 = Infinity, ry0 = Infinity, rx1 = -Infinity, ry1 = -Infinity;
  for (const p of layout.rim.outline) {
    rx0 = Math.min(rx0, p.x); ry0 = Math.min(ry0, p.y); rx1 = Math.max(rx1, p.x); ry1 = Math.max(ry1, p.y);
  }
  const clipped = clipBox(region, { x0: rx0, y0: ry0, x1: rx1, y1: ry1 });
  return clipped ?? region;
}
