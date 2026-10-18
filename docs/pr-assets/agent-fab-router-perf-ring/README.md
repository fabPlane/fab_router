# Exact ring containment measurements

The candidate rejects an edge only when the query is strictly outside its closed y interval,
which excludes both boundary membership and a ray crossing. For remaining edges it computes
the same exact cross product once, using it for both boundary membership and ray direction.
The closed y interval check supplies the y component of the original segment bounding check;
the x component is retained. Horizontal edges, repeated points, vertices and winding retain
the original decisions. No caching, geometry mutation, epsilon or routing settings change.

Baseline source: `69cf598`. Candidate source: `8dddcad`.
Both runs use host `hyper-ms-lin`, CPUs 12–19, nice 10, the frozen native benchmark,
and three seeds per case. Version order alternates by case. The host is shared with other
workloads; route-path times include adapter export/import and should not be treated as
isolated CPU measurements. Per-case p95 is nearest-rank (the maximum with only three repeats).

The earlier native-setting profile identified `pointInRing` at 14.42% self samples and
`onSeg` at 19.61% (three routes on the paperino case, 46,663 total samples). That motivated
this change. Those percentages describe the earlier profile, not a prediction of speedup.

## Reproduce

Prepare separate source checkouts at the two revisions. Use a benchmark checkout with
its private native runtime installed. Do not modify the frozen inputs or shared runtime.
From the candidate checkout:

```bash
taskset -c 12-19 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
taskset -c 12-19 nice -n 10 timeout 7200 python3 docs/pr-assets/agent-fab-router-perf-ring/paired-native.py --benchmark-checkout /home/hyper/bench/wt/fp-perf --baseline-source /home/hyper/bench/agents/codex-fabpcb-perf/scratch/baseline-checkout --candidate-source /home/hyper/bench/wt/fr-perf --out /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle4-paired
python3 docs/pr-assets/agent-fab-router-perf-ring/summarize-paired.py /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle4-paired --out docs/pr-assets/agent-fab-router-perf-ring --label cycle4
python3 docs/pr-assets/agent-fab-router-perf-ring/plot.py
taskset -c 12-15 nice -n 10 timeout 7200 bun run acceptance -- --tier slow --report /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle4-acceptance.json
```

`plot.py` requires matplotlib; analysis and the benchmark otherwise use standard Python.
The analyzer checks source/configuration identities, run chronology, all SES hashes and
native outcomes including existing failures before writing its report. Failed boards remain
in both the table and timing measurements; this is not a five-router ranking.

Fresh CPU profile command (run separately after the native timing command):

```bash
taskset -c 12-19 nice -n 10 timeout 1500 python3 docs/pr-assets/agent-fab-router-perf-ring/profile-pair.py --run /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle4-paired --out /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle4-profile --baseline-source /home/hyper/bench/agents/codex-fabpcb-perf/scratch/baseline-checkout --candidate-source /home/hyper/bench/wt/fr-perf
```

CPU profile samples are statistical self samples, grouped by function name; inlining and
sampling noise can move attribution. All three paired profiled route SES hashes must match.

## Fresh profile result

Three routes per version produced identical paired SES hashes. Baseline total samples: 44758; candidate: 34801.
Baseline self samples: `pointInRing` 4,597, `onSeg` 5,791, `withinRim` 5,470.
Candidate: 25, 1 and 6,800 respectively. Attribution moved into `withinRim`;
these counts cannot be interpreted as all predicate work disappearing. Direct profiled
route medians were 16.591 → 12.225 seconds.
They use one board and fixed seed 2 and are not a separate full-suite speedup estimate.

## Complexity ladder

Frozen local L1/L2 DSNs, three repeats per version, alternating order by repeat,
seed 1, exactly two passes, 600,000 ms per-route safety budget; no timeouts.
All twelve outputs have matching SES hashes by board. L1 completes; L2 retains
29 incompletes, with zero added router violations in both versions. This is a
router-counter comparison, not native DRC acceptance.

| Board | Before median s | After median s |
|---|---:|---:|
| L1 | 0.172 | 0.139 |
| L2 | 21.585 | 23.214 |

L2 regresses by 7.5% on the median. The individual repeats vary substantially;
retain this adverse result alongside the favorable native total.

```bash
taskset -c 12-19 nice -n 10 timeout 1800 bun docs/pr-assets/agent-fab-router-perf-ring/ladder.ts /home/hyper/bench/agents/codex-fabpcb-perf/scratch/baseline-source /home/hyper/bench/wt/fr-perf /home/hyper/bench/agents/codex-fabpcb-perf/scratch/ladder-inputs /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle4-ladder.json
```

Fresh baseline slow acceptance runs from its pinned checkout, concurrently on CPUs 16–19:

```bash
cd /home/hyper/bench/agents/codex-fabpcb-perf/scratch/baseline-checkout
taskset -c 16-19 nice -n 10 timeout 7200 bun run acceptance -- --tier slow --report /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle4-acceptance-before.json
```

Both final slow runs use four dedicated assigned cores per version. An initial candidate
run on eight cores was stopped during its first long routing case, before producing a report;
its scratch log is retained. It contributes no benchmark score. Native timing, profiling
and ladder comparisons all finished before the final slow runs began.

Compare the complete slow reports (including failures and timed-out progress):

```bash
python3 docs/pr-assets/agent-fab-router-perf-ring/compare-acceptance.py /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle4-acceptance-before.json /home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle4-acceptance.json --out docs/pr-assets/agent-fab-router-perf-ring/acceptance-comparison.json
```

## Slow acceptance result

Both fresh complete reports contain 63 cases: 51 pass, 12 fail, 14 advisory, zero stubs.
Baseline report head is `69cf598`; candidate report head is `ea4a2ae`, whose source,
acceptance tooling and spec inputs match production commit `8dddcad`. No pass regressions,
increased incomplete counters or increased router violations were observed. Both runners
exit 1 because existing failing cases remain; neither safety timeout fired.

Three budgeted cases have progress-counter differences, retained in `acceptance-comparison.json`:

| Case | Counter | Before | After |
|---|---|---:|---:|
| issue039 default | completed attempts | 294 | 300 |
| issue555 maxpasses40 | completed attempts / passes | 182 / 6 | 175 / 5 |
| issue555 strict | incompletes / completed attempts / passes | 19 / 199 / 8 | 17 / 206 / 9 |

Completed-attempt counters include work that can be ripped up; they are not final net completion.
The strict case has fewer incompletes within its time budget, but these time-sensitive progress
counters are not evidence of changed geometric decisions or a general quality improvement.
