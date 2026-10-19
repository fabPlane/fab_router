# Reach a pour through its existing connected copper

The real power-supply J4 residual links front-sheet pad 10 to back-sheet pour 81. The latter is already connected to through-hole pad 75. A point-to-pour visibility search has no common sheet, but reaching pad 75 on the front sheet closes the original terminals. The final engine selects the nearest compatible existing pad/barrel in that live pour component, using distance then item id. It tries one anchor, preserving existing per-target limits. In raw logs, `anchorPair` identifies the selected ids; a carried `airlineLu` is the original pending link estimate, not the alternative point distance. Ordinary point targets keep their original path and charged work.

This is insertion-only recovery under the existing default-off `localRecovery` setting. Four local boxes grow by 0/4/8/16 pitches around the actual point anchors. Width, clearance, via size, lattice, normal routing and scheduler budgets are unchanged. The scheduler verifies alternate anchors belong to the original terminal components; every transaction must still close the **original** pad/pour pair and preserve retained copper, exact DRC, terminal connectivity and the full-copper region. Failed proposals rewind through the existing journal.

The component scan checks route cancellation/deadline between point candidates. Connectivity rebuilding and exact validation are synchronous and not preemptible. The 100,000-work-unit/15-second cap is cooperative visibility budgeting, not a bound on all geometry work. This does not adopt the earlier boundary-witness experiment. Direct pour contacts and pour-to-pour search remain unsupported, as do the wider margin/width/grid relaxation stages. Default promotion remains deferred, including the known native thermal issue and retained timed adverse observations.

The source pin before is `f1680dbc9d12eeb823ed414583445fc40c1b682f`; the final engine commit is `c9f946dca2b9126dd5d17ccf6d8a93b64c44dd11`. `source-audit.json` binds all 85 module/type files to both revisions and the measured snapshots. Only two engine modules differ. The post-freeze settings Markdown clarification is recorded separately. Archive reproduction matches all 85 files for each source. Snapshot-local commits in harness records are measurement provenance, not consumer pins.

`results.md` contains all 26 per-case median/p95 and quality tables, larger-input and native Dense6 measurements, and every slow adverse observation. Timings overlap tests/stress work on the same host; no causal speed gain is claimed. The image is actual checked native F.Cu copper at its measured width, with pad bounds shown only as context. `extract-native.py` verifies board hashes, unchanged old segments and unchanged visible vias; `plot-native.py` draws the extracted geometry without routing it.

## Reproduce

Use fresh output directories. The benchmark checkout needs its private prepared runtime. The frozen suite/checker/rules are unchanged. Both source wrappers enable the real public setting; no routing implementation is in the wrappers.

