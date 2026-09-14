/**
 * Channel — A* over the corner-stitched free-tile adjacency graph (src/route/tiles.ts), the
 * detailed router for locked channels a uniform grid is too coarse for (docs/DESIGN.md §9b-2).
 * Literature: Ousterhout (1984) corner stitching and Dion & Monier (1995) Contour for the gridless
 * tile decomposition the search walks; Hart, Nilsson & Raphael (1968) A* over the tile graph, its
 * frontier the deterministic `(f, h, seq)` binary heap of src/route/search.ts; Nash, Daniel, Koenig
 * & Felner (2007) Theta* for the string-pull (src/route/pull.ts); Hightower (1969) and Mikami &
 * Tabuchi (1968) line search for the refinement fallback (src/route/lineprobe.ts).
 *
 * The centreline runs through portal midpoints: each portal is a positive-width slice of clear
 * centreline space between two tiles (tiles.ts expands obstacles by `halfWidth + spacing`, so the
 * midpoint is the channel's midline and the width was already checked). The tile path is Theta*-
 * pulled to remove the portal-quantisation, then legalised and re-checked leg-by-leg with the exact
 * `sweepClear` predicate; if that misses, the raw portal-midpoint path and finally a line-search
 * refinement between the endpoints are tried before giving up. Every leg and Barrel that reaches
 * the Journal passed the exact predicate and any partial insertion is rewound atomically, so no
 * `held`, `locked` or Prior-copper item is moved and no Violation is added (R-1/R-2, docs/DESIGN.md
 * §9b). Multilayer reuses the Barrel machinery (`dropViaNear` / `pickBarrel` / `barrelFits`).
 *
 * Public surface: ChannelOptions, channelCentre, channelRoute.
 */
import type { Layout, Pt } from "../../spec/types/layout.ts";
import type { Box } from "../geom/index.ts";
import type { Lattice } from "../lattice/index.ts";
import type { Journal } from "./journal.ts";
import { barrelFits, sweepClear, type IgnoreSet } from "./clear.ts";
import { pullPath } from "./pull.ts";
import { legaliseTrail, trackPieces } from "./legalise.ts";
import { dropViaNear, pickBarrel } from "./via.ts";
import { lineProbeCentre } from "./lineprobe.ts";
import { Heap } from "./search.ts";
import { buildTileField, type TileField } from "./tiles.ts";
import type { Profile } from "./profile.ts";

/** Bounds on one channel attempt (spec/api/settings.md `detailed*`). */
export interface ChannelOptions {
  /** Absolute wall-clock deadline (`Date.now()`), polled during the search. */
  deadline?: number | undefined;
  /** Cancellation signal, polled during the search. */
  signal?: AbortSignal | undefined;
  /** Tile budget for one region decomposition (`detailedMaxTiles`). */
  maxTiles?: number | undefined;
}

// How often the tile A* polls the deadline / abort signal (docs/DESIGN.md §7: every ~256 pops).
const POLL_MASK = 0xff;
// A* node-pop cap for one tile search (tiles ≪ grid cells, so this is generous).
const MAX_POPS = 200_000;

type ClearFn = (a: Pt, b: Pt) => boolean;

function dist(a: Pt, b: Pt): number { return Math.hypot(a.x - b.x, a.y - b.y); }

/** The search region: the endpoints' bounding box inflated by their span, keeping both inside. */
function regionOf(from: Pt, to: Pt): Box {
  const bb: Box = {
    x0: Math.min(from.x, to.x), y0: Math.min(from.y, to.y),
    x1: Math.max(from.x, to.x), y1: Math.max(from.y, to.y),
  };
  const inflate = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0, 1);
  return { x0: bb.x0 - inflate, y0: bb.y0 - inflate, x1: bb.x1 + inflate, y1: bb.y1 + inflate };
}

/**
 * A* from the tile holding `from` to the tile holding `to` over `field`, returning the centreline
 * `[from, portal-mid…, to]` or undefined. Cost is the Euclidean length of the portal-midpoint
 * polyline; the heuristic is the straight-line distance from the last waypoint to `to` (admissible).
 */
