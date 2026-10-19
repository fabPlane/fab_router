# Stop proposal generation at the offline candidate budget

The search checked its budget inside a `for` body, after Python had already
requested the next proposal. After the last rejected candidate, it generated an
unchecked extra proposal; a generator exception at that point aborted the
command instead of returning the unchanged board with a budget stop. Limit the
iterator with `islice` before requesting another proposal. Unexpected failures
within the budget still propagate; native acceptance guards remain unchanged.

Failing regressions were added before the fix. Same host hyper-ms-lin, cores
20–25, identical twelve controls, three repeats per source:

| Diagnostic control measurement | Pinned 83630a1 | Fixed |
|---|---:|---:|
| Passing controls, each repeat | 10/12 | 12/12 |
| Proposals generated with budget 2 | 3 | 2 |
| Exception after final budgeted rejection | abort | unchanged bytes, budget stop |

These are diagnostic tests, not a router benchmark or production routing gain.
The frozen full-suite reference remains 39/78 passing runs, 13/26 valid cases,
120 opens and 27 new native thermal errors. No new full-suite run is claimed.
The earlier retained native schedule is replayed to check unchanged selections;
replay does not rerun DRC. A fresh native budget-1 run separately exercises
baseline and one rejected candidate in each of three repeats.

From repository root:

```sh
A=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
taskset -c 20-25 nice -n 10 timeout 180 /usr/bin/python3 -B "$A/budget-results/compare.py"
# Extract the source and native evidence as documented in auto-link-results/README.md.
taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 -B "$A/verify-auto-links.py" --source /tmp/auto-link-source/source.kicad_pcb --results /tmp/auto-link-retained
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 -B "$A/auto-links.py" --source /tmp/auto-link-source/source.kicad_pcb --out /tmp/auto-budget-one --budget 1
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Budget regression controls](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/budget-results/comparison.png?raw=true)

Validation: all 231 retained checks replay unchanged. Fresh budget-one run: six
native checks, two errors and fifteen opens unchanged in every repeat, all
selected bytes equal the source. Independent six-check replay passes. The new
native archive contains 46 files, each verified against its recorded SHA256.

Required engine checks pass: typecheck, layers (65 files, zero violations),
859 tests, zero failures, 398454 assertions (211.89 seconds). No production
engine, adapter, frozen input, rule, checker or runtime changes.
