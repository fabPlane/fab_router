/**
 * `src/lattice` — the spatial index (docs/DESIGN.md §4): a per-Sheet uniform bucket grid plus an
 * oversize shelf. Literature for contrast: Guttman (1984) R-trees / Beckmann et al. (1990) R*-tree;
 * a grid is chosen because item sizes cluster and insertion order must not affect results.
 *
 * This file fixes the surface later tasks implement (I3). Only types live here for now.
 *
 * Public surface: LatticeItemRef, LatticeFilter, Lattice (interface).
 */
import type { Box, Dop8 } from "../geom/index.ts";

/** What a query returns: the item id and, for a Track, the index of the leg that was hit. */
export interface LatticeItemRef { id: number; leg?: number }
export type LatticeFilter = (ref: LatticeItemRef) => boolean;

export interface Lattice {
  /** Items on `sheet` whose bounds intersect `box`, ascending id order, deduplicated. */
  hits(sheet: number, box: Box, filter?: LatticeFilter): LatticeItemRef[];
  /** Items on `sheet` whose 8-DOP intersects `dop8` (a swept 45° leg), ascending id order. */
  sweepHits(sheet: number, dop8: Dop8, filter?: LatticeFilter): LatticeItemRef[];
  insert(ref: LatticeItemRef, sheet: number, bounds: Dop8): void;
  remove(ref: LatticeItemRef, sheet: number): void;
}
