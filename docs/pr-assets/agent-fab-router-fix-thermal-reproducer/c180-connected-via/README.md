# Connected two-item thermal witness

The complete Aquarius route has six thermal failures. Retaining only the six
generated copper items on the causal via net isolates **C1.2** starvation while
preserving the exact original design. Greedy native-validated deletion reduces
this to one via and its attached B.Cu track. All three final native refills report
one thermal failure (two spokes required, one found), 110 opens and unchanged
proposal identity. The previous isolated-via witness changed net during save;
this connected witness preserves the intended net.

The two retained items are via `d3812c01-5e0b-47fa-b2de-04d261bdf01e` at
(179.681, 50.4444) mm, 0.762 mm diameter / 0.381 mm drill, and B.Cu track
`1adf0f37-dc56-4f22-b0f7-e01166fcee29`, width 0.2032 mm, ending at
(181.737, 49.911) mm. Both retain their original generated net and UUID.
Every original board node, footprint, pad, zone and rule is preserved.

Same original input, source, sidecars, machine hyper-ms-lin, cores 20–25 and
native 10.0.6. Three repeats for each fixed configuration:

| Configuration | Generated copper items | Native errors | Opens |
| --- | ---: | ---: | ---: |
| Original input | 0 | 0 | 110 |
| Complete route before reduction | 466 | 6 | 15 |
| Isolated generated net | 6 | 1 | 108 |
| Net minus causal via | 5 | 0 | 109 |
| Connected witness after reduction | 2 | 1 | 110 |

The reduction is diagnostic, not a repair or a globally minimal proof. Deletion
can remove connectivity; unchanged open counts do not establish identical
terminal partitions. No production change, scored router execution, full-suite
rerun or gain is claimed. Historical suite remains 39/78 passes, 13/26 valid
cases, 120 opens and 27 new thermal errors, still unfixed.

The archive contains 21 measured native checks: twelve fixed-configuration
checks, six greedy attempts (one rejected for design drift), and three final
witness checks. Saved reports for changed designs are excluded from valid totals.
A second nine-check minimizer replay is retained separately as validation, not
counted again in the measured run. `verify.py` independently reconstructs every
proposal, checks native saved design signatures, reports, terminal partitions
and rule sidecars. No source or original input is overwritten.
Provenance/license: adjacent c176-aquarius-search and aquarius-reduced/LICENSE.

Reproduce from repository root using fresh paths:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c180-connected-via
mkdir -p /tmp/connected-via
tar -xJf "$R/native.tar.xz" -C /tmp/connected-via
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/verify.py" --root /tmp/connected-via
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/probe.py" --source /tmp/connected-via/connected/source/board.kicad_pcb --input /tmp/connected-via/connected/input/board.kicad_pcb --out /tmp/connected-via/fresh
taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 -B "$R/minimise.py" --results /tmp/connected-via/fresh --out /tmp/connected-via/fresh-minimal
taskset -c 20-25 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Connected thermal witness](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c180-connected-via/comparison.png?raw=true)
