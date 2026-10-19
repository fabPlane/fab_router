Repeated-outcome diagnostic correction

The offline candidate runner compared native error lists by order. Retained R20 reports contain identical error multisets in different orders for near-3-normal--1, causing the runner to abort after all 51 checks. The runner now compares complete serialized error records as multisets. Multiplicity, new findings, opens, terminal groups and eligibility remain strict.

Same machine, same seven synthetic controls, three repeats:

| Diagnostic | Before | After |
| --- | ---: | ---: |
| Correct outcomes | 18/21 | 21/21 |
| Reordered equal findings accepted | 0/3 | 3/3 |
| Duplicate/replacement findings rejected | 6/6 | 6/6 |

Replay reads 153 retained reports and rebuilds all terminal partitions from their boards: 51 R20, 51 U1.39, 51 C1. No fresh native refills or routing benchmarks. Existing results are not re-scored; no selection is newly accepted, and no target repair is claimed. Frozen baseline remains 39/78 passing runs, 120 opens, 27 new thermal errors.

From repository root:

```sh
/usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/repeat-controls.py
/usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/repeat-replay.py
timeout 900 taskset -c 20-25 nice -n 10 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Before predicate is exactly `all(trial[f] == base[f] for f in ('errors', 'opens', 'groups', 'eligible'))`; repeat-controls.py can load an earlier geometry-doglegs.py as its optional argument. before.json records the expected failing run. comparison.svg/png show measured control counts.
