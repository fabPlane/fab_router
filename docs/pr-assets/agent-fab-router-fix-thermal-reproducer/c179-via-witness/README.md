# Isolated via design-identity negative control

The generated C1 witness cannot be reduced to the intact original board plus its
single via without changing the design checked by native refill. Native save
changes **exactly the via net**, from `Net-(C2-Pad1)` to `GNDD`; UUID, position,
size, drill, layers and every other protected design node remain identical.
The existing identity guard rejects this result in all three repeats. This is
an invalid reduction, not evidence that the proposed singleton is thermal-safe.

Same Aquarius source/rules, machine hyper-ms-lin, cores 20–25, native 10.0.6,
three fresh repeats per configuration (12 checks):

| Configuration | Native errors | Opens | Design identity |
| --- | ---: | ---: | --- |
| Original input | 0 | 110 | preserved 3/3 |
| Original plus generated via | excluded | excluded | via net changes 3/3; rejected |
| Complete route | 6 | 15 | preserved 3/3 |
| Complete route minus via | 5 | 16 | preserved 3/3 |

The complete-route deletion still loses two connected terminal pairs (previous
cycle); it is not a repair. No engine regression fix, scored router execution,
full-suite rerun or performance gain. Historical full suite remains 39/78 passes,
13/26 valid cases, 120 opens and 27 new thermal errors. Native saved singleton
reports are retained but excluded from valid candidate totals.

`native.tar.xz` includes exact input/source sidecars, proposals, native saved
boards and reports, terminal partitions and summary. `verify.py` independently
checks all saved design signatures, exact singleton net differences, native
error/open reports, accepted terminal partitions and rule sidecars. The initial
exploratory attempt stopped at the first identity rejection and is excluded.
Source provenance/license remain in adjacent c176-aquarius-search and
aquarius-reduced/LICENSE. All production source and tests remain unchanged.

Reproduce from repository root with fresh paths:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c179-via-witness
mkdir -p /tmp/via-witness
tar -xJf "$R/native.tar.xz" -C /tmp/via-witness
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/verify.py" --results /tmp/via-witness/measured
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/probe.py" --source /tmp/via-witness/measured/source/board.kicad_pcb --input /tmp/via-witness/measured/input/board.kicad_pcb --out /tmp/via-witness/fresh
taskset -c 20-25 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Via identity negative control](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c179-via-witness/comparison.png?raw=true)