```bash
cd /home/hyper/bench/wt/fr-perf
component_assets=docs/pr-assets/agent-fab-router-perf-local-rescue/component-anchors
component_sources=/home/hyper/bench/agents/codex-fabpcb-perf/scratch/repro38-sources
component_results=/home/hyper/bench/agents/codex-fabpcb-perf/scratch/repro38-native
python3 "$component_assets/prepare.py" "$PWD" f1680dbc9d12eeb823ed414583445fc40c1b682f c9f946dca2b9126dd5d17ccf6d8a93b64c44dd11 "$component_sources"
taskset -c 12-19 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
python3 "$component_assets/native.py" "$component_sources/before" "$component_sources/after" /home/hyper/bench/wt/fp-perf "$component_results"
python3 "$component_assets/compare-native.py" "$component_results/before" "$component_results/after" /home/hyper/bench/agents/codex-fabpcb-perf/scratch/repro38-native-comparison.json
taskset -c 12-19 nice -n 10 timeout 120 bun "$component_assets/residual.ts" "$component_sources/before" "$component_sources/after" "$component_results/before" /home/hyper/bench/agents/codex-fabpcb-perf/scratch/repro38-residual.json
taskset -c 12-19 nice -n 10 timeout 90 bun "$component_assets/direct-pour-controls.ts" "$component_sources/before" "$component_sources/after" /home/hyper/bench/agents/codex-fabpcb-perf/scratch/repro38-direct-controls.json
taskset -c 12-19 nice -n 10 timeout 1800 bun "$component_assets/large.ts" "$component_sources/before" "$component_sources/after" /home/hyper/bench/agents/codex-fabpcb-perf/scratch/repro38-large.json /home/hyper/bench/boards/ladder/l2-cycle18.dsn /home/hyper/bench/boards/ladder/l3-cycle18.dsn /home/hyper/bench/boards/dense/dense6-bga324.dsn
taskset -c 12-19 nice -n 10 timeout 180 bun "$component_assets/trace.ts" /home/hyper/bench/agents/codex-fabpcb-perf/scratch/repro38-trace.json /home/hyper/bench/boards/ladder/l2-cycle18.dsn "$component_sources/before" "$component_sources/after"
python3 "$component_assets/compare-trace.py" /home/hyper/bench/agents/codex-fabpcb-perf/scratch/repro38-trace.json /home/hyper/bench/agents/codex-fabpcb-perf/scratch/repro38-trace-comparison.json
taskset -c 12-19 nice -n 10 timeout 1800 python3 "$component_assets/dense-native.py" /home/hyper/bench/wt/fp-perf/benchmarks/autorouter "$component_sources/before/entry" "$component_sources/after/entry" /home/hyper/bench/boards/dense/fab_pcb-case-dense6-bga324-j1 /home/hyper/bench/agents/codex-fabpcb-perf/scratch/repro38-dense-native
taskset -c 12-19 nice -n 10 timeout 4000 bun docs/pr-assets/agent-fab-router-perf-local-rescue/barrel-checks/slow.ts /home/hyper/bench/agents/codex-fabpcb-perf/scratch/repro38-slow.json
/usr/bin/python3 "$component_assets/extract-native.py" "$component_results/before" "$component_results/after" /home/hyper/bench/agents/codex-fabpcb-perf/scratch/repro38-connection.json
python3 "$component_assets/plot-native.py" /home/hyper/bench/agents/codex-fabpcb-perf/scratch/repro38-connection.json /home/hyper/bench/agents/codex-fabpcb-perf/scratch/repro38-connection.png
python3 "$component_assets/report.py" "$component_assets" /home/hyper/bench/agents/codex-fabpcb-perf/scratch/repro38-report.md
```

The slow driver enables recovery with unchanged original case expectations/budgets. Its historical control is the retained `barrel-checks/slow.json.gz`, not a fresh alternating pair. The larger DSN command uses one exploratory pair per input, while the prepared native Dense6 command uses three repeats/source. Both larger imports contain no pours; they are nonregression controls, not additional pour-recovery gains.

## Retained preliminary work

`initial-candidate.patch` reproduces the first snapshot from the prior pin and passes `git apply --check`. That candidate used alternate anchors for transaction acceptance; the final scheduler explicitly validates the original terminals. Its full native sweep, larger-input pairs and preliminary native three-repeat J4 subset are retained with distinct identities. `sources.json.gz` retains every frozen snapshot hash; `snapshot-identities.json` distinguishes the local commits. `probe.json.gz` contains nine initial real-layout anchor proposals, without fresh native scoring. `archived-residual-shortlist.json` is inspection of already-scored prior-cycle data and is not logged as a new benchmark.

All seven final regression tests are repeated three times on each source. Before: 2 pass/5 fail; final: 7 pass/0 fail. Final engine checks pass typecheck/layers and all 892 tests (399191 assertions). `initial-checks.txt` retains an earlier in-progress test run with two failures; only `checks.txt` is the final result. The nine earlier direct-pour synthetic controls are also replayed three times/source and remain open, with unchanged sessions and zero exact violations. `trace-comparison.json` verifies all 16 actual L2 targets/trials/proposals/charged counts and the final session match.

A queued final native launch was refused by the exclusive harness lock before routing or output creation. Its log and corrected wait condition are retained. No frozen input, scoring/checker rule, expectation, normal routing algorithm or shared runtime changed. No new CPU profile or full-suite speed improvement is claimed.

The tool sessions for the final larger-input driver and custom native Dense6 driver returned 143 after all six records were written. Each native case record has zero step exit failures/timeouts, and all six outputs pass the source/session/statistics/finding audits. These rows are completed case observations; a successful supervisor exit is not claimed. The initial larger driver exited zero. `supervisor-observations.json` retains this distinction.
