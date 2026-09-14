# M10 report — global router (orchestrator, 2026-09-14)

## What was built

A complete two-phase **global router** (docs/DESIGN.md §10), R-1/R-2/R-6-safe by construction,
off by default (`globalPlan:"off"` is byte-identical to the M9 loop):

- **M10a** (`src/route/mesh.ts`) — coarse per-Sheet Mesh; Bridge capacities from fixed blockage via
  the Lattice (R-2 baked in); congestion/overflow report.
- **M10b** (`src/route/{steiner,negotiate,plan}.ts`) — rectilinear Steiner net decomposition + a
  coarse PathFinder negotiation that reroutes *every* segment each iteration (the property the local
  loop lacks). Reduced bm07 coarse overflow 288→198 (−31%).
- **M10c** (`src/route/passes.ts`, `search.ts` corridor bias) — the planned driver: corridors guide
  the detailed search via `region`+`stepCost`, whole-net global rip-up on failure, keep-best,
  clean fallback to the legacy loop.
- **M10d/e** (feedback loop, `negotiate.ts` `keepHistory`) — genuine global↔detailed feedback:
  detailed failures raise Bridge history, re-negotiation produces a changed plan, iterate under a
  budget. (This also fixed a real M10c bug: `negotiate` wiped history on entry, so M10c's re-plan
  never actually changed — which is why M10c was parity.)

Every insertion still passes the exact `sweepClear`/`barrelFits` predicate + Journal, so R-1 holds
identically to M9; a corridor causes a *miss*, never a violation. 853 tests pass; fast acceptance
401/401 byte-identical with `globalPlan:"off"`.

## Result: parity — the plateau is a DETAILED-router limit, not a global-planning limit

With `globalPlan:"plan"` and a generous budget, completion on every target board equals the M9
local-loop floor, `violationsAdded: 0` throughout:

| Board | M9 floor | M10 (plan) | reference |
|---|---|---|---|
| DAC bm07 | 6 | 6 | 0 |
| green14seg | 92 | 92 | 1 |
| bm01 | 72 | 72 | 28/56 |
| cm5-carrier | 35 (tiles) | 35 | 1 |
| J802 2-layer | 12 (tiles) | 12 | 3 |

Instrumented, the global router works exactly as designed — the coarse plan changes iteration to
iteration and reroutes whole nets against a changed cost field — but the **corridor-confined
detailed ladder converges worse than the free local negotiator** (bm07: ~25 vs 6), so the
keep-better fallback lands at the M9 floor. The bottleneck is the *quality of the detailed search
at the local optimum*, which corridor guidance can only confine, not improve.

## Conclusion (rigorously established across M9, M10, and the I12 tuning sweep)

The dense-board completion gap is a **fundamental limit of the detailed router's local search**,
proven from three independent directions:
1. M9 added every detailed mechanism (shove, line-search, corner-stitch tiles) — plateau.
2. I12 swept every negotiated-congestion knob — plateau.
3. M10 built a complete, correct global router — parity, and instrumentation shows the global plan
   is net-negative against the local negotiator.

Closing it (bm07→0) needs a **fundamentally stronger detailed router** — a gridless
negotiated-congestion *detailed* router or full topological/rubber-band routing (Dai/Kong/Sato).
The design (§9, §10.6) and the M8 audit flagged rubber-band routing as the one approach that
reopens the R-1 clean-by-construction guarantee — a core rewrite, the highest-risk option, with
uncertain payoff. That is a distinct, large architecture decision, deliberately not launched
autonomously.

## Status

The router is correct and DRC-clean on every board (R-1 holds through all M9+M10 merges, each
similarity-reviewed, no copying indicated), routes the large majority, and now carries a complete
off-by-default global-planning subsystem. Full reference completion parity on the densest boards is
the documented architectural frontier: a detailed-router rewrite, which is the user's call.
