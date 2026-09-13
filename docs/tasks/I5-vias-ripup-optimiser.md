# Task I5 — vias, multilayer, rip-up, fanout, nudge, optimiser, strict DRC, neck-down

Role: implementer. Write set: `src/route/`, `src/pipeline/`, `src/api.ts` (route/routeDsn bodies),
`test/`. Build on the I4 router already on `main`; extend, do not rewrite.

Read `docs/DESIGN.md` §6 in full, `spec/api/contract.md` (R-1…R-6 and every `Q-*` ruling),
`spec/api/settings.md`, `spec/rules/{vias,layers,connectivity,drc,clearance}.md`,
`spec/behaviour/scenarios/*.md`, and every `routing-slow-*` and the four `DEFERRED_TO_I5`
`routing-fast-*` cases.

## Deliverables

1. **Barrels + multilayer search** — extend `src/route/search.ts` so the A* state `(sheet, patch)`
   gains inter-Sheet Barrel moves (cost `viaCost`, or `planeViaCost` for a plane-owning net);
   `barrelFits` gates every drop; usable Sheets and via candidates come from the Profile. Remove
   the four cases from `test/acceptance.test.ts`'s `DEFERRED_TO_I5` set as they pass.
2. **Fanout** (`src/route/fanout.ts`) — SMD escape stub + Barrel; deterministic; `fanoutEnabled`,
   `fanoutMaxPasses`, `fanoutMaxItems`; updates `LayoutStats.fanout`.
3. **Rip-up** — strengthen the soft-obstacle loop (per-connection budget, history), so congested
   boards complete; keep R-1/R-2.
4. **Nudge** (`src/route/nudge.ts`) — rip-local-reroute of conflicting free legs in a window,
   journaled rollback.
5. **Optimiser** (`src/route/optimise.ts`) — re-route-keep-if-better, bend straightening, Barrel
   elimination, parallel tighten; `optimizerEnabled`, `optimizerPasses`, `optimizerMaxItems`.
   Honour R-6 (via count and total length never increase; no complete connection becomes
   incomplete).
6. **Strict DRC** (`strictDrc`) and **neck-down** (`neckWidthUm`, Q-I4-65) in the legaliser.

## Done when

`bun run typecheck`, `bun run check:layers`, `bun run test` green with an empty `DEFERRED_TO_I5`
set; `bun run acceptance -- --tier all --case 'routing-*'` meets every case's bounds
(`violations.maxAdded: 0` everywhere; DAC bm07/bm08 exact 0 incomplete; multilayer boards route;
plane-layer boards respected); `src/QUESTIONS.md` updated. Commit with implementer trailers.
