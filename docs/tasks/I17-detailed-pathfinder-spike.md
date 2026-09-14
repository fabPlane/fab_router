# Task I17 — SPIKE: full detailed negotiated-congestion (PathFinder) loop, R-1-safe; go/no-go

Role: implementer. Write set: `src/route/`, `test/`. This is a bounded PROTOTYPE + MEASUREMENT to
decide whether a stronger detailed router can break the completion plateau while keeping R-1. Do
NOT rewrite the router; add an experimental loop behind a setting and measure it. `globalPlan`/the
default loop stay byte-identical.

## The hypothesis to test

The reference reaches bm07→0 with a full **detailed** negotiated-congestion loop: every pass it
rips and reroutes ALL nets in detail against an escalating present+history cost (McMurchie & Ebeling
1995), which erases the first-come advantage. Our current loop only reroutes the *incomplete*
connections, so a net that completed early holds its resources forever — the oscillation/plateau
(evidence/reports/M10-report.md, §10.0). Test whether doing proper PathFinder *in detail* breaks it.

R-1 is preserved trivially: the exact `sweepClear`/`barrelFits` predicate stays the SOLE gate for
every insert; the congestion cost only biases the A* search (soft obstacle cost, as `ripup.ts`
already does). A net that cannot route legally stays incomplete — never a violation.

## Deliverables

1. Read `docs/DESIGN.md` §6/§9/§10, `src/route/{passes,ripup,search,clear,journal}.ts`,
   `src/drc/connect.ts`, `evidence/reports/M10-report.md`.
2. Add an experimental loop behind a new setting `detailedNegotiation: boolean` (default false):
   each pass, restore the board to no router copper (Journal rewind), then route ALL required
   connections in detail in a negotiation order, every leg's soft cost = `base·(1 + present·pw +
   history·hw)` where present is per-pass resource usage and history accrues across passes on
   resource cells (reuse `RipupHistory`); escalate `hw` per pass. Keep-best snapshot. Run up to a
   pass/wall-clock budget. This is the existing detailed search (`clear.ts` gate unchanged) driven by
   a full-rip-all-reroute-all schedule instead of incomplete-only.
3. Measure and record in `src/QUESTIONS.md`, with `detailedNegotiation:true` and a generous budget
   (e.g. 240 s), for **bm07, cm5-carrier, green14seg, bm01**: incomplete-after, passes run,
   wall-clock, and `violationsAdded` (must be 0). Compare to the M9/M10 floors. Report per-pass time
   and passes-in-budget so the perf feasibility is quantified.
4. A tiny R-1 test: `detailedNegotiation:true` on 2–3 boards yields `checkDrc` empty and
   `violationsAdded===0`.

## Done when

`bun run typecheck`, `check:layers`, `bun run test` green; default behaviour byte-identical; a clear
GO/NO-GO writeup in `src/QUESTIONS.md`: does full detailed PathFinder move bm07 below 6 within a
realistic budget, and if not, is the blocker convergence (still plateaus) or performance (too few
passes in budget)? Numbers, not adjectives. Commit with implementer trailers. A rigorous negative
result is a valid, valuable deliverable.
