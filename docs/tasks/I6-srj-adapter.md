# Task I6 — tscircuit SimpleRouteJson adapter and differential-pair measurement

Role: implementer. Write set: `src/srj/`, `src/api.ts` (`routeSrj` body), `test/`.

Read `spec/api/contract.md` (SimpleRouteJson section, `SrjRouteResult`, Q-I0-8),
`spec/types/srj.ts`, `spec/formats/srj.md` if present (else `docs/DESIGN.md` §7's `src/srj` row),
and every `srj-*` case under `spec/acceptance/cases/`. Build on the reader/router/DRC on `main`.

## Deliverables

1. `src/srj/` — SimpleRouteJson ↔ Layout: mm↔LU via a Frame, `bounds`→Rim (+1 mm margin),
   `obstacles`→held Pours (net-owned when `connectedTo` names a connection) or Fences,
   `connections[].pointsToConnect`→locked one-pad Parts, `layerCount`→Stack, via sizes from
   `minViaPadDiameter`/`minViaHoleDiameter`, `differentialPairs` carried through.
2. `routeSrj(srj, settings, hooks)` — route via the core `route()`, emit `traces` (`pcb_trace`
   with `wire`/`via` steps), fill `report`, `violationsBefore`/`violationsAdded`, and per-pair
   `{ lengthP, lengthN, skewMm, withinTolerance }` (measure both members of each pair; coupled
   routing is out of scope). R-1 holds.
3. Tests for every `srj-*` case; the J802 boards route to their bounds.

## Done when

`bun run typecheck`, `check:layers`, `test` green; `bun run acceptance -- --tier all --case
'srj-*'` passes; `src/QUESTIONS.md` updated. Commit with implementer trailers.