function tilePath(field: TileField, from: Pt, to: Pt, opts: ChannelOptions): Pt[] | undefined {
  const startTile = field.tileAt(from);
  const goalTile = field.tileAt(to);
  if (!startTile || !goalTile) return undefined;
  if (startTile.id === goalTile.id) return [from, to];

  const gScore = new Map<number, number>();
  const enterPt = new Map<number, Pt>();
  const cameFrom = new Map<number, number>();
  const cameVia = new Map<number, Pt>();
  const heap = new Heap();
  let seq = 0;
  gScore.set(startTile.id, 0);
  enterPt.set(startTile.id, from);
  const h0 = dist(from, to);
  heap.push({ f: h0, h: h0, seq: seq++, state: startTile.id });

  let pops = 0;
  while (heap.size > 0) {
    if ((pops & POLL_MASK) === 0) {
      if (opts.signal?.aborted) return undefined;
      if (opts.deadline !== undefined && Date.now() > opts.deadline) return undefined;
    }
    const node = heap.pop();
    pops++;
    if (pops > MAX_POPS) return undefined;
    const tid = node.state;
    const gCur = gScore.get(tid) ?? Infinity;
    // Skip a stale heap entry (a cheaper path to this tile was found after it was queued).
    if (node.f - node.h > gCur + 1e-6) continue;
    if (tid === goalTile.id) {
      // Reconstruct the portal-midpoint waypoints, then close with `from` … `to`.
      const mids: Pt[] = [];
      for (let s: number | undefined = tid; s !== undefined && s !== startTile.id; s = cameFrom.get(s)) {
        const via = cameVia.get(s);
        if (via) mids.push(via);
      }
      mids.reverse();
      return [from, ...mids, to];
    }
    const ep = enterPt.get(tid)!;
    for (const nb of field.freeNeighbours(tid)) {
      const p = field.portal(tid, nb);
      if (!p || p.width <= 0) continue;
      const g2 = gCur + dist(ep, p.mid);
      if (g2 >= (gScore.get(nb) ?? Infinity)) continue;
      gScore.set(nb, g2);
      enterPt.set(nb, p.mid);
      cameFrom.set(nb, tid);
      cameVia.set(nb, p.mid);
      const h = dist(p.mid, to);
      heap.push({ f: g2 + h, h, seq: seq++, state: nb });
    }
  }
  return undefined;
}

/**
 * A clear single-Sheet channel centreline from `from` to `to` on `sheet`, or undefined. Builds the
 * tile field lazily over the connection's region, runs the tile A*, and returns the raw
 * portal-midpoint centreline (the caller pulls, legalises and re-checks it).
 */
export function channelCentre(
  layout: Layout, lattice: Lattice, sheet: number, from: Pt, to: Pt,
  profile: Profile, ignore: IgnoreSet, opts: ChannelOptions = {},
): Pt[] | undefined {
  const clear: ClearFn = (a, b) => sweepClear(layout, lattice, sheet, { a, b }, profile, ignore, profile.width).ok;
  // Cheap first cuts before decomposing (a straight or L route needs no tiles).
  if (clear(from, to)) return [from, to];

  const field = buildTileField(layout, lattice, sheet, profile, regionOf(from, to), {
    ignore, ...(opts.maxTiles !== undefined ? { maxTiles: opts.maxTiles } : {}),
  });
  if (field.overBudget) return undefined;
  return tilePath(field, from, to, opts);
}

/**
 * Pull → legalise → re-check → insert one single-Sheet centreline, trying the Theta*-pulled path,
 * then the raw path, then a line-search refinement between the endpoints. Journalled and rewound
 * on any block; returns true only when clear copper was inserted.
 */
