An opt-in offline native gate protects source copper, rules, ownership and source/current terminal pairs, and publishes only exact accepted snapshots. This update fixes a missing geometry family in bounded thermal search: it could reshape tracks but could not move a generated via together with its attached track ends. The connected repair previously had to be constructed manually.

The generator now appends up to eight 0.3 mm axial/diagonal moves for each of four marker-near generated vias, within the existing 304-proposal budget. It preserves the prior proposal prefix, excludes authored/reidentified copper, and refuses protected incident tracks, foreign-net contacts, stacked vias and arc contacts. The native acceptance conditions are unchanged.

On the retained complete-power control, all three fresh generator/native comparisons produce the same accepted candidate: one thermal error becomes zero, with 95 opens and zero lost source/current terminal pairs. The new fixture regression fails on the old generator because it cannot produce this candidate, then passes with the new generator. An actual standalone automatic search checks all 168 prior candidates, rejects them, accepts via candidate 168, and publishes the checked bundle. All 200 generated proposals are retained; the remaining 31 are untested after success. This is a partial power-net control, not complete routing. The standalone search's snapshot-to-result interval was 2144.2 seconds under concurrent verification, exceeding the integration adapter's unchanged 600-second cap. This is not a within-cap adapter recovery.

| Same host, cases, rules and repeats | Before | After |
| --- | --- | --- |
| Power control, 3 fresh generator runs: proposals | 168 | 200 |
| Existing proposal prefix | 168 files | All 168 byte-identical |
| Power control, 3 fresh native decisions: thermals / opens | 1 / 95 | 0 / 95 |
| Power control: lost source / current pairs | 0 / 0 | 0 / 0 |
| Power control: strict acceptance | 0/3 | 3/3 |
| Full opt-in corpus, 26 cases × 3 seeds: passing runs | 45/78 | 45/78 |
| Full opt-in corpus: cases passing 3/3 | 15/26 | 15/26 |
| Full opt-in corpus: total opens / new native errors | 120 / 18 | 120 / 18 |

Both 78-run corpus runs are fresh on hyper-ms-lin, cores 20–25, with the frozen native 10.0.6 checker and identical inputs/settings/seeds/order/runtime. Every outcome, fidelity check, physical copper inventory, DSN and session matches. The six existing optional repairs and their accepted checkpoint sequences remain unchanged. Medians are 9.855 → 8.331 seconds under concurrent verification; no speed claim. Aquarius remains failing with six thermal errors and 15 opens per seed. The latest retained default run remains 39/78 passing, 13/26 valid, 120 opens and 27 new thermals; default routing was not rerun this cycle and its source is unchanged.

Validation: typecheck, layer check and all 933 engine tests pass. Three generated-candidate comparisons pass; independent replay recomputes source/current terminal-pair losses and strict progress, associates every native report with its submitted board hash, and verifies exact four-item edits, unchanged source/rules/caller snapshots, byte-identical prior proposals and deterministic candidate hashes. The complete automatic search publishes only after final native validation. An initial triage replay incorrectly assumed every search wrote a result file; it is retained, and the corrected replay explicitly records preflight failures. Two attempted launches of the after benchmark were refused by the harness's exclusive lock before any attempt or output directory; their logs are retained. Final benchmark runs complete with explicit exit zero. No tests, frozen inputs, checker rules, acceptance conditions or default routing changes are included.

The complete-board transfer from the earlier diagnostic still loses U1.53 connectivity and adds clearance errors; it remains rejected. This change does not repair the full Aquarius board or weaken that rejection.

Implementation: `7e56b09f221dff426670547c6e0390891be4c1d8`. Integration remains opt-in in https://github.com/fabPlane/fab_pcb/pull/50.

Reproduce the regressions from the engine checkout:

```bash
taskset -c 20-25 nice -n 10 bun test test/native-thermal-proposals.test.ts test/native-aquarius-power-via.test.ts
taskset -c 20-25 nice -n 10 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Reproduce the fresh candidate corpus run from the integration checkout (use fresh output paths):

```bash
cd /home/hyper/bench/wt/fp-bugs
python3 packages/router/bench/native-thermal-config.py --engine /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c218/before-control --out /tmp/c218-baseline-configs
taskset -c 20-25 nice -n 10 timeout 7200 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c218/before-control --config-dir /tmp/c218-baseline-configs --out /tmp/c218-baseline-results
python3 packages/router/bench/native-thermal-config.py --engine /home/hyper/bench/wt/fr-bugs --out /tmp/c218-candidate-configs
taskset -c 20-25 nice -n 10 timeout 7200 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --config-dir /tmp/c218-candidate-configs --out /tmp/c218-candidate-results
```

The before engine is `a6da80a1` (its executable code matches the prior integration pin). For exact before commands and raw replay, see the [cycle 218 evidence](https://github.com/fabPlane/fab_router/tree/agent/fab-router-native-drc-gate/docs/pr-assets/agent-fab-router-native-drc-gate/c218-generated-via). It includes all source boards/rules/licenses, old/new proposals, native reports, accepted bundle, both complete corpus runs, hashes, commands and initial failure logs.

![Generated via move restores the ground thermal on the partial power-net control](https://github.com/fabPlane/fab_router/blob/agent/fab-router-native-drc-gate/docs/pr-assets/agent-fab-router-native-drc-gate/c218-generated-via/comparison.png?raw=true)

Portable raw replay (extract both evidence archives into the same fresh directory):

```bash
mkdir -p /tmp/c218-replay
tar -xJf native-evidence.tar.xz -C /tmp/c218-replay
tar -xJf benchmark-evidence.tar.xz -C /tmp/c218-replay
python3 /tmp/c218-replay/verify-native.py /tmp/c218-replay
python3 /tmp/c218-replay/verify-search.py /tmp/c218-replay
python3 /tmp/c218-replay/compare.py /tmp/c218-replay
```

Fresh automatic native search, from the engine checkout, using the extracted control:

```bash
taskset -c 20-25 nice -n 10 timeout 3600 bun tools/native-thermal-search.ts /tmp/c218-replay/native/input.kicad_pcb /tmp/c218-replay/native/routed.kicad_pcb /tmp/c218-accepted.json /tmp/c218-new-search
```

Exact full corpus commands used, from the integration checkout:

```bash
python3 packages/router/bench/native-thermal-config.py --engine /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c218/before-control --out /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c218/optional-before-configs
taskset -c 20-25 nice -n 10 timeout 7200 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c218/before-control --config-dir /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c218/optional-before-configs --out /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c218/optional-before
python3 packages/router/bench/native-thermal-config.py --engine /home/hyper/bench/wt/fr-bugs --out /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c218/optional-after-configs
taskset -c 20-25 nice -n 10 timeout 7200 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --config-dir /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c218/optional-after-configs --out /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c218/optional-after
```

The before control was created with `git worktree add --detach /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c218/before-control a6da80a1` followed by `git -C /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c218/before-control switch -c agent/fab-router-fix-via-control-c218`. Recreate it in a fresh path and use a fresh topic branch when repeating. It is the existing source at a6da80a1; its executable src/tools match the prior integration pin a8f77624 exactly. Run corpus commands sequentially due to the harness lock. Use fresh output/config paths when repeating. Native measurement reuses the same retained board three times; those are not three routing seeds. The image reuses cycle 217 native SVGs for the exact same geometry; verify-native.py proves exact numeric AST agreement between the generated candidate and the render reference. Labels were updated for generated proposals. This is not a new physical board render. All initial test failures and refused launches are retained.
