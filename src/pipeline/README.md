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
as the item-count difference (contract R-3) and `violationsAdded` as the DRC-count difference
(0 by construction, R-1). Fanout and the optimiser (`fanoutEnabled` / `optimizerEnabled`) are
task I5 and are not run here; `routeSrj` remains the `not-implemented` envelope until I6.
