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

---

## Detailed-router spike (I17) — the go/no-go, decided NO-GO

Per the user's "bound the rewrite risk first", the lowest-risk hypothesis was prototyped: a full
**detailed** negotiated-congestion loop that rips and reroutes EVERY net each pass in detail against
escalating present+history cost — the reference's own approach — with the exact predicate still the
sole R-1 gate (behind `detailedNegotiation`, default off, byte-identical). Measured at a 240 s
budget, `violationsAdded: 0` throughout:

| Board | full detailed PathFinder | passes in 240 s | median pass | our floor | reference |
|---|---|---|---|---|---|
| bm07 | **8** (oscillates 11–17) | 136 | 1.7 s | 6 | 0 |
| cm5-carrier | 36 | 4 | 70 s | 35 | 1 |
| green14seg | 103 | 35 | 6.8 s | 92 | 1 |
| bm01 | 83 | 6 | 47 s | 72 | 28/56 |

**NO-GO.** Full detailed PathFinder does not beat the existing loop — on bm07 it is *worse* (8 vs 6)
despite 136 cheap passes, so the blocker is a **convergence failure of the negotiation itself**, not
budget; on the bigger boards a full detailed pass costs 47–70 s (the exact predicate), so only 4–6
passes fit a budget — a **performance wall** as well.

## Final conclusion (four independent negative results)

The dense-board completion gap is now established, from four independent directions, to be emergent
from the reference's *specific detailed routing algorithm* — its maze search, cost model, and
negotiation schedule — not from any strategy layered around a generic detailed router:

1. M9 — every detailed mechanism (shove, line-search, corner-stitch tiles) → plateau.
2. I12 — every negotiated-congestion knob swept → plateau.
3. M10 — a complete two-phase global router → parity (net-negative against the local negotiator).
4. I17 — the reference's own full-detailed-PathFinder approach → plateau at 8, *worse* than our loop.

Matching the reference's completion (bm07→0) would require replicating its detailed router far more
faithfully than the behavioural spec captures — a deep reverse-engineering + reimplementation of the
core routing algorithm (large; and the faithful-replication route also pushes against the
clean-room boundary), or the topological/rubber-band rewrite that reopens the R-1 guarantee. Neither
is a bounded next step; both are the user's explicit call.

**Recommendation: accept M0–M10 as delivered.** The router is correct and DRC-clean on every board
(R-1 held through every merge, all similarity-reviewed), routes the large majority, carries the
global-planning subsystem, is dual-licensed and pushed. The completion frontier is exhaustively
documented and the remaining lever is a large, risky effort with uncertain payoff.
