# Cycle201: bounded native thermal search

Implementation: `88a89a42aaf6c45b9314f05e88f64cadd216a053`.
The new opt-in offline command connects the prior single/pair proposal families to
the three-board native repair boundary. It does not change the text router, adapter
or scored benchmark path. It does not apply boards to an editor or provide undo.

On the same complete J2-small routed snapshot, three final-version repeats each
remove two introduced native thermal errors, preserving zero opens and all source
and routed terminal pairs. Each uses two stages, 38 checked proposals and 123 native
DRC checks. All three repaired board hashes match. Incomplete one-stage progress
publishes nothing, as covered by the complete-board regression.

| Measurement | Before | After | Repeats |
|---|---:|---:|---:|
| Introduced thermal errors in complete-board offline search | 6 | 0 | 3 |
| Opens / lost source pairs / lost routed pairs | 0 / 0 / 0 | 0 / 0 / 0 | 3 |
| Accepted complete offline repair bundles | 0/3 | 3/3 | 3 |
| Scored routing passes / cases passing 3/3 | 39/78 / 13/26 | 39/78 / 13/26 | 26 cases ×3 seeds |
| Scored opens / introduced native thermal errors | 120 / 27 | 120 / 27 | 26 cases ×3 seeds |

The full-suite before is the retained cycle196 main-source run (69cf598); the after
is a fresh cycle201 78-run benchmark. All outcomes and source/input/config/harness/
runtime hashes, seeds and CPU affinity match. No speed claim. The production router
does not invoke the new offline command and all 27 scored thermal errors remain.
The other two native thermal cases were not searched here.

Required checks exited zero: typecheck, layer check (65 files, zero violations),
909 tests, zero failures, 398,693 assertions. The complete-board regression has
14 assertions and passed in 335.54 seconds. Feature fail-first was an expected
missing-module error, not a demonstrated pre-existing behavioural safety regression.
`fail-first.log.gz` retains it. A separate exploratory run loaded the initial code
before the explicit source-open condition was added; its opens are all zero. It is
retained separately, excluded from the final three-repeat result. All measured
native/test processes finished successfully. Initial packaging failed because
Matplotlib was unavailable; the final chart uses SVG and rsvg-convert. No measured
code changed during packaging. No attempted candidate or completed run is omitted.

`search-native.tar.xz` contains every generated proposal, including those never
checked after an earlier successful proposal, all checked reports and exact bundles,
source/routed rule snapshots, exploratory results, a native recheck of the extracted
bundle, and captured licenses. Diagnostic preference files are excluded.
`router-before-after.tar.xz` contains both complete scored-run directories and licenses.
The XZ format reduces repetition across whole boards. `provenance.json`, source hashes,
process statuses and compressed logs record the execution details.

Reproduce searches and required checks from the repository root:

```bash
taskset -c 20-25 nice -n 10 bun run typecheck
taskset -c 20-25 nice -n 10 bun run check:layers
taskset -c 20-25 nice -n 10 bun run test
taskset -c 20-25 nice -n 10 python3 docs/pr-assets/agent-fab-router-native-drc-gate/c201-thermal-search/reproduce.py --repo "$PWD" --out /tmp/c201-thermal-reproduction
python3 docs/pr-assets/agent-fab-router-native-drc-gate/c201-thermal-search/verify.py /tmp/c201-thermal-reproduction
cd /home/hyper/bench/wt/fp-bugs
taskset -c 20-25 nice -n 10 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --out /tmp/c201-router-reproduction
```

Independently replay saved evidence without rerouting:

```bash
mkdir /tmp/c201-saved-evidence
tar -xJf docs/pr-assets/agent-fab-router-native-drc-gate/c201-thermal-search/search-native.tar.xz -C /tmp/c201-saved-evidence
tar -xJf docs/pr-assets/agent-fab-router-native-drc-gate/c201-thermal-search/router-before-after.tar.xz -C /tmp/c201-saved-evidence
python3 docs/pr-assets/agent-fab-router-native-drc-gate/c201-thermal-search/verify.py /tmp/c201-saved-evidence/native
python3 docs/pr-assets/agent-fab-router-native-drc-gate/c201-thermal-search/compare-router.py /tmp/c201-saved-evidence/router /tmp/c201-saved-evidence/router/before "$PWD"
```

The verifier independently recomputes connected-pair losses from pad group
memberships, checks strict progress and exact snapshot/bundle hashes. Acceptance
remains limited to the existing fidelity boundary; complete metadata fidelity and
editor transaction/power-loss guarantees remain outside scope.
