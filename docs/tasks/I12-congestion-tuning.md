# Task I12 — bounded negotiated-congestion tuning (pre-M10 experiment)

Role: implementer. Write set: `src/route/`, `test/`. TUNING only — no new algorithm, no new
module. Adjust the parameters and schedules of the EXISTING rip-up / shove / negotiated-congestion
loop and measure whether the dense-board completion plateau moves. R-1 (`violations.maxAdded: 0`)
and R-6 stay hard throughout.

Read `docs/DESIGN.md` §9a, `src/route/{passes,ripup,shove}.ts`, `spec/api/settings.md`, and the S9
reference bounds `spec/acceptance/reference/*.bound*.json` (the targets), plus the M9 report
`evidence/reports/M9.md` (the frontier: bm07 stagnation-limited at 5–6; cm5/green14seg/bm01/J802).

## What to sweep (existing knobs; add settings if a knob isn't exposed yet)

- `presentCongestionCost` (currently defaults 0) — try a range > 0; this is the PathFinder present-
  sharing term that should break the "several nets fight one channel" stall.
- History weight / decay schedule in `ripup.ts` (how fast `history` grows and whether it decays).
- Rip-up ordering: I8 found difficulty-order-from-pass-1 regresses; try applying it only to the
  *ripped* re-queue, or a congestion-weighted order that doesn't churn keep-best.
- `startRipupCost`, per-connection rip budget, `shoveWindowUm`/`shoveMaxDepth`.
- Adaptive stagnation: raise `maxStagnantPasses` (or reset it) when the incomplete count is still
  falling, so a board that is slowly improving is not cut off at the plateau.

## Method

1. Build a small local sweep harness (in `test/` or `tools/acceptance/`, your write set) that
   routes bm07, cm5-carrier, green14seg, bm01, and J802 2-layer at their case budgets under a grid
   of parameter settings, printing incomplete-after and `violationsAdded` per setting. Keep it out
   of the default `bun run test` (guard by an env var) so the suite stays fast.
2. Find the setting(s) that improve completion on the target boards WITHOUT regressing any
   currently-passing routing/srj case. Record the full sweep table in `src/QUESTIONS.md`.
3. If a new default clearly helps overall, change the default in the pass loop (and update
   `test/perf-invariance.test.ts` fingerprints, since routes will change, with a one-line note).
   If the plateau holds (no setting meaningfully helps), say so per board with the best number
   reached — a rigorous negative result is a valid deliverable and directly informs the M10 decision.
4. Turn any advisory completion bound hard where a tuning now reaches it.

## Done when

`bun run typecheck`, `check:layers`, `bun run test` green; the sweep table and a clear
conclusion (which knob helped which board, or "plateau holds") in `src/QUESTIONS.md`; R-1/R-6
intact; no regression on any case that passed at tag M9. Commit with implementer trailers.
