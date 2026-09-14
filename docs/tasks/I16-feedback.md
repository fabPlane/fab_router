# Task I16 — M10d/e: global↔detailed feedback iteration + layer assignment (the decisive completion test)

Role: implementer. Write set: `src/route/`, `test/`. Same R-1 discipline: every insert passes the
exact predicate + Journal; `globalPlan` defaults `"off"` (byte-identical). This is the decisive test
of whether the two-phase global router can break the completion plateau — M10c reached only PARITY
(bm07 6→6). If flat feedback iteration also reaches parity, that is a valid negative result: record
it honestly per board.

Read `docs/DESIGN.md` §10 (esp. §10.3 step 3, §10.4b, §10.7 M10d/M10e), `spec/glossary.md`
(FastRoute congestion feedback, BoxRouter layer assignment, PathFinder), the M10c code
`src/route/{passes,negotiate,steiner,plan,mesh,search}.ts`, and `src/QUESTIONS.md` (I15's parity
finding). The reference converges by renegotiating ALL nets every pass against an escalating
history — the analogue here is a global↔detailed feedback LOOP, not a one-shot plan.

## Deliverables

1. **Global↔detailed feedback iteration (M10e)** in the planned driver: after realising the Plan,
   for the connections still incomplete OR that overflowed their corridor, bump the offending
   Bridges' history, RE-NEGOTIATE (re-run `negotiate` with the raised history so the coarse plan
   actually changes), rip the affected nets' `free` copper, and re-realise — iterate up to
   `globalMaxIterations` or a wall-clock budget, keeping the best (fewest-incomplete, DRC-clean)
   state. The point: make the coarse plan RESPOND to detailed failures and drive the detailed
   router down a DIFFERENT corridor next iteration, so a boxed-in net is actually re-routed against
   a changed cost field (the property that makes PathFinder converge). Consider ripping-and-
   rerouting ALL nets (not only incomplete) in a bounded number of iterations, guided by corridors
   so each detailed reroute is cheap/confined.
2. **Layer/region assignment (M10d)**: strengthen the global layer bias (assign multi-Sheet segments
   to Sheets by preferred direction; BoxRouter) and compose corridors with `detailedRouter:"tiles"`
   inside the corridor for the locked-channel boards.
3. **Tests**: R-1 (`violationsAdded===0`) and R-2 hold under the feedback loop; determinism;
   `globalPlan:"off"` byte-identical; the loop terminates (budget/iteration cap).

## Done when

`bun run typecheck`, `check:layers`, `bun run test` green; `globalPlan:"off"` unchanged; measure and
record in `src/QUESTIONS.md`, with `globalPlan:"plan"` and a generous budget, the completion on
**bm07** (target 0, floor 6), **green14seg**, **bm01**, **cm5-carrier**, and a J802 board (with
tiles) vs the M9/M10c floors — `violations.maxAdded: 0` hard everywhere. State clearly per board
whether the feedback loop BREAKS the plateau or reaches parity. Commit with implementer trailers.
