# Task I11 — M9c: per-pass performance so budget-limited boards converge

Role: implementer. Write set: `src/route/`, `src/lattice/`, `src/geom/`, `test/`. Behaviour-
PRESERVING optimisation only: the router must produce the SAME routes (same Tracks/Barrels, same
order) for the same Layout+settings+seed — this is a speed change, not an algorithm change.

Read `docs/DESIGN.md` §1/§4/§6/§7 and `src/route/{search,quilt,clear,passes}.ts`, `src/lattice/`.

Motivation: several boards are budget-limited — within a case's `timeBudgetMs` the router completes
only 3–6 of the ~20 passes it needs (J802 attach depth; dense DSN convergence). Profiling shows a
pass is dominated by A*-loop bookkeeping (object/Map churn and GC), not the exact predicate. Making
a pass cheaper lets more passes run in budget, which improves completion on the boards where extra
passes help (J802, bm07), with no change to any route.

## Deliverables

1. Profile first (record numbers in `src/QUESTIONS.md`): where the time goes on cm5-carrier /
   bm07 / a J802 board. Then reduce allocation on the hot path — e.g. typed-array / flat cell
   stores in the A* frontier and visited sets instead of `Map`/object nodes, reused buffers across
   connections, avoiding per-step closures — keeping the search's deterministic tie-breaking
   (`(f,h,seq)`) and results identical.
2. A **behaviour-invariance test** (`test/perf-invariance.test.ts`): for a set of boards, the
   routed output (Track/Barrel coordinates and order, incomplete count, `violationsAdded`) is
   byte-identical before and after — i.e. assert against a recorded fingerprint so a future change
   that alters routes fails loudly. Determinism across two runs must hold.
3. Measure completion at a FIXED budget before/after on J802 (2-layer), bm07, cm5-carrier;
   record passes-in-budget and incomplete in `src/QUESTIONS.md`. Turn any advisory completion
   bound hard where the speed-up now reaches it.

## Done when

`bun run typecheck`, `check:layers`, `bun run test` green (incl. the invariance test); routes are
provably unchanged; a measurable increase in passes-in-budget on the target boards; R-1/R-6 intact.
Commit with implementer trailers. If the speed-up does not change completion on a board, say so
honestly per board — a correct, faster, behaviour-identical router is still the deliverable.
