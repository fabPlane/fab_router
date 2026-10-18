# Lattice collection experiment

The production experiment is rejected: the 2.9% native aggregate gain is outweighed by the synthetic sweep and L2 ladder regressions. The retained changes are benchmark tooling, evidence and a mutating-filter regression test. `rejected-grid.patch` records the rejected source change as a zero-context diff (`git apply --unidiff-zero` if applying it manually).

Baseline: `69cf598`. Experimental source: `4f99c3d`. These measurements concern only the grid collector; they are independent of the other open performance branches.

The experiment removes the temporary expanded bounds object from box queries and selects the box/sweep intersection predicate once per query. Box coordinates are captured before filters run. A regression test covers a mutating filter, duplicate bucket visits, rejection and the oversize shelf. Existing randomized lattice tests compare results with brute-force queries under insertion/removal churn, and routing fingerprint tests pin deterministic output.

`cycle6-measurements.json` retains all 156 native attempts and their provenance. The analyzer checks exact source/configuration hashes, case coverage, seeds, schedule chronology, all 78 paired SES hashes, outcomes, opens, error types, fidelity, vias and length. All pairs match. Both versions retain 39/78 passing attempts, 13/26 cases passing 3/3, 120 opens and 27 new native errors; these existing failures remain visible.

The sum of case medians is 128.882 → 125.119 seconds (2.9% lower), and total route-path time is 389.208 → 375.609 seconds. Twelve case medians improve and fourteen regress. This is one experiment on a shared host, with alternating version order by case. Small cases mostly regress; Aquarius supplies most of the aggregate gain. No own unit tests overlapped native timing. Per-case p95 uses the nearest-rank definition and is the maximum of three observations.

`profile-summary.json` contains the three-route CPU-profile summary and report/session hashes. Baseline grid collection/test/push helpers account for approximately 19% of samples. Sequential profiled route medians were 12.109 → 14.861 seconds (slower). Candidate profile timing overlapped the start of unit tests, so it is not isolated speedup evidence; named sample attribution also changes with JIT inlining.

`query-measurements.json` retains the synthetic query experiment: two thousand indexed slots, deterministic queries, one million calls per timing row, seven repeats/version/path with repeat zero excluded as warmup. Box medians are 0.194008 → 0.169437 seconds; sweep medians are 0.174681 → 0.191101 seconds (slower). Checksums are sanity checks; randomized property tests and native SES comparisons provide the stronger correctness evidence. The synthetic box path receives the same Dop8-shaped query objects as the sweep path; actual box callers may have a different object shape. These timings do not establish general board-routing performance.

The fixed-two-pass ladder experiment uses three repeats/version/board with version order alternating by repeat, seed 1 and a 600-second budget. All twelve session hashes match and no route times out. L1 medians are 0.143631 → 0.139673 seconds (complete); L2 medians are 17.283342 → 18.772843 seconds (8.6% slower), with 29 incompletes and zero added router violations both. These are router counters, not native DRC. Inputs are frozen in the scratch ladder-input directory, and their hashes are included in every row.

Reproduce from this branch's router checkout. Create a separate experimental source checkout because this branch discards the production rewrite. The baseline checkout remains at `69cf598`:

```bash
git worktree add -b agent/fab-router-perf-grid-reproduce /home/hyper/bench/agents/codex-fabpcb-perf/scratch/grid-reproduce 4f99c3d
taskset -c 12-19 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
taskset -c 12-19 nice -n 10 timeout 10800 python3 docs/pr-assets/agent-fab-router-perf-grid/paired-native.py --benchmark-checkout /home/hyper/bench/wt/fp-perf --baseline-source /home/hyper/bench/agents/codex-fabpcb-perf/scratch/baseline-checkout --candidate-source /home/hyper/bench/agents/codex-fabpcb-perf/scratch/grid-reproduce --out /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle6-reproduce
python3 docs/pr-assets/agent-fab-router-perf-grid/summarize-paired.py /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle6-reproduce --out /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle6-reproduce-summary --label reproduce
taskset -c 12-19 nice -n 10 timeout 600 bun docs/pr-assets/agent-fab-router-perf-grid/query-bench.ts /home/hyper/bench/agents/codex-fabpcb-perf/scratch/baseline-checkout /home/hyper/bench/agents/codex-fabpcb-perf/scratch/grid-reproduce /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle6-query-reproduce.json
taskset -c 12-19 nice -n 10 /home/hyper/bench/agents/codex-fabpcb-perf/scratch/plot-venv/bin/python docs/pr-assets/agent-fab-router-perf-grid/plot.py --measurements /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle6-reproduce-summary/reproduce-measurements.json --output /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle6-reproduce-summary/native-speedup.png
```

