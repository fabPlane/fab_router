# Convex core identity census

Diagnostic only; production source, rules and defaults are unchanged. Source revision: `3813be01` (all 1,488 source/spec hashes retained). One instrumented seed-1 replay per case on the same host, cores 12–19, nice 10, 240-second timeout. Each process starts with an empty WeakSet. Counters cover every call to `coreOf`, including reporting/DRC callers; no cached core is returned and no geometry is retained strongly by the census. `consecutive` means consecutive globally across all kinds. Identity repetition does not prove unchanged coordinates, lattice ownership or a safe cache hit. Counts do not measure allocation bytes or time saved.

| Case | Retained control engine residual | Instrumented residual | Added represented-rule violations control / instrumented | Repeated / total core calls |
|---|---:|---:|---:|---:|
| Aquarius J4 | 8 | 8 | 0 / 0 | 67,974,330 / 112,539,936 |
| Sprinkler J3 | 2 | 2 | 0 / 0 | 16,061,419 / 36,808,829 |
| Shield J4 | 6 | 6 | 0 / 0 | 5,938,272 / 25,863,135 |

The controls are retained seed-1 default profiles, not fresh timed controls. All three fresh sessions are byte-identical to those references; settings, statistics, diagnostics and full reports match after removing only report.wallClockMs. These residual/violation counts are engine reports, not native scores. No median/p95 speed comparison, native check, full 26×3, dense, ladder or slow acceptance measurement was performed. Instrumented timing files are audit records only. Known native thermal errors remain unresolved; recovery stays default off.

Box and hull identities repeat heavily, but capsules dominate total calls and much of their identity churn is fresh geometry. Next: quantify which shapes belong to lattice insertion and establish invalidation/immutability ownership before preparing their cores. Any optimization requires differential tests, fresh alternating focused timings, and full 26×3 before adoption. Do not infer a speed gain from this census.

Reproduce from the repository root (requires the recorded source/spec hashes, Bun and existing dependencies):

```sh
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/core-census/reproduce.py "$PWD" /tmp/core-census-replay
bun docs/pr-assets/agent-fab-router-perf-local-rescue/core-census/probe.ts /tmp/core-census-replay/instrumented
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/core-census/verify.py docs/pr-assets/agent-fab-router-perf-local-rescue/core-census
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/core-census/plot.py
bun run typecheck
bun run check:layers
bun run test
```

Inputs, original engine source archive and licenses remain in the adjacent `default-slow-profile` package. `prepare.py` extracts source without modifying the checkout. The WeakSet probe covers repeated and distinct equal geometry, mutation visibility and fresh output wrappers; this is bounded instrumentation validation, not cache safety proof.
