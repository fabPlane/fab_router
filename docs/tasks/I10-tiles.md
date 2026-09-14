# Task I10 — M9b-2: corner-stitched tile detailed router

Role: implementer. Write set: `src/route/`, `test/`. Build on M9a (shove) and M9b-1 (line-search)
on `main`; extend, do not rewrite.

Read `docs/DESIGN.md` §9b (esp. 9b-2), `spec/glossary.md` (design from Ousterhout 1984 corner
stitching; Dion & Monier 1995 gridless tiles; Hart et al. A*; Nash et al. Theta*; Hightower/
Mikami–Tabuchi line-search refinement), `spec/api/contract.md` (R-1/R-2), `spec/api/settings.md`
(`detailedRouter: "tiles"`, `detailedMaxTiles`, `detailedBudgetMs`),
`spec/behaviour/scenarios/detailed-routing.md`, and `src/route/{clear,quilt,passes,journal,via,
lineprobe}.ts`.

The channels line-search cannot complete need a geometry-exact free-space representation.

## Deliverables

1. **`src/route/tiles.ts`** — corner-stitched decomposition of each `(Sheet, Profile)` free space
   into maximal rectangular free tiles, seeded from the Dop8-expanded Lattice obstacles; lazy,
   per connection bounding box, keyed `(sheet, profile-hash)`, invalidated in-region on Journal
   changes; `tileAt`, `freeNeighbours`, `portal`. Budget with `detailedMaxTiles`.
2. **`src/route/channel.ts`** — A* over the free-tile adjacency graph (portals wide enough for the
   width; reuse the `Heap` from `search.ts`, deterministic `(f,h,seq)`); centreline through portal
   midpoints; Theta* pull + line-search refinement to the channel midline; legalise + exact
   re-check + Journal insert; multilayer via the Barrel machinery. R-1/R-2 by construction.
3. **Ladder rung** in `passes.ts`: `tryChannelRoute` under `detailedRouter === "tiles"`, after the
   line probe, tried only in late passes / on previously-failed connections.
4. **Tests** (`test/tiles.test.ts`, `test/channel.test.ts`): tile decomposition correctness vs a
   brute-force free-space check on random obstacle sets; a channel only the tile router completes;
   R-1 clean; determinism; budget/abort respected.

## Done when

`bun run typecheck`, `check:layers`, `bun run test` green; the dense-board and J802 residue improve
toward the S9 reference bounds (bm07 exact-0 tail, bm11 fine-pitch, six-layer J802) with
`violations.maxAdded: 0` hard; turn advisory bounds hard where reached, and for any that remain
out of reach record the board, the number reached, and why in `src/QUESTIONS.md`. Commit with
implementer trailers.
