# Task I14 — M10b: Steiner decomposition + coarse negotiated global routing (produces a Plan)

Role: implementer. Write set: `src/route/`, `test/`. This milestone COMMITS NO COPPER (nothing is
inserted into a Layout) — it produces a Plan over the Mesh. R-1 is trivially safe. `globalPlan`
stays `"off"`, so all acceptance numbers remain byte-identical.

Read `docs/DESIGN.md` §10 (esp. §10.3), `spec/glossary.md` (Mesh/Bin/Bridge/Overflow/Corridor/Plan;
literature: FLUTE/Chu-Wong, Hwang, PathFinder/McMurchie-Ebeling, FastRoute, BoxRouter, Labyrinth),
`src/route/mesh.ts` (M10a, on `main`), `src/drc/connect.ts` (`requiredConnectionsOf` — the current
MST decomposition you supersede only when the plan is active), `src/layout/`.

## Deliverables

1. **`src/route/steiner.ts`** — per-net rectilinear Steiner decomposition over the net's terminal
   Bins into 2-pin **segments**: `steinerDecompose(layout, mesh) → Segment[]`. Ship a deterministic
   batched-greedy / MST-rectilinear RSMT first (correct and deterministic; ties `(distance, idA,
   idB)`); a FLUTE lookup-table upgrade can come later behind the same `Segment[]` interface. Include
   the airline and terminal Bins per segment.
2. **`src/route/plan.ts`** — the `Plan`/`Segment`/`Corridor` data structures and a global segment
   `order` (e.g. descending airline × local congestion, deterministic).
3. **`src/route/negotiate.ts`** — `negotiate(mesh, segments, opt) → Plan`: the coarse PathFinder loop.
   Each iteration rips and reroutes **every** segment (not only overflowing ones) by maze/A* over
   Bins with cost `(base + presentWeight·present)·(1 + historyWeight·history)`; update usage/present;
   accumulate history on over-full Bridges; escalate `historyWeight` per `globalHistoryRamp`; bias
   in-plane Bridges by each Sheet's preferred direction and assign multi-Sheet segments to a Sheet
   whose preferred direction matches (BoxRouter layer assignment). Stop at total Overflow 0 or
   `globalMaxIterations`. Deterministic (seeded scan, `(net,from,to)` ties, no Map-order decisions).
   Writes only Mesh usage + Corridors — commits no copper.
4. **Tests** (`test/steiner.test.ts`, `test/negotiate.test.ts`): Steiner segments reconstruct the
   net's terminals and are a tree (no cycle); determinism; the negotiation drives a synthetic
   congested Mesh to Overflow 0 within the cap, and a genuinely over-capacity Mesh reports residual
   overflow honestly; layer bias places axis-aligned segments on the matching Sheet.

## Done when

`bun run typecheck`, `check:layers`, `bun run test` green; `globalPlan:"off"` unchanged (no route
change; verify fast acceptance still 401/401); on bm07 and cm5-carrier Meshes the coarse negotiation
resolves overflow (or reports the residual) within the iteration cap — record the numbers in
`src/QUESTIONS.md`. Commit with implementer trailers.
