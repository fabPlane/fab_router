# `src/lattice` — spatial index

A per-Sheet uniform bucket grid with an oversize shelf (`docs/DESIGN.md` §4). Items are indexed by
their 8-DOP bounds (Klosowski et al. 1998), queries are clearance-expanded boxes (`hits`) or swept
45° legs (`sweepHits`), and results come back in ascending `(id, leg)` order with no dependence on
insertion history — which is what rip-up churn and determinism need. Guttman (1984) R-trees and
Beckmann et al. (1990) R*-trees were considered and rejected: item sizes cluster, updates must be
balance-free, and a grid answers in O(cells touched + hits).

| Module | Contents |
|---|---|
| `grid.ts` | `createLattice(layout, opts)`, `buildLattice(layout)`, the `Lattice` interface, `RIM_ID`, `SHELF_CELLS` |
| `shapes.ts` | per-Sheet copper geometry of every item category (Pad placement with rotation and side, Barrel forms, Track legs, Pours, Fences, Rim edges, drills) |

## How the grid works

- Every indexed thing is a *slot*: `(item id, leg or none, Sheet, 8-DOP)`, stored struct-of-arrays.
  A Track is one slot per leg, the Rim one slot per outline / cut-out edge on every Sheet, a Pad or
  Barrel one slot per Sheet it has copper on **or that its drill passes through** (the union of
  both bounds; `spec/rules/drc.md` DR-06a checks the hole on every Sheet of its span, so a hole
  query must find the item even where it has no copper — `shapesOf` is empty there), a Fence on
  its Sheet or on every signal Sheet (`"all-signal"`), a Pour on its Sheet.
- Per Sheet: a hash of cell key → slot list, plus the shelf for slots spanning more than
  `SHELF_CELLS` (16) cells. Cells are `floor(coord / cellSize)`; the grid is unbounded and a query
  only walks the occupied cell range.
- A query stamps each slot it sees with the query generation, so a slot reachable from several
  cells is reported once without allocating a `Set`; the shelf is scanned on every query; the
  result is sorted by `(id, leg)` and the optional filter is applied before collection.
- Cell size = clamp(4 × median slot diagonal, 0.5 mm, 5 mm) in LU, chosen by `buildLattice` and
  again by `rebuild()` when a Sheet's shelf overflows `64 + slots / 16` — allowed at most once per
  doubling of the live slot count, so the cost is amortised.
- Re-inserting an existing `(ref, Sheet)` replaces its bounds; removing an unknown one is a no-op.

## Item directory

`insertItem(cat, item)` computes the item's bounds per Sheet from `shapes.ts` and remembers the
item object under its id (`itemOf`); `shapesOf(id, sheet, leg?)` returns its copper on a Sheet as
`src/geom` shapes, computed lazily and cached per `(Sheet, leg)`. An item whose geometry changes
must be removed and re-inserted (the Journal does that anyway). The Rim, which has no id, is
indexed as `RIM_ID = −1`.

## Geometry conventions (`shapes.ts`)

- A Pad's copper on Sheet `s` comes from its PadForm's shapes on the form Sheet behind `s`: for a
  back-side Pad the mirrored Stack index (`n − 1 − i`, `spec/rules/layers.md` L-10) when the form
  has shapes there, otherwise `s` itself (an `absolute` padstack). The shapes are mirrored across
  x for a back-side Pad, rotated by `rotationDeg` (exact for multiples of 90°, float64 rounded to
  LU otherwise, `spec/formats/dsn.md` F-116) and translated to `at`.
- A `ring` of either winding becomes CCW convex pieces (`src/geom/pieces.ts`); a `path` becomes
  one capsule per leg; a `box` under a non-right-angle rotation becomes a hull.
- Pours contribute their outline only (holes are not subtracted): they are never obstacles
  (`spec/rules/connectivity.md` K-05), so nothing in the router reads their shape.
- Rim edges are zero-width segments (`spec/rules/drc.md` DR-03 measures copper-to-edge against
  the polylines).

Tests: `test/lattice.test.ts` (brute-force property tests over 10 000 queries with interleaved
inserts and removes, determinism across insertion orders, rebuilds, item indexing of a synthetic
Layout).
