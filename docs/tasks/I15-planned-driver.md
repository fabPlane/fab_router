# Task I15 — M10c: corridor-guided detailed realisation (globalPlan:"plan"); where completion moves

Role: implementer. Write set: `src/route/`, `test/`. This stage INSERTS COPPER, but only through
the unchanged detailed path — every leg still passes the exact `sweepClear`/`barrelFits` predicate
and the Journal, so R-1/R-2/R-6 hold exactly as in M9. `globalPlan` defaults `"off"` (M9 loop,
byte-identical); the planned driver runs only under `globalPlan:"plan"`.

Read `docs/DESIGN.md` §10 (esp. §10.4, §10.5), `src/route/{mesh,steiner,negotiate,plan}.ts` (M10a/b
on `main`), `src/route/{passes,search,clear,journal,ripup}.ts`, `spec/api/contract.md` (R-1/R-2/R-6),
`spec/api/settings.md` (`globalPlan` etc.), and the S9 reference bounds
`spec/acceptance/reference/*.bound*.json`.

## Deliverables

1. **Corridor bias in the detailed search**: extend `src/route/search.ts` so an optional
   `corridorBias` (the Corridor's Bin set, from the Plan) feeds the existing `region` (bound the
   search to the corridor's Bins expanded by one Bin) and `stepCost` (soft discount inside the
   corridor, penalty in the margin — guidance, never a hard block; the exact predicate stays the
   sole gate). No change to the A* core, `clear.ts`, or legalisation.
2. **Planned driver in `src/route/passes.ts`** (under `globalPlan:"plan"`): build Mesh → Steiner
   decompose → `negotiate` (no copper) → route each Segment in the Plan's global order via
   `routeConnection` with the corridor's `{region, stepCost}`; on detailed failure `globalRipReroute`
   the whole net (rip its `free` router copper through the Journal, raise history on the Bridges it
   could not cross, re-negotiate that net + corridor-overlapping neighbours, retry). Congestion
   feedback (optional this stage): an unrealisable corridor bumps that Bridge's history and re-plans.
   All under the existing **keep-best** discipline. **Clean fallback**: any Segment the planned
   driver cannot realise falls back to the legacy local loop, so completion can only improve or stay
   equal, never regress.
3. **Plan-adherence R-1 test** (`test/planned-driver.test.ts`): with `globalPlan:"plan"` on a set of
   boards, `checkDrc(layout).violations` is empty and `report.violationsAdded == 0` (assert the
   corridor never bypasses the predicate); held/locked/Prior copper unmoved; determinism across two
   runs; and `globalPlan:"off"` remains byte-identical (perf-invariance fingerprints unchanged).

## Done when

`bun run typecheck`, `check:layers`, `bun run test` green; `globalPlan:"off"` unchanged; with
`globalPlan:"plan"` measure and record in `src/QUESTIONS.md` the completion on **bm07** (target 0,
M9 floor 6), **green14seg**, **bm01**, and (honestly, given its capacity-0 Meshes) cm5-carrier —
with `violations.maxAdded: 0` hard everywhere. Turn advisory completion bounds hard where the
planned driver now reaches them. No regression on any case that passed at tag M9. Commit with
implementer trailers.