Use a new native output directory when reproducing; recorded completed runs are immutable. The helper rejects incompatible resumes. Plotting requires matplotlib. Native route times include required conversion/import/cleanup, while independent checking and rendering are separate. Frozen cases/settings/checker/runtime were not edited.

```bash
taskset -c 12-19 nice -n 10 timeout 2400 bun docs/pr-assets/agent-fab-router-perf-grid/ladder-route.ts /home/hyper/bench/agents/codex-fabpcb-perf/scratch/baseline-checkout /home/hyper/bench/agents/codex-fabpcb-perf/scratch/grid-reproduce /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle6-ladder-inputs /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle6-ladder-reproduce.json
taskset -c 16-19 nice -n 10 timeout 7200 bun run --cwd /home/hyper/bench/agents/codex-fabpcb-perf/scratch/baseline-checkout acceptance -- --tier slow --report /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle6-slow-before-reproduce.json
taskset -c 12-15 nice -n 10 timeout 7200 bun run --cwd /home/hyper/bench/agents/codex-fabpcb-perf/scratch/grid-reproduce acceptance -- --tier slow --report /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle6-slow-after-reproduce.json
python3 docs/pr-assets/agent-fab-router-perf-grid/compare-acceptance.py /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle6-slow-before-reproduce.json /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle6-slow-after-reproduce.json --out /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle6-slow-comparison-reproduce.json
```

The recorded slow runs execute simultaneously on disjoint four-core sets; the commands above can also be run sequentially. The runner returns 1 for existing acceptance failures. Reports and comparator output must be inspected even when the exit code is nonzero. The original query experiment used an archive of baseline `69cf598`; its grid source hash was verified against that commit. Its row-level source identity is retained in the measurement file.

The profile uses the frozen exported Paperino input and native settings from this work directory:

```bash
mkdir -p /home/hyper/bench/agents/codex-fabpcb-perf/scratch/grid-profile-reproduce
taskset -c 12-19 nice -n 10 timeout 600 bun --cpu-prof --cpu-prof-dir /home/hyper/bench/agents/codex-fabpcb-perf/scratch/grid-profile-reproduce docs/pr-assets/agent-fab-router-perf-grid/profile-route.ts /home/hyper/bench/agents/codex-fabpcb-perf/scratch/baseline-checkout /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle5-paired/before/paperino-hw-paperino-shield-j4/runs/run-20261018T172604.932530Z-002/fab-router/work 3
taskset -c 12-19 nice -n 10 timeout 600 bun --cpu-prof --cpu-prof-dir /home/hyper/bench/agents/codex-fabpcb-perf/scratch/grid-profile-reproduce docs/pr-assets/agent-fab-router-perf-grid/profile-route.ts /home/hyper/bench/agents/codex-fabpcb-perf/scratch/grid-reproduce /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle5-paired/before/paperino-hw-paperino-shield-j4/runs/run-20261018T172604.932530Z-002/fab-router/work 3
```

Run these without overlapping tests if making a fresh profile timing comparison. The native benchmark creates equivalent frozen DSN/manifest/settings exports when reproducing in another results directory.

Fresh complete slow acceptance: both 63 cases, 51 passed, 12 failed, 14 advisory and zero stubs. Both runners exit 1 for the existing failing cases; the supervisor exits 0 after verifying complete reports and unchanged source/spec/tools hashes. The comparator exits 1 as expected because the rejected candidate has two worse completion counters: `routing-slow-issue555-cnh-maxpasses40` 20 → 21 incompletes, and `routing-slow-issue555-cnh-strict` 17 → 18. Added router violations remain zero. These time-limited regressions are retained explicitly rather than inferred from the matching aggregate pass count.

`slow-comparison.json` retains both full reports, the regression list and every non-timing counter change. Four cases change counters: CM5 complete passes 9 → 10; issue039 passes 5 → 4 and completed attempts 360 → 332; maxpasses40 passes 5 → 6, completed attempts 175 → 183, length 4525.167 → 4606.368 mm and added tracks 307 → 308; strict completed attempts 206 → 207, length 4658.291 → 4725.244 mm and added tracks 325 → 324. The latter two cases also have the increased incompletes above. These counters depend on time limits and are not a quality-improvement claim. `extra-provenance.json` records exact source hashes and run window for the ladder and fresh slow suites.

