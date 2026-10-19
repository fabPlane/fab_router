# `src/pipeline` — orchestration

The body of `route()` and `routeDsn()` (`docs/DESIGN.md` §7): settings resolution (built-in
defaults ← file block when `useFileSettings` ← caller, merged per Sheet and per field;
`spec/api/settings.md`), the stage sequence fanout → routing passes → optimiser with their
stop conditions (`maxPasses`, stagnation, `maxItems`, time budgets), cancellation through
`AbortSignal` polled between connections and inside the search, the seeded PRNG, and the
RouteReport / statistics envelopes. Determinism rules live here: sorted id lists, sequence-number
heap ties, `Date.now` only for budgets.

`resolveSettings` implements the settings precedence and per-Sheet merge. `runRoute` (task I4) is
the routing driver: it measures the DRC and item counts before the run, builds a `RouteCtx` with a
live Lattice and Journal, runs `src/route` `runPasses`, and assembles the `RouteReport` — `added`
as the item-count difference (contract R-3) and `violationsAdded` as the nonnegative DRC-count
difference. Both DRC snapshots use the resolved hole and copper-to-edge clearance settings,
including file settings when enabled and explicit caller overrides. These checks cover imported
geometry; they do not replace native zone-refill thermal validation. Fanout and optimisation
run according to `fanoutEnabled` and `optimizerEnabled`.