function insertCentre(
  layout: Layout, lattice: Lattice, journal: Journal, sheet: number, centre: readonly Pt[],
  profile: Profile, ignore: IgnoreSet, opts: ChannelOptions,
): boolean {
  if (centre.length < 2) return true;
  const los: ClearFn = (a, b) => sweepClear(layout, lattice, sheet, { a, b }, profile, ignore, profile.width).ok;
  const candidates: Array<readonly Pt[]> = [pullPath(centre, los), centre];
  const refined = lineProbeCentre(layout, lattice, sheet, centre[0]!, centre[centre.length - 1]!, profile, ignore, {
    ...(opts.deadline !== undefined ? { deadline: opts.deadline } : {}),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
  if (refined) candidates.push(refined);

  for (const pts of candidates) {
    if (pts.length < 2) continue;
    const leg = legaliseTrail(layout, lattice, sheet, pts, profile, ignore, true);
    if (!leg.ok) continue;
    const pieces = trackPieces(leg.pts, leg.widths);
    if (pieces.length === 0) continue;
    // Every leg passed the exact re-check inside `legaliseTrail`, so the inserts cannot violate.
    for (const piece of pieces) {
      if (piece.pts.length < 2) continue;
      journal.addTrack({ net: ignore.net, sheet, pts: piece.pts, width: piece.width, kind: profile.trackKind, hold: "free" });
    }
    return true;
  }
  return false;
}

/**
 * Route `from → to` with the corner-stitched channel router: single-Sheet on every shared usable
 * Sheet first, then (when vias are allowed and no shared Sheet closes it) a one-Barrel bridge — a
 * via dropped near `to` on a `toSheet`, the far Sheet's channel threaded to it. Every leg is
 * pulled, legalised and re-checked before insertion; the whole attempt is rewound atomically on any
 * failure. Returns true when copper was inserted. Mirrors `lineProbeRoute` (src/route/lineprobe.ts).
 */
export function channelRoute(
  layout: Layout, lattice: Lattice, journal: Journal, from: Pt, to: Pt,
  fromSheets: readonly number[], toSheets: readonly number[], viasAllowed: boolean,
  profile: Profile, ignore: IgnoreSet, opts: ChannelOptions = {},
): boolean {
  const aborted = (): boolean => opts.signal?.aborted === true || (opts.deadline !== undefined && Date.now() > opts.deadline);

  const common = fromSheets.filter((s) => toSheets.includes(s)).sort((a, b) => a - b);
  for (const sheet of common) {
    if (aborted()) return false;
    const centre = channelCentre(layout, lattice, sheet, from, to, profile, ignore, opts);
    if (!centre) continue;
    const mark = journal.mark();
    if (insertCentre(layout, lattice, journal, sheet, centre, profile, ignore, opts)) return true;
    journal.rewind(mark);
  }
  if (!viasAllowed || profile.barrelForms.length === 0) return false;

  const luPerUm = layout.frame.luPerUm;
  const maxRadius = Math.max(1, Math.round(2000 * luPerUm)); // up to ~2 mm from the pad
  const froms = [...fromSheets].sort((a, b) => a - b);
  const tos = [...toSheets].sort((a, b) => a - b);
  for (const toSheet of tos) {
    for (const fromSheet of froms) {
      if (fromSheet === toSheet) continue;
      if (aborted()) return false;
      if (!pickBarrel(profile, fromSheet, toSheet)) continue;
      const drop = dropViaNear(layout, lattice, toSheet, fromSheet, to, profile, ignore, maxRadius);
      if (!drop) continue;
      const mark = journal.mark();
      if (!barrelFits(layout, lattice, drop.at, drop.candidate, profile, ignore).ok) { journal.rewind(mark); continue; }
      journal.addBarrel({ net: ignore.net, at: drop.at, form: drop.candidate.form, fromSheet: drop.candidate.fromSheet, toSheet: drop.candidate.toSheet, kind: drop.candidate.kind, hold: "free" });
      if (drop.stub.length >= 2 && !insertCentre(layout, lattice, journal, toSheet, drop.stub, profile, ignore, opts)) { journal.rewind(mark); continue; }
      const centre = channelCentre(layout, lattice, fromSheet, from, drop.at, profile, ignore, opts);
      if (!centre || !insertCentre(layout, lattice, journal, fromSheet, centre, profile, ignore, opts)) { journal.rewind(mark); continue; }
      return true;
    }
  }
  return false;
}
