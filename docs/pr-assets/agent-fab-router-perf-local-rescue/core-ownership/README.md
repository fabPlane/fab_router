# Convex core lattice provenance and mutation census

Diagnostic only. Production source, rules, defaults and test expectations are unchanged. Source revision `f34ec789` has the same 1,488 source/spec hashes as the adjacent original default-profile source archive. One seed-1 replay each, sequentially on the same host, cores 12–19, nice 10, 600-second timeout. All three completed without stopped or omitted attempts.

| Case | Retained control engine residual | Instrumented residual | Represented-rule additions control / instrumented | Lattice-provenance core calls / all calls | Repeated provenance calls | Changed core observations |
|---|---:|---:|---:|---:|---:|---:|
| Aquarius J4 | 8 | 8 | 0 / 0 | 32,719,825 / 112,539,936 | 32,715,288 | 0 |
| Sprinkler J3 | 2 | 2 | 0 / 0 | 7,417,542 / 36,808,829 | 7,416,605 | 0 |
| Shield J4 | 6 | 6 | 0 / 0 | 2,322,540 / 25,863,135 | 2,321,833 | 0 |

These are engine diagnostics, not native scores. Controls are retained default seed-1 references, not fresh timed controls. Sessions match byte for byte, and settings/results/reports match excluding only report.wallClockMs. Total core calls exactly match the previous all-caller identity census. Timing records include instrumentation overhead and must not be used for median/p95 or speed comparisons. No full 26×3, native check, dense, ladder or slow acceptance run was performed. Known native thermal errors remain unresolved; local recovery stays off by default.

`prepare.py` instruments an isolated source archive. When `shapesOf` lazily generates its cached geometry, it registers each convex part in a WeakMap with category provenance and a copied core coordinate/radius snapshot. Every subsequent original `coreOf` call still computes and returns the original fresh wrapper; counters compare its point count, ordered coordinates and radius with the registration snapshot. No cached core is returned. Snapshot construction calls the uninstrumented original helper and is excluded from conversion counts. Registration happens at lazy shape creation, not item insertion. No strong map retains shapes. Snapshot arrays remain only as weakly keyed values.

Provenance is not a live-membership claim: removal does not unregister retained geometry references. Removed shapes can still be counted if a caller retains and uses them. This does not measure bytes saved, active indexed shapes, or safe cache hits. Changes that happen and revert between observed calls are undetected. There is no static immutability proof.

The 19-check probe verifies distinct/fresh wrappers, mutation visibility, recursive pieces, duplicate registration rejection, coordinate/radius/point-count changes, degenerate capsule expansion, and actual lattice cache/rebuild/removal/reinsertion. It demonstrates that cached track endpoints alias mutable layout points. Mutating without reinsertion violates the existing lattice contract, but remains observable through existing geometry references. A future preparation optimization needs an explicit borrowed/immutable core contract and invalidation rules; it cannot silently change public `coreOf` ownership or mask these mutations.

The provenance fraction (29.07%, 20.15%, 8.98%) is materially smaller than all-caller repeated identity fractions from the preceding census. Even eliminating every such conversion would not eliminate the unowned work; call counts do not establish a runtime bound or speed gain. Next: benchmark explicit preparation only at clearance call sites, with an ownership-safe API and differential lifecycle coverage, before deciding whether to adopt it. Full matched 26×3 remains required before adopting any gain.

Reproduce from the repository root with Bun and existing dependencies:

```sh
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/core-ownership/reproduce.py "$PWD" /tmp/core-ownership-replay
bun docs/pr-assets/agent-fab-router-perf-local-rescue/core-ownership/probe.ts /tmp/core-ownership-replay/instrumented
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/core-ownership/verify.py docs/pr-assets/agent-fab-router-perf-local-rescue/core-ownership
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/core-ownership/plot.py
bun run typecheck
bun run check:layers
bun run test
```

The reproduction checks all tracked source/spec hashes before extracting source; six ignored historical acceptance CSVs are excluded, matching git archive. An initial whole-directory audit caught these extra outputs; all 1,488 archived files were unchanged. Inputs and licensed source archive are in adjacent `default-slow-profile`. Summary verification checks output parity, counter constraints and previous all-caller count parity. Instrumentation probe and independent reconstruction are additional bounded validations.

Required unchanged-root checks: typecheck PASS; 71 layer files, zero violations; 914 tests, zero failures, 649,747 assertions (321.60 seconds).
