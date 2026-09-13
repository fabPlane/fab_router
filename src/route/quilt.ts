/**
 * Quilt — the router's lazily built free-space decomposition of one Sheet for one Profile
 * (docs/DESIGN.md §6; glossary "Quilt / Patch / Seam"). Literature: Finkel & Bentley (1974)
 * adaptive quadtrees for the composite spatial key, and the gridless free-space tiling of Dion &
 * Monier (1995) Contour for the idea of decomposing free space into cells the search walks.
 *
 * This milestone (I4) uses the coarsest, non-subdivided form of that decomposition: a uniform
 * lattice of square Patches on a fixed grid `(origin, step)`, each Patch decided "free" lazily by
 * a Lattice clearance query (src/route/clear.ts `pointFree`, the Dop8 expansion by
 * `halfWidth + spacing` is inside `sweepClear`). Patches are Morton-keyed so the cache is a plain
 * integer map, and a region is invalidated when the Journal changes copper there. A finer
 * quadtree can replace the uniform step later without changing the search's view: it only asks
 * `state(gx, gy)` and `neighbours`. The Quilt only proposes; every leg is still re-checked exactly
 * before insertion, so a coarse Patch can cause a miss but never a violation (docs/DESIGN.md §6).
 *
 * Public surface: PatchState, Quilt, createQuilt, mortonKey, GridPoint.
 */
import type { Box, Pt } from "../geom/index.ts";
import type { Layout } from "../../spec/types/layout.ts";
import type { Lattice } from "../lattice/index.ts";
import { pointFree, ignoreOf, type IgnoreSet } from "./clear.ts";
import type { Profile } from "./profile.ts";

export type PatchState = "unknown" | "free" | "blocked";

/** A grid cell address (integer indices relative to the Quilt origin). */
export interface GridPoint { gx: number; gy: number }

/** Interleave two 16-bit-ish non-negative integers into one Morton key (Finkel & Bentley 1974). */
export function mortonKey(gx: number, gy: number): number {
  // Shift into a non-negative range, then pack; the router's grids never exceed ~2^20 cells a side.
  const x = gx + 0x100000;
  const y = gy + 0x100000;
  return x * 0x400000 + y; // simple, collision-free pairing within the shifted range
}

export interface Quilt {
  readonly sheet: number;
  readonly step: number;
  readonly origin: Pt;
  /** LU point at the centre of a grid cell. */
  pointOf(gx: number, gy: number): Pt;
  /** Nearest grid cell to an LU point. */
  cellOf(p: Pt): GridPoint;
  /** Is the Patch centred at `(gx, gy)` free for the Profile's copper? Cached. */
  state(gx: number, gy: number): PatchState;
  /** True when the Patch is free (computes it if unknown). */
  isFree(gx: number, gy: number): boolean;
  /** Drop cached decisions overlapping `box` (called after a Journal change). */
  invalidate(box: Box): void;
  /** Number of Patches decided so far (diagnostics / tests). */
  decided(): number;
}

export interface QuiltOptions {
  ignore?: IgnoreSet;
  /** Copper width used for the point-clearance test (default `profile.width`). */
  width?: number;
}

/** Build a Quilt for `sheet` and `profile` on a fixed `(origin, step)` grid. */
export function createQuilt(layout: Layout, lattice: Lattice, sheet: number, profile: Profile, origin: Pt, step: number, opts: QuiltOptions = {}): Quilt {
  const cache = new Map<number, PatchState>();
  const ignore = opts.ignore ?? ignoreOf(profile.net);
  const width = opts.width ?? profile.width;
  const st = Math.max(1, Math.round(step));

  const pointOf = (gx: number, gy: number): Pt => ({ x: origin.x + gx * st, y: origin.y + gy * st });
  const cellOf = (p: Pt): GridPoint => ({ gx: Math.round((p.x - origin.x) / st), gy: Math.round((p.y - origin.y) / st) });

  function state(gx: number, gy: number): PatchState {
    const key = mortonKey(gx, gy);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const free = pointFree(layout, lattice, sheet, pointOf(gx, gy), profile, ignore, width).ok;
    const s: PatchState = free ? "free" : "blocked";
    cache.set(key, s);
    return s;
  }

  function isFree(gx: number, gy: number): boolean {
    return state(gx, gy) === "free";
  }

  function invalidate(box: Box): void {
    if (cache.size === 0) return;
    const gx0 = Math.floor((box.x0 - origin.x) / st) - 1;
    const gx1 = Math.ceil((box.x1 - origin.x) / st) + 1;
    const gy0 = Math.floor((box.y0 - origin.y) / st) - 1;
    const gy1 = Math.ceil((box.y1 - origin.y) / st) + 1;
    // A whole-region invalidation is cheaper than scanning when the box is large.
    if ((gx1 - gx0 + 1) * (gy1 - gy0 + 1) > cache.size) {
      cache.clear();
      return;
    }
    for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) cache.delete(mortonKey(gx, gy));
  }

  return { sheet, step: st, origin, pointOf, cellOf, state, isFree, invalidate, decided: () => cache.size };
}
