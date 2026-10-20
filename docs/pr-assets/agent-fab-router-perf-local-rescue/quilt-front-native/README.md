# Bounded quilt front cache: fresh full native comparison

**Later replication:** the [reverse-order pair](../quilt-front-reverse/README.md) retains identical output but does not reproduce this speedup: total route −0.66%, median +0.15%, p95 +4.07%, sweep wall +0.16%. Read both pairs before assessing runtime benefit.

The candidate adds a 1,024-slot numeric front cache per quilt, preserving the original Map as the authoritative cache. Only `src/route/quilt.ts` differs in the isolated measured engines. Full candidate bytes, API controls, alternating replay measurements and source inversion are in [the prerequisite experiment](../quilt-front/README.md).

Fresh original then candidate sweeps each use the same frozen 26 cases × three repeats, host, cores 12–19 and nice 10. Identical wrappers enable existing local recovery. Required gates finish before native routing; no own heavy job overlaps measured routing. Every attempt is retained. Both sweeps complete with preserved controls, no interruption and supervisor exit 0. Supervisor wall time is 598.114 / 538.049 seconds; benchmark sweep wall time below excludes final report generation.

Observed summed route time improves 11.56%, aggregate median 9.50%, and aggregate p95 9.05%. Summed case medians improve 13.28% and summed case p95 10.29%. Twenty-five case medians and 24 case p95 values improve. Solenoid J4 median rises 0.7550 → 0.8557 seconds and p95 0.7984 → 0.8791; fan-controller J2-large p95 rises 0.8949 → 1.0134 seconds. Shared-host sequential sweeps cannot isolate causal runtime effects, and the candidate is not faster in every case.

All 78 paired sessions and final engine statistics are identical. No added native error or warning geometry, opens, or fidelity regression is found. Both modes retain 27 known native thermal errors; these remain unresolved and the suite is not DRC clean. Both required gates pass typecheck, layer checks (71 files, zero violations), and 912 tests / 399,733 assertions with zero failures.

| Full native metric (26 cases × 3 repeats) | Original | Front cache |
|---|---:|---:|
| Passed / 78 | 48 | 48 |
| Valid cases / 26 | 16 | 16 |
| Opens | 90 | 90 |
| New native errors (known, unresolved) | 27 | 27 |
| Median route seconds | 1.167854 | 1.056879 |
| p95 route seconds | 19.679421 | 17.899242 |
| Sum route seconds | 468.916279 | 414.710726 |
| Sweep wall seconds | 587.954642 | 528.184038 |
| Sum case medians seconds | 156.709248 | 135.894560 |
| Sum case p95 seconds | 161.892035 | 145.235971 |
| Sum vias | 2826 | 2826 |
| Sum length mm | 60450.378202 | 60450.378202 |

[All per-case measurements](table.md) retain median and p95, passed, opens and native errors. Copper counts and length in the aggregate table sum all repeats. Per-case p95 is the maximum of three; aggregate p95 is order statistic 75 of 78.

![Full native per-case route timings](timings.png)

Raw evidence includes all 156 checks, step records, inputs, sessions, effective settings, manifests, engine reports and complete benchmark controls/results/summaries. Source inventories and board licenses/provenance accompany the archive. Exact source comparison and the archived replay verifier check the isolated change and reject four malformed-native-evidence controls.

Exact reproduction uses the preparation, controls, sequential gates and native commands in [the prerequisite README](../quilt-front/README.md). Each sweep runs from the benchmark worktree:

```sh
taskset -c 12-19 nice -n 10 timeout --kill-after=5 3000 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source SOURCE/entry --out OUTPUT
```

Recheck the committed archive without routing or native tools:

```sh
n=docs/pr-assets/agent-fab-router-perf-local-rescue/quilt-front-native
PYTHONDONTWRITEBYTECODE=1 python3 "$n/verify.py"
```

The source-board fixtures, scoring, native checker, physical rules and shared runtime are unchanged. The full-suite evidence measures the exported engine API; it does not measure the application adapter's DSN exporter or live editor workflow.

The exact measured candidate is adopted in engine commit `790256b1`. Completed dense/ladder/slow validation and its limitations are retained in the [additional stress archive](../quilt-front/README.md). Dense single-pair timing is slower; the frozen-suite improvement is not a universal speed gain.
