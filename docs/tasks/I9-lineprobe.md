# Task I9 — M9b-1: gridless line-search detailed router

Role: implementer. Write set: `src/route/`, `test/`. Build on the shove router (M9a) already on
`main`; extend, do not rewrite.

Read `docs/DESIGN.md` §9b (esp. 9b-1), `spec/glossary.md` (design from Hightower 1969 and
Mikami & Tabuchi 1968 line-search routing; Nash et al. Theta* pull), `spec/api/contract.md`
(R-1/R-2), `spec/api/settings.md` (`detailedRouter`, `detailedBudgetMs`, `detailedMaxTiles`),
`spec/behaviour/scenarios/detailed-routing.md`, and `src/route/{clear,passes,journal,via}.ts`.

Locked-channel boards (J802 SRJ: b223-j802*) need routes threaded through ~150 µm gaps between
locked Prior copper that the uniform grid is too coarse to represent. A gridless line-search finds
those channels with no new spatial structure.

## Deliverables

1. **`src/route/lineprobe.ts`** — a line-search router: from a source point, shoot H/V (and 45° in
   45°/any modes) probe lines tested directly against `sweepClear`; at each obstacle boundary
   generate escape points; expand from escape points toward the target (Hightower/Mikami–Tabuchi),
   deterministically, with a `detailedBudgetMs` per-connection cap and abort/deadline polling.
   Multilayer via the existing Barrel machinery (`pickBarrel`/`barrelFits`/`insertLayeredTrail`).
   Every produced leg is Theta*-pulled (`pull.ts`), legalised and exact-`sweepClear`-re-checked
   before the Journal insert; atomic rollback on failure. R-1/R-2 by construction.
2. **Ladder rung** in `passes.ts`: `tryLineprobeRoute`, tried only when grid A* + shove + rip-up
   failed AND `detailedRouter !== "off"` (and, for the fast tier, only in late passes / on
   previously-failed connections so fast-tier timing does not regress).
3. **Tests** (`test/lineprobe.test.ts`): a synthetic locked channel routes only with the line
   probe; R-1 clean; abort/budget respected; no-op when `detailedRouter === "off"`.

## Done when

`bun run typecheck`, `check:layers`, `bun run test` green; `bun run acceptance -- --tier all --case
'srj-*'` shows completion gains on the J802 boards toward the S9 bounds (2-layer → 3; six-layer →
6/6/14) with `violations.maxAdded: 0` and `preExisting: 0` still hard; turn advisory `incomplete`
bounds hard where reached. Record per-board before/after in `src/QUESTIONS.md`. Commit with
implementer trailers.
