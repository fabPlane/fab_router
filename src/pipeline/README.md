# `src/pipeline` — orchestration

The body of `route()` and `routeDsn()` (`docs/DESIGN.md` §7): settings resolution (built-in
defaults ← file block when `useFileSettings` ← caller, merged per Sheet and per field;
`spec/api/settings.md`), the stage sequence fanout → routing passes → optimiser with their
stop conditions (`maxPasses`, stagnation, `maxItems`, time budgets), cancellation through
`AbortSignal` polled between connections and inside the search, the seeded PRNG, and the
RouteReport / statistics envelopes. Determinism rules live here: sorted id lists, sequence-number
heap ties, `Date.now` only for budgets. This task provides settings resolution and the
`not-implemented` diagnostic envelope the stubs return.
