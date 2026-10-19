# All-net local recovery research

This experiment routes every net in the original 60-pad stall fixture before
collecting its actual remaining connections. It replaces the isolated-net assumption
with live foreign copper as obstacles, resolves each target's own profile, preserves
ignored-net obstacles and runs the existing local transaction for each target.
No production source or default setting changes. The explicit adapter under
`candidate/src/api.ts` is only selected by a research benchmark invocation.

The existing pad-only graph leaves all six connections open, three of three
repeats. Adding optional bounding-box corners around foreign track segments and
barrels closes nets 6 and 8 in every repeat, at the 8-pitch region step. Net 4,
which closed with isolated routing, remains open with all nets active. Sweeping
the prior isolated route against the normal all-net session finds three blocked
legs and four foreign-track blockers; the isolated proof does not transfer.

Both graph variants use endpoint boxes grown through 0/4/8/16 pitches, at most
512 nodes per sheet, and a shared 100000 charged-work/15-second cooperative budget
per connection. The collector caps targets at 16 and skips unsupported non-pad
endpoints, disabled routing, ignored targets and an exact-dirty baseline. It
rechecks each target's current connectivity before trying it. The research adapter
also skips aborted/timed-out normal runs and respects the normal remaining item
cap. This is insertion only: full net-class width, existing angle shaping and
exact clearance predicates, no rip-up, vias, necking, margin or rule reductions.

The transaction validates retained copper, full copper containment in the local
region, exact DRC, every previously joined terminal group and actual target closure.
Misses and failures rewind through the live Journal. The graph is incomplete and
input ordered; reaching a node cap or exhausted region sequence does not establish
that no legal path exists. There is no whole-route deadline/abort propagation into
research recovery and no hard bound on validation time. Those are prerequisites
for any production integration, not claims of this adapter.

One frozen board, all nets active, same host/cores 12–19 and same seed/settings,
three independent normal routing repeats per variant. Native checking uses the
unchanged export/import/checker on both captured sessions from each copper-corner
repeat; inputs, project, custom rules and checker hashes are verified unchanged.

| Metric per repeat | Normal routing | Pad-only recovery | Copper-corner recovery |
| --- | ---: | ---: | ---: |
| Engine incomplete connections | 6 | 6 | 4 |
| New native errors | 0 | Not checked separately | 0 |
| Native opens | 6 | Same session as normal | 4 |
| Native board integrity | Pass | Same session as normal | Pass |
| Passed repeats | 0/3 | 0/3 | 0/3 |
| Track length mm | 171.235 | 171.235 | 281.792 |
| Vias | 1 | 1 | 1 |

The two closures add 110.557 mm: there is no completed-route length comparator or
speed claim. Four opens remain. Final pad-only added-recovery median/p95 seconds
are 0.643/0.643; copper-corner recovery 0.805/0.825. With three samples p95 is the
maximum. Normal-route timing varied across batches on the shared host and overlapped
tests/native work. Timing is additional recovery cost, not isolated performance.

![Actual all-net connections before and after](remaining-checks/connection.png)

[Final pad-only measurements](remaining-checks/whole-board-final.json),
[final copper-corner measurements](remaining-checks/whole-board-copper-final.json),
[paired native results and exact commands](remaining-checks/native-pair/results.json),
[isolated route collision diagnostic](remaining-checks/isolated-vs-whole.json),
[collector controls](remaining-checks/results.json) and
[source hashes](remaining-checks/source-hashes.json) retain the evidence. Three
synthetic tests verify per-net widths, ignored nets, target caps and copper-corner
detours; a fourth real all-net adapter test verifies exactly two closures with no
added exact violations. Omitting copper-corner generation breaks its regression.
The native board artifacts retain their input license beside the results.

## Reproduce

Run from this repository; every output argument must be unused. Use the private
benchmark checkout with its existing runtime; do not modify frozen inputs.

```bash
taskset -c 12-19 nice -n 10 timeout 900 bun docs/pr-assets/agent-fab-router-perf-local-rescue/run-remaining.ts /tmp/pad-only.json
taskset -c 12-19 nice -n 10 timeout 900 bun docs/pr-assets/agent-fab-router-perf-local-rescue/run-remaining.ts /tmp/copper-corners.json copper
taskset -c 12-19 nice -n 10 timeout 900 python3 docs/pr-assets/agent-fab-router-perf-local-rescue/check-remaining-native.py "$HOME/bench/wt/fp-perf" /tmp/copper-corners.json /tmp/paired-native
taskset -c 12-19 nice -n 10 timeout 180 python3 docs/pr-assets/agent-fab-router-perf-local-rescue/validate-remaining.py "$PWD" /tmp/collector-controls
taskset -c 12-19 nice -n 10 timeout 240 bun test test/recovery-candidate.test.ts
bun run typecheck && bun run check:layers && bun run test
```

For the complete native comparison, run sequentially from the benchmark checkout
(the harness holds an exclusive run lock):

