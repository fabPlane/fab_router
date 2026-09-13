# Task I3 — Lattice (spatial index) and exact clearance queries

Role: implementer. Write set: `src/lattice/`, `src/route/clear.ts`, `test/`.

Read first: `docs/DESIGN.md` §1, §4, §6 (`clear.ts` row), `spec/glossary.md`,
`spec/types/layout.ts`, `spec/rules/clearance.md`, `spec/rules/drc.md`, `spec/rules/keepouts.md`,
`spec/rules/layers.md`. The foundation (I0) and the reader (I1) are on `main`; use `src/geom/`
and, if I1 has landed, real Layouts from `spec/acceptance/boards/` in your tests (otherwise build
small synthetic Layouts in memory).

## Deliverables

1. **Lattice** (`src/lattice/`): per-Sheet uniform bucket grid with an oversize shelf as
   `docs/DESIGN.md` §4 describes: `build(layout)`, `insert(item)`, `remove(id)`,
   `hits(sheet, box, filter) → ids ascending`, `sweepHits(sheet, dop8, filter)`, Track legs indexed
   individually as `(trackId, legIndex)`, generation-stamp dedup, cell size from the median item
   diagonal, rebuild when the shelf overflows. Results must not depend on insertion history.
2. **Property tests** (`test/lattice.test.ts`): random rectangles/segments on random Sheets
   versus a brute-force scan — identical id sets for ≥ 10 000 random queries, after random
   interleaved inserts and removes; a determinism test (two different insertion orders → identical
   query results).
3. **Clearance queries** (`src/route/clear.ts`): `sweepClear(layout, lattice, sheet, seg,
   profile, ignore) → { ok, blocking: ids }` for a Track leg of `profile.width` on `sheet`,
   `barrelFits(layout, lattice, at, form, profile, ignore)`, `pointFree(...)`. "Clear" means:
   exact Euclidean distance to every other-net item's copper on that Sheet ≥ the SpacingTable value
   for the pair of Kinds and pair type (`spec/rules/clearance.md`, `drc.md` DR-01..DR-08),
   respecting Fences by scope, the Rim and copper-to-edge, hole clearance for Barrels, and the
   same-net exemptions of DR-02. `ignore` is a set of item ids (the connection's own items) plus
   the connection's net. Candidates come from the Lattice with the bbox expanded by
   `halfWidth + spacing.max(kind)`; the final decision uses `src/geom` exact distances.
4. **Profile** (`src/route/profile.ts`): resolve `{ width, spacingByKind, sheets, barrelForms,
   angleMode }` for a connection from Layout rules (`spec/rules/nets.md`, `vias.md`, `layers.md`)
   and `RouteSettings` (`neckWidthUm`, `viasAllowed`, `layers` activity).
5. **Consistency test** (`test/clear-vs-drc.test.ts`): for every board in `spec/acceptance/boards/`
   that reads (or synthetic Layouts if I1 is not yet on `main`), every existing Track leg and Barrel
   that `checkDrc` reports as violation-free must be reported clear by `sweepClear`/`barrelFits`
   when its own item is in `ignore`, and every leg involved in a spacing violation must be reported
   blocked. (If `checkDrc` is still a stub, write the test against your own brute-force DRC and
   leave a question in `src/QUESTIONS.md`.)

## Done when

`bun run typecheck`, `bun run check:layers`, `bun run test` green; property, determinism and
consistency tests pass; `src/lattice/README.md` and `src/route/README.md` (the `clear.ts` and
`profile.ts` parts) written; `src/QUESTIONS.md` updated. Commit with implementer trailers.
