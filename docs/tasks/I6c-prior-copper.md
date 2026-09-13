# Task I6c — Prior copper: DRC-silent, connective, obstacle to other nets (Q69/DR-13/C-16/K-16)

Role: implementer. Write set: `src/srj/`, `src/route/clear.ts`, `src/drc/`, `test/`.

Read `spec/formats/srj.md` J-23/J-33/J-34 and the proposed primitive, `spec/rules/drc.md` DR-13,
`spec/rules/clearance.md` C-16, `spec/rules/connectivity.md` K-14/K-16, `spec/types/layout.ts`
(`Origin` now includes `"prior"`; `Pour.origin` added), and the four `srj-*` cases (their
`violations.preExisting` and `violations.maxAdded` are hard; `incomplete` is advisory).

Prior copper = pre-existing SRJ net-owned copper. It must be one copper class with four behaviours:
1. **Obstacle to other nets** — router-added copper of a different net keeps the declared clearance
   from it (R-1 unaffected).
2. **Connective + same-net exempt** — the router may end a route on it and that completes a
   connection (K-01/K-16); same-net DRC exempt (DR-02).
3. **Silent among Prior copper** — two `origin: "prior"` items are never a spacing/fence Violation
   pair, at any distance, whatever their nets (DR-13). This is what makes `violationsBefore = 0` on
   the coupled J802 boards.
4. **Never an independent terminal** until attached (K-16).

## Deliverables

1. `src/srj/build.ts` — represent each net-owned obstacle as connective same-net copper with
   `origin: "prior"` (a Pour is the natural fit), not a net-carrying Fence. Keep non-net obstacles
   as Fences.
2. `src/route/clear.ts` and `src/drc/` — implement DR-13: skip any pair where **both** items are
   `origin: "prior"`. Keep Prior-vs-router-added-other-net at full clearance (R-1). Prior copper
   participates in connectivity as its net's copper (K-16).
3. Make `requiredConnections` still 15 per J802 board (Prior copper is not a terminal), and let a
   route attach to Prior copper to complete.
4. Tests: `violationsBefore == 0` on all four J802 boards; the six-layer v1 `srj` case's hard
   `preExisting: 0` passes; `requiredConnections == 15`; completion improves toward the reference's
   3/6 (turn the advisory `incomplete` bounds hard only if you actually reach them; otherwise leave
   advisory and note the shortfall as an M7 router-quality item).

## Done when

`bun run typecheck`, `check:layers`, `bun run test` green; `bun run acceptance -- --tier all --case
'srj-*'` passes its hard metrics; `src/QUESTIONS.md` updated. Commit with implementer trailers.