```bash
cd "$HOME/bench/wt/fp-perf"
taskset -c 12-19 nice -n 10 timeout 7200 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source "$HOME/bench/wt/fr-perf" --out /tmp/normal-native
taskset -c 12-19 nice -n 10 timeout 7200 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source "$HOME/bench/wt/fr-perf/docs/pr-assets/agent-fab-router-perf-local-rescue/candidate" --out /tmp/research-native
cd "$HOME/bench/wt/fr-perf"
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/compare-remaining-native.py /tmp/normal-native /tmp/research-native "$PWD" /tmp/compared-native.json
```

Larger-input comparison (three repeats/mode/input, two normal passes, 120-second
normal route budget; native DRC and slow acceptance are separate):

```bash
taskset -c 12-19 nice -n 10 timeout 3600 bun docs/pr-assets/agent-fab-router-perf-local-rescue/run-remaining-large.ts /tmp/large.json "$HOME/bench/boards/ladder/l2.dsn" "$HOME/bench/boards/ladder/l3-cycle18.dsn" "$HOME/bench/boards/dense/dense6-bga324.dsn"
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/plot-remaining.py /tmp/copper-corners.json /tmp/paired-native/results.json /tmp/connection.png
```

The plot requires an existing Python environment with matplotlib. No generated
image or captured path is an input to the search. The normal route remains the
fallback; a research-only success does not enable recovery in production.

## Search work profile

Counts are deterministic cooperative work, not sampled CPU or heap allocation.
All three final repeats give these same counts. The two accepted routes retain
their full shaped vertices; the normal copper remains unchanged.

| Net id | Outcome | Charged work | Directed edges checked | Closing margin |
| --- | --- | ---: | ---: | ---: |
| 4 | exhausted | 31278 | 29665 | — |
| 6 | kept | 14743 | 13561 | 8 |
| 8 | kept | 23939 | 22626 | 8 |
| 9 | exhausted | 40585 | 38668 | — |
| 10 | exhausted | 43942 | 42018 | — |
| 11 | exhausted | 42656 | 40739 | — |

## Complete native comparison

Both runs use all 26 frozen cases × seeds 1/2/3, same host/cores 12–19, unchanged
input/settings/runtime/checker/order. The current normal-source sweep matches all
78 sessions and quality metrics from the prior cycle. The after sweep explicitly
selects the research adapter; all production defaults remain unchanged. Fifteen
sessions change across five cases, with the same closure gain on each seed. The
other 63 sessions match exactly. All attempts preserve native fidelity. New-error
details are compared by complete structured records, not just total counts; no
candidate error is introduced or substituted for an earlier finding.

| Metric, 78 attempts | Normal | Explicit research adapter |
| --- | ---: | ---: |
| Passed / cases valid 3-of-3 | 39/78 / 13/26 | 39/78 / 13/26 |
| Native opens | 120 | 99 |
| New native errors relative to frozen input | 27 | 27 |
| Attempt median / p95 seconds | 1.259 / 17.476 | 1.122 / 20.910 |
| Total route seconds | 421.212 | 436.166 |
| Total vias, summed across attempts | 2826 | 2826 |
| Total length mm, summed across attempts | 58809.321 | 60080.812 |

Opens improve 17.5%; no additional board passes. All 27 pre-existing thermal
errors remain unresolved: this suite is **not native DRC clean**. Recovery adds
copper at the full legal width, with no vias or changes to existing copper. Total
route time increases 3.55% and p95 increases; median variation on the shared host
is not a speed gain. Tests and other pinned work overlap the runs. The adapter
has no production setting and is not enabled by a downstream engine pin bump.

[Per-case median/p95, opens, errors, vias, length](remaining-checks/native-tables.md),
[all 78 paired measurements, per-target step logs and source/control identities](remaining-checks/native-comparison.json),
[normal-source historical control](remaining-checks/normal-native-verification.json).

Required final checks pass: typecheck; 65 files / zero layer violations; 873 tests,
zero failures, 398997 assertions in 276.31 seconds. A prior full check also passed
872 tests before adding the real adapter regression; its targeted run passes.
No executable TypeScript changes follow the final full check. Report scripts are
separately syntax-checked and the comparison executed successfully. The inspected
PNG regenerates byte-for-byte. Prior exploratory 3-repeat batches remain in cycle
scratch and have identical corresponding session hashes; no routing measurements
were discarded. Two candidate launch attempts encountered the benchmark's exclusive
lock before creating an output or running an attempt; the final sweep started only
after the normal process exited. No lock bypass or frozen runtime/checker edit.

Across all 78 native attempts the adapter logs 87 collected targets:
21 kept, 30 region/graph misses, 30 cooperative-budget stops and six unsupported
non-pad endpoint pairs. All budget stops charged 100000 work units. Every kept
connection records its successful region step; the raw log includes rejected
steps. These are engine collection counts, not a replacement for native opens.
The remaining work includes via transitions and pour/track attachment, plus full
route-budget/abort propagation and avoiding recovery setup on completed boards.
Full slow acceptance with recovery enabled is still required before production
integration; the current public pipeline remains unchanged.
