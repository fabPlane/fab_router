# Task I0 — foundation: module skeleton, geometry kernel, vector tests, acceptance runner, API stubs

Role: implementer. Branch: your worktree branch. Write set: `src/`, `test/`, `tools/acceptance/`.

Read first, in this order: `docs/DESIGN.md`, `spec/README.md`, `spec/glossary.md`,
`spec/api/contract.md`, `spec/api/settings.md`, `spec/types/*.ts`, `spec/acceptance/README.md`,
`spec/acceptance/schema/*.json`, and every file under `spec/behaviour/geometry/`.

## Deliverables

1. **Module skeleton** matching the layer order in `docs/DESIGN.md` §8: `src/geom/`,
   `src/layout/`, `src/lattice/`, `src/drc/`, `src/route/`, `src/pipeline/`, `src/dsn/`,
   `src/ses/`, `src/srj/`, `src/api.ts`, `src/cli.ts`. Each directory gets an `index.ts` and a
   one-paragraph `README.md` naming its responsibility and the literature it draws on. `bun run
   check:layers` must pass.
2. **Geometry kernel** (`src/geom/`): integer-LU points, exact predicates (`orient`, `side`,
   `onSeg`, `segsIntersect`, point-in-convex, point-in-ring), squared distances between the shape
   kinds of `docs/DESIGN.md` §1, rational line intersection (reduced integer fraction), monotone-
   chain convex hull, signed polygon area, `Dop8` bounds and Minkowski expansion by a
   circumscribed octagon, Euclidean expansion for DRC, `convexPieces` (ear-clip + Hertel–Mehlhorn),
   `snap45` / `stairs90`, collinear simplification. Pure functions over plain objects. State the
   2^25 bound and the float64 exactness argument in `src/geom/README.md`.
3. **Vector test** (`test/vectors.test.ts`): loads every `spec/behaviour/**/*.jsonl` file
   (skip the `_generated` header line), dispatches on `op`, and asserts every record. Geometry ops
   must all pass; ops your modules do not implement yet (lexeme vectors) are reported as skipped
   with a count, not silently ignored.
4. **Exact oracle test** (`test/geom-exact.test.ts`): a bigint re-implementation of `orient`,
   `segsIntersect`, and squared distance, fuzzed against the float64 versions for ≥ 100 000 random
   cases with coordinates up to ±2^25, including near-collinear triples.
5. **Acceptance runner** (`tools/acceptance/run.ts` + `test/acceptance.test.ts`): reads every
   case under `spec/acceptance/cases/`, validates it against `spec/acceptance/schema/case.schema.json`
   (write a small validator; no dependencies), resolves boards from `spec/acceptance/boards/`,
   reference files from `spec/acceptance/reference/`, and runs the kinds in
   `spec/acceptance/README.md` against the public API in `src/api.ts`. `test/acceptance.test.ts`
   runs the `fast` tier as one `test()` per case; `tools/acceptance/run.ts --tier <fast|slow|all>
   [--case <glob>] [--report <file>]` runs any tier and writes the JSON report described in the
   README. Cases whose kind the API cannot serve yet (every function is a stub) must **fail**, not
   skip — except when the environment variable `FAB_ROUTER_ACCEPT_STUBS=1` is set, which is how
   this task is verified.
6. **API stubs** (`src/api.ts`): every function in `spec/api/contract.md` exists with the exact
   signature and returns a well-typed "not implemented" result (`ok: false` with a diagnostic, or
   an empty stats object), so `bun run typecheck` passes and later tasks replace bodies, not
   signatures.
7. `src/QUESTIONS.md` with a "Status" section (what passes, what is stubbed) and numbered
   questions for the spec side.

## Done when

`bun run typecheck`, `bun run check:layers`, and `bun run test` are green (with
`FAB_ROUTER_ACCEPT_STUBS=1` for the acceptance suite), every geometry vector passes, the exact
oracle fuzz passes, and `bun run acceptance -- --tier all --report /dev/stdout` under
`FAB_ROUTER_ACCEPT_STUBS=1` lists every case with its kind. Commit with the implementer trailers.
