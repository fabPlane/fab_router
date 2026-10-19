# Route snapshot statistics use resolved rules

`routeDsn` and CLI route JSON measured statistics without the effective settings,
even after the route report itself was corrected. Both statistics snapshots now
receive the resolved clearance rules used by routing. Their connection totals
continue to describe the whole board, including groups skipped during routing (N-07). A stricter
edge rule and an explicit zero override each reproduce the bug through both
entry points: all four regressions fail on `183752ac` and pass on final candidate `8d795963`. Two additional scope guards pass on the
control, fail on the rejected broad-settings experiment, and pass on the final candidate.

This fresh paired measurement compares control `183752ac` (which already includes
the route-report correction) with candidate `8d795963`, on `hyper-ms-lin`, cores
20–25, native checker 10.0.6, all 26 frozen cases and three seeds each. All attempts
are retained. No frozen inputs, checker, scoring, adapter or runtime changes.

| Same 26 cases, three seeds each | Before | After |
| --- | ---: | ---: |
| Before-statistics mismatches | 18 | 0 |
| After-statistics mismatches | 18 | 0 |
| Passing native runs | 39 | 39 |
| Cases passing 3/3 | 13 | 13 |
| Native opens | 120 | 120 |
| New native thermal errors | 27 | 27 |
| Median full route-path seconds | 1.119 | 1.071 |

| Affected case (three seeds each) | Before each snapshot | After each snapshot |
| --- | ---: | ---: |
| fan-controller-fan-controller-j2-large | 0 | 10 |
| fan-controller-fan-controller-j2-medium | 0 | 10 |
| fan-controller-fan-controller-j2-small | 0 | 10 |
| hellscribe-hellscribe-j2-large | 0 | 4 |
| qrpcard-qrpcard-j2-medium | 0 | 4 |
| qrpcard-qrpcard-j2-small | 0 | 4 |

Every paired native outcome, fidelity result, via count, length and returned SES
is identical. All non-violation statistics fields and all route-report fields
except elapsed time are also identical. Both corrected snapshots agree with
direct configured DRC, including a replay of the returned session for the final
snapshot. Eighteen runs across six retained-copper cases previously omitted 126
inherited internal findings from each snapshot. The three affected fan-controller
variants now report 10 each; the large retained-copper hellscribe and medium/small
retained-copper qrpcard variants report four each, in all three seeds. These are
internal model findings, not native baseline errors or thermal validation.

Typecheck and layer checks pass; **869 tests pass, zero fail**, 398494 assertions. Six new regressions pass.
The full run took 224.71 seconds (`checks-final.log`). Both final paired native arms overlap required test runs; no speed improvement is claimed. Native thermal failures
remain unresolved; no routing gain or integration pin bump is claimed.

An initial complete candidate at `7556a39f` corrected DRC statistics but also
filtered whole-board connection totals in 27/78 runs (54 snapshots). It was
REJECTED. All 78 sessions and native outcomes still matched; complete rejected
results, controls, audit, comparator failure and drift details are retained here.
The two scope guards fail on that candidate. Final `8d795963` restores the original
statistics scope. All three completed benchmark arms are logged separately.

The first setup attempt used an archive without Git metadata and stopped before
any router execution. Its log is retained; it is excluded from benchmark totals.
The successful control uses an isolated branch/worktree. Full raw native boards
remain in the agent scratch directory; per-attempt results, controls, audits,
paired session hashes and logs are committed here.

Reproduce from the candidate repository root, with the local integration runtime
installed and fresh output/worktree directories:

```sh
R=docs/pr-assets/agent-fab-router-fix-report-clearances/c188-stats
S=/tmp/route-stats-comparison
mkdir -p "$S"
git worktree add -b agent/report-stats-control "$S/before-source" 183752ac01e212a63ebdfc03c7f069159fbb95bb
FP=/home/hyper/bench/wt/fp-bugs
(cd "$FP" && taskset -c 20-25 nice -n 10 timeout 3600 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source "$S/before-source" --out "$S/before")
(cd "$FP" && taskset -c 20-25 nice -n 10 timeout 3600 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --out "$S/after")
taskset -c 20-25 nice -n 10 timeout 120 bun "$R/audit.ts" "$PWD/src/api.ts" "$S/before" > "$S/before-audit.json"
taskset -c 20-25 nice -n 10 timeout 120 bun "$R/audit.ts" "$PWD/src/api.ts" "$S/after" > "$S/after-audit.json"
python3 "$R/compare.py" --before "$S/before" --after "$S/after" --before-audit "$S/before-audit.json" --after-audit "$S/after-audit.json" --out "$S/comparison.json"
taskset -c 20-25 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Snapshot accuracy and native outcomes](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-report-clearances/docs/pr-assets/agent-fab-router-fix-report-clearances/c188-stats/comparison.png?raw=true)