Final validation after restoring the original production collector: typecheck and layer checks pass (65 files, zero violations); 860 unit tests pass with 398457 assertions in 214.53 seconds. The initial experimental-source run also passed all 860 tests (216.91 seconds). The final PR changes only this evidence/tooling and the mutating-filter regression test; production source matches `69cf598`.

## Cycle 7: query shapes and restored-source control

`query-shapes.ts` replaces the checksum-only exploratory check with exact ordered-reference comparisons for all ten thousand queries before timing. A deliberately reversed-result candidate preserves sum-of-id checksums and is rejected by this preflight. The harness refuses to overwrite a result file. It records input and grid-source SHA-256, ordered-result SHA-256, Bun version, CPU affinity and UTC run window.

Each workload runs in a separate process: plain four-property Box queries, Dop8-shaped objects passed as boxes, and swept Dop8 queries. This keeps object shapes and query modes separate at the timed call site; baseline and candidate alternate order by repeat within each process. Every timing row executes ten million queries against the same two thousand indexed slots. There are six measured repeats/version plus excluded repeat-zero warmup. Both sources are still baseline `69cf598` and rejected experimental collector `4f99c3d`. All exact preflight comparisons pass. This is synthetic query timing, not native DRC or proof of general routing performance. Own native/tests do not overlap these final measurements.

| Workload | Before median s | Rejected candidate median s | Ratio before/after |
|---|---:|---:|---:|
| box-plain | 1.793344 | 1.679893 | 1.068× |
| box-dop8 | 1.707496 | 1.673515 | 1.020× |
| sweep | 1.643332 | 1.702291 | 0.965× |


![Isolated query shapes](query-shapes.png)

The candidate remains rejected: these synthetic results do not supersede the adverse L2 ladder and slow-completion evidence from cycle 6. No production changes were made in cycle 7.

A fresh full native control compares baseline `69cf598` with restored-source head `5f3659b`, whose `src`, `spec` and `tools` trees match the baseline. The analyzer verifies source/configuration hashes and chronology, plus all 78 paired SES hashes, outcomes, opens, error types, fidelity, vias and length. Both versions retain 39/78 passing attempts, 13/26 cases passing 3/3, 120 opens and 27 new native errors. Existing failures persist. Sum of case medians is 126.538 → 129.335 seconds despite identical production source: this is host variation, not an optimization. The first baseline case overlaps the earlier one-million-call exploratory plain-Box microbenchmark for a few seconds; its separate scratch result is excluded from the query table. There is no own unit-test overlap with native timing. Full per-case median/p95 results and all attempt/provenance data are in `cycle7-restored-tables.md` and `cycle7-restored-measurements.json`.

Reproduce the final query experiment after creating the separate experimental checkout and baseline described above. Use a new output directory; the following path must be empty of prior query result files:

```bash
mkdir -p /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle7-query-reproduce
for kind in box-plain box-dop8 sweep; do
  taskset -c 12-19 nice -n 10 timeout 600 bun docs/pr-assets/agent-fab-router-perf-grid/query-shapes.ts /home/hyper/bench/agents/codex-fabpcb-perf/scratch/baseline-checkout /home/hyper/bench/agents/codex-fabpcb-perf/scratch/grid-reproduce "$kind" "/home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle7-query-reproduce/cycle7-$kind.json"
done
taskset -c 12-19 nice -n 10 /home/hyper/bench/agents/codex-fabpcb-perf/scratch/plot-venv/bin/python docs/pr-assets/agent-fab-router-perf-grid/plot-query-shapes.py /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle7-query-reproduce
taskset -c 12-19 nice -n 10 timeout 10800 python3 docs/pr-assets/agent-fab-router-perf-grid/paired-native.py --benchmark-checkout /home/hyper/bench/wt/fp-perf --baseline-source /home/hyper/bench/agents/codex-fabpcb-perf/scratch/baseline-checkout --candidate-source /home/hyper/bench/wt/fr-perf --out /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle7-restored-reproduce
python3 docs/pr-assets/agent-fab-router-perf-grid/summarize-paired.py /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle7-restored-reproduce --out /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle7-restored-reproduce-summary --label restored
```

Typecheck, layer checks and the complete unit suite pass again. The standalone query harness also passes strict TypeScript checking. No fresh slow acceptance or ladder run was needed for this evidence-only change; production code remains identical to the baseline, and all prior adverse experimental results remain retained.
