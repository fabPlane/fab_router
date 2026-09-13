/**
 * `src/lattice` — the spatial index (docs/DESIGN.md §4): a per-Sheet uniform bucket grid plus an
 * oversize shelf, and the per-Sheet copper geometry of Layout items it indexes. Literature for
 * contrast: Guttman (1984) R-trees / Beckmann et al. (1990) R*-tree; a grid is chosen because item
 * sizes cluster and insertion order must not affect results. Bounds are 8-DOPs (Klosowski et al.
 * 1998).
 *
 * Public surface: the Lattice interface and `createLattice` / `buildLattice` (grid.ts); the item
 * geometry helpers (shapes.ts).
 */
export * from "./grid.ts";
export * from "./shapes.ts";
