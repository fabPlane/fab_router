# Ordered hole sifting experiment

The heap candidate retains the production comparison sequence: compare the left
child with the saved parent, then the right child with that selected entry. Moving
the selected child into the hole avoids rewriting the saved parent at every level.
The saved parent is written once at the final position. This preserves the ordering
behavior even when comparisons involve NaN; choosing the smaller child first did
not preserve that behavior in the prior experiment.

The preceding [search-state profile](../search-profile/README.md) assigns
1,311,920 of 47,987,329 microseconds of sampled weight to heap operations
(2.73%). This motivates testing fewer array writes; sampled weight is neither
a call count nor a predicted speedup. No new CPU profile is claimed here.

The driver extracts the current production heap by source boundaries and builds
the candidate in memory. The optional third argument writes a complete candidate
module into an isolated scratch tree. Production routing code, defaults, rules and
the consumer pin remain unchanged. Calls to pop require a nonempty heap, as in the
production caller. Unused backing-array cells are outside this parity contract.

The deterministic corpus covers 79,940 pops: equal priorities 13,394; mixed
operations 13,276; growth 20,000; clear/reset 6,673; exceptional f priorities
13,208; exceptional f/h priorities 13,389. All match the original popped fields
with Object.is. The finite scenarios additionally match an independent linear-scan
queue. Periodic checks compare 23,718,744 live backing-array values, including
sequence/state fields. There are 21 clears. This finite corpus is empirical
coverage, not proof for arbitrary input sequences. A child-first mutation is
rejected. Six short synthetic timing pairs are diagnostic only.

The complete-board experiment uses three sequential alternating original/candidate
pairs on cores 12–19, nice 10, with recovery enabled identically. Every session,
statistic, effective setting and report (excluding elapsed time), and every
recovery decision (excluding nested seconds), must match an independent archived
native-workload control. These engine replays do not run a new native check.
Known historical native thermal errors remain unresolved.

All six replays match the independent control. Original median is 54.246187
seconds and candidate median is 50.435392 seconds (−7.03%). The third candidate
replay is slower than its paired original; these short shared-host observations
do not establish a reliable speed gain. A separate [fresh full native
comparison](../heap-ordered-native/README.md) evaluates all frozen cases.

See [table.md](table.md) and [summary.json](summary.json) for measured results.
Required typecheck and layer checks (71 files, zero violations) pass in both
isolated trees after routing. Both full unit suites pass 912 tests / 399,733
assertions: original 337.82 seconds, candidate 332.44 seconds. These unit-suite
elapsed times are not routing speed measurements. The archive verifier rejects nine source/record
corruptions. A production adoption additionally requires fresh full 26×3 native
speed/quality comparisons, dense input, ladder L2/L3 and enabled slow acceptance.

Reproduce from the repository root on the benchmark host with unused paths:

```sh
p=docs/pr-assets/agent-fab-router-perf-local-rescue/heap-ordered-hole
s=/home/hyper/bench/agents/codex-fabpcb-perf/scratch/ordered-hole-repro
python3 "$p/prepare.py" "$s/work"
python3 "$p/mutation.py" "$s"
python3 "$p/run.py" "$s"
PYTHONDONTWRITEBYTECODE=1 python3 "$p/collect.py" "$s" "$s/report"
python3 "$p/report.py" "$s/report"
```

Replay the committed evidence without routing:

```sh
p=docs/pr-assets/agent-fab-router-perf-local-rescue/heap-ordered-hole
PYTHONDONTWRITEBYTECODE=1 python3 "$p/verify.py" /tmp/ordered-hole-summary.json
cmp /tmp/ordered-hole-summary.json "$p/summary.json"
taskset -c 12-19 nice -n 10 timeout 90 bun "$p/verify.ts" /tmp/ordered-hole-parity.json
```

All deterministic parity fields should reproduce exactly; elapsed timings vary.

The full-suite speed gate is unfavorable: total route time +4.42%, aggregate
median +9.80%, and 22 case medians worse. The candidate is parked; production
source and the consumer pin remain unchanged. No larger-input or slow acceptance
run is claimed for this revision.
