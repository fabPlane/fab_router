# Task I4 — router core: Quilt, search, pull, legalise, Journal, passes, cancellation

Role: implementer. Write set: `src/route/` (except `clear.ts` / `profile.ts` from I3 — extend, do
not rewrite), `src/pipeline/`, `src/api.ts` (bodies of `route`, `routeDsn`), `test/`.

Read first: `docs/DESIGN.md` §6–7 in full, `spec/glossary.md` (and its literature list —
design from A\* (Hart et al.), Theta\* (Nash et al.), adaptive quadtrees (Finkel & Bentley),
negotiated congestion (McMurchie & Ebeling)), `spec/api/contract.md` (R-1…R-6, hooks,
cancellation, `RouteReport`), `spec/api/settings.md`, `spec/rules/{connectivity,drc,layers,
vias,nets,clearance}.md`, `spec/behaviour/scenarios/*.md`, every `routing-fast-*` case under
`spec/acceptance/cases/`, and `src/{geom,lattice,drc,route}/README.md` from the tasks already on
`main` (I0, I1, I2, I3).

## Scope of this task (routing v1)

Single-Sheet routing without Barrels: every connection is routed on one Sheet (`viasAllowed:
false` semantics apply to this milestone regardless of the setting; multi-Sheet search and Barrel
drops are task I5, but design the search state as `(sheet, patch)` now so I5 adds Barrel moves
without restructuring). Rip-up is in scope in its simplest form (soft obstacles with a
per-connection budget); nudge, fanout and the optimiser are I5.

## Deliverables

1. **Journal** (`src/route/journal.ts`): `mark()`, journaled insert/remove of Tracks and Barrels
   through the Layout and the Lattice, `rewind(mark)`, `snapshot()`.
2. **Quilt** (`src/route/quilt.ts`): lazy adaptive quadtree of free Patches per `(sheet,
   profile)`, "free" decided by Lattice queries with Dop8 expansion by `halfWidth + spacing`,
   Morton-keyed, invalidated regionally on Journal changes; `patchAt`, `neighbours`, `state`.
3. **Search** (`src/route/search.ts`): A\* over `(sheet, patch)` with Seam crossings, binary
   heap keyed `(f, h, seq)`, octilinear/Euclidean heuristic by angle mode, costs from the resolved
   settings (`alongCost`/`againstCost` per Sheet, `bendCost`), soft-obstacle costs for rip-up,
   deadline and `AbortSignal` polled every 256 pops; deterministic (sorted ids, sequence
   tie-break, seeded PRNG only where the design needs randomness).
4. **Pull + legalise** (`src/route/pull.ts`, `src/route/legalise.ts`): Theta\*-style
   shortcutting with `sweepClear`, angle-mode shaping (`any`/`45`/`90`), pad entry, neck-down,
   join/split of same-net Tracks, final exact re-check of every leg.
5. **Rip-up** (`src/route/ripup.ts`): soft obstacles (`free` other-net items), cost
   `startRipupCost × (1 + history)`, per-connection budget, journaled removal and re-queue.
6. **Passes** (`src/route/passes.ts`) and **pipeline** (`src/pipeline/`): required connections
   from `src/drc`, ordered queue, `maxPasses` / `maxStagnantPasses` / `maxItems` (= completed
   connections, Q-I0-8 area of `spec/api/settings.md`) / `timeBudgetMs` / abort, `RouteReport`
   with every field, hooks (`onPass`, `onConnection`, `onProgress`, `onLog`).
7. **API**: `route`, `routeDsn` (read → statsBefore → route → statsAfter → writeSes).

## Done when

`bun run typecheck`, `bun run check:layers`, `bun run test` green; `bun run acceptance -- --tier
fast --case 'routing-*'` passes every fast routing case **with `violations.maxAdded: 0` on every
board** (R-1 is the hard gate; a case that also needs Barrels to reach its completion bound may
stay red — list those in `src/QUESTIONS.md` under "Deferred to I5" with the numbers you reach);
the `novia-routable-nets` scenario nets are completed; `src/route/README.md` and
`src/pipeline/README.md` written with literature citations; `src/QUESTIONS.md` updated. Commit
with implementer trailers.
