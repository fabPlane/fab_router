# Reach a connected via repair within the existing native search limit

The offline thermal generator previously evaluated 168 track candidates before its first connected via move. On the retained complete power-net control, that took 2144.2 seconds and exceeded the integration postprocessor's unchanged 600-second limit. Probe one representative of the nearest eligible via family after the first six track detours. All 200 candidate files remain byte-identical; every other candidate retains its relative order. No candidate, native check, rule, source/current connection guard or routing budget is removed or weakened.

The native regression fails first with the old order (index 168 instead of 6), then passes with the new order. The complete native gate still rejects unsafe proposals. The selected board hash is `0384bb4bba31003d2229c9ec473d9d1bbb9232243d29040d71c55ff8fc854978`, identical to cycle 218.

| Same host and retained cases/rules | Before | After |
| --- | --- | --- |
| Partial power-net control: checked proposals | 169 | 7 in each of 3 fresh repeats |
| Partial control: standalone search seconds | 2144.2 (1 retained run) | 153.1, 163.8, 186.7 (3 fresh runs) |
| Partial control: thermals / opens / lost source and current pairs | 0 / 95 / 0 and 0 after eventual repair | 0 / 95 / 0 and 0 in each repeat |
| Integration postprocessor, partial control | Prior search exceeds its 600-second cap; no prior adapter attempt claimed | Applied, exit 0, 183.5 seconds (1 fresh run) |
| Opt-in full corpus: passing runs | 45/78 | 45/78 |
| Opt-in full corpus: cases passing 3/3 | 15/26 | 15/26 |
| Opt-in full corpus: opens / new native errors | 120 / 18 | 120 / 18 |

Corpus before is the retained cycle 218 candidate run at `7e56b09f`; after is fresh this cycle. Both run all 26 frozen cases with seeds 1–3 on hyper-ms-lin, cores 20–25, same inputs/settings/order/runtime and native checker. All 78 outcomes, fidelity results, copper inventories, DSN and session files match. The six optional repairs retain the same accepted checkpoints; any additional probe is fully checked. Corpus median time increased from 8.331 to 9.459 seconds. Timing was measured under concurrent verification on a shared host: the deterministic reduction is 169 to 7 checks, with no general router speed claim.

This partial power-net control still has 95 opens and is not a completed routing task or a scored routing gain. Full Aquarius remains failing. Default routing is unchanged and was not rerun: its latest retained full result remains 39/78 passes, 13/26 valid, 120 opens and 27 new thermal errors. The optional corpus remains 45/78, 15/26 valid, 120 opens and 18 errors. Source-pad precision and full-board source-connectivity failures still need separate fixes.

Validation: `bun run typecheck`, `bun run check:layers`, and the full engine test suite pass (raw log attached). The new ordering assertion failed against the old generator before implementation. Independent replay recomputes terminal pair losses and all seven progress decisions from native reports, verifies board/report hashes and bundle snapshots, and proves all 200 generated boards unchanged. Native render geometry is reused from cycle 218 because the selected candidate is byte-identical; labels are updated, with no fresh-render claim.

Reproduce from the engine checkout:

```bash
taskset -c 20-25 nice -n 10 bun test test/native-aquarius-power-via.test.ts test/native-thermal-proposals.test.ts
taskset -c 20-25 nice -n 10 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Extract `evidence.tar.xz` into `/tmp/c219`. For standalone reproduction directly from this archive, use its independent `native` snapshots and a fresh work/output path:

```bash
taskset -c 20-25 nice -n 10 timeout 600 bun tools/native-thermal-search.ts /tmp/c219/native/input.kicad_pcb /tmp/c219/native/routed.kicad_pcb /tmp/c219/reproduced.json /tmp/c219/reproduced-search
python3 /tmp/c219/verify-search.py /tmp/c219
python3 /tmp/c219/compare.py /tmp/c219
cd /home/hyper/bench/wt/fp-bugs
python3 packages/router/bench/native-thermal-config.py --engine /home/hyper/bench/wt/fr-bugs --out /tmp/c219-configs
taskset -c 20-25 nice -n 10 timeout 7200 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --config-dir /tmp/c219-configs --out /tmp/c219-results
```

[Prior full before evidence](https://github.com/fabPlane/fab_router/tree/agent/fab-router-native-drc-gate/docs/pr-assets/agent-fab-router-native-drc-gate/c218-generated-via). The current evidence archive includes the complete fresh corpus output, native attempts and proposals, original source/rules, accepted bundles, timing records, regression failure, test log and replay scripts. Implementation commit: `0cfcfce2d601561a731a7102317f490aa8c5bf73`.

![Same native repair reached after seven checks](https://github.com/fabPlane/fab_router/blob/agent/fab-router-native-drc-gate/docs/pr-assets/agent-fab-router-native-drc-gate/c219-via-order/comparison.png?raw=true)
