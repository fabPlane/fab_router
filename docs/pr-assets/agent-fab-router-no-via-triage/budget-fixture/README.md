# Finite-grid pop-budget reproducer

A synthetic 30×30 search grid reproduces the previously observed budget exhaustion without a board corpus. This is a reduced example of the mechanism, **not** a minimization of the original DSN or proof of the root cause of every remaining open. No production source, test expectation, or budget changes are adopted.

A wall occupies x=15, y=0…28. The start is (14,0), the goal (16,0), and the gap is (15,29). A flood using the same bounds and predicates reaches all 871 free cells, including the goal. Eight directions, unit step cost, bend cost 10. The generated path is checked against every node/edge predicate, endpoint, bounds, and allowed direction. The fixture uses a graph predicate, not physical copper clearance.

Same process/host/core set, three repeats per budget:

| Metric | Driver formula: max(4000,900) | Diagnostic budget: 32000 |
| --- | ---: | ---: |
| Successful searches | 0/3 | 3/3 |
| Heap pops each repeat | 4001 | 4437 |
| Unique popped states | 2809 | 3141 |
| Unique popped cells | 432 | 488 |
| Stale entries skipped | 1044 | 1148 |
| Returned path points | 0 | 61 |

The search increments its counter before testing the cap and stale-entry check. Thus the failed run reports cap+1 and that final popped entry is not processed. The successful run needs only 3289 non-stale pops (including the goal), below 4000. This separates stale-entry accounting from directional state multiplicity for this example. Merely counting cells is insufficient to predict heap work; changing the budget contract or skipping stale work would require separate cancellation, timing, routing, and native safety evaluation.

`probe.ts` asserts the existing limitation as a diagnostic; it is not installed as a failing production regression. `instrument.py` copies and instruments search source only in a new output directory; production files remain untouched. It asserts identical measurements across three repeats. Its source hash is recorded in `audit.json`. Neither run is a scored routing benchmark. No native thermal, completion, or performance improvement is claimed. Historical full native/rejected proposal evidence remains in the parent directory.

From the repository root:

```sh
taskset -c 20-25 nice -n 10 timeout 60 bun docs/pr-assets/agent-fab-router-no-via-triage/budget-fixture/probe.ts > /tmp/budget-grid-results.json
python3 docs/pr-assets/agent-fab-router-no-via-triage/budget-fixture/instrument.py --out /tmp/budget-grid-instrumented
python3 docs/pr-assets/agent-fab-router-no-via-triage/budget-fixture/render.py
taskset -c 20-25 nice -n 10 timeout 900 sh -c 'bun run typecheck && bun run check:layers && bun run test'
```

The instrumentation output directory must not already exist. Results, raw pop counts and measured render are committed alongside this document.
