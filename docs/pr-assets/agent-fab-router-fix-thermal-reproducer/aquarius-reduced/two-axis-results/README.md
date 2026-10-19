This bounded diagnostic combines track-normal and tangent displacement at the shared junction beside U1.53. It uses the exact composed input and native rule sidecars from the preceding normal-only experiment, on the same host (cores 20–25), with native version 10.0.6 and three repeats. Normal scales are −0.5, −0.6, −0.7; tangent scales are −0.4, −0.2, +0.2, +0.4. Both multiply the stored zone gap, which is a search scale rather than an effective clearance rule. Two nearest foreign tracks give 24 proposals per repeat. All coincident same-net/layer straight-track ends move together; remote endpoints, pads, vias, arcs and interior contacts remain fixed.

**No safe repair was found. Engine and adapter production code are unchanged.**

| Static native measurement, same input, three repeats | Prior normal-only search | Two-axis search |
| --- | ---: | ---: |
| Proposals per repeat | 20 | 24 |
| Proposals removing target thermal per repeat | 3 | 12 |
| Accepted searches | 0/3 | 0/3 |
| Selected native errors | 4 | 4 |
| Selected opens | 15 | 15 |

Every rank-one proposal removes the target but adds clearance errors; four also add a mask bridge. Every rank-two proposal retains the target and adds a short plus mask bridge. Thus each repeat has 12 clearance, 12 short, 16 mask-bridge and 12 retained-target blockers (overlapping categories). There are no lost terminal pairs, increased opens or checked-design/rule guard exceptions. Every rejection returns the exact original bytes. Native error totals alone cannot authorize a replacement error; some proposals still have four errors but fail the strict multiset-subset guard.

Independent replay covers all 75 native checks (three baselines and 72 proposals): complete candidate schedule/bytes, saved design identity, exact rules, full errors/opens, target findings, terminal inventories/partitions, selected bytes and repeat stability. Both raw and compressed evidence are replayed. `analysis.json` retains the exact introduced native findings for all target removals. This is a new experiment, not a regression fix for shipped engine code. Geometry controls cover the same junction invariants as the previous experiment; schedule controls cover 60 offsets over five normals and five invalid inputs.

![Measured two-axis junction results](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/two-axis-results/comparison.png?raw=true)

Reproduce from the repository root:

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
scratch=$(mktemp -d /tmp/two-axis-search.XXXXXX)
gzip -dc "$asset/two-axis-results/source.kicad_pcb.gz" > "$scratch/source.kicad_pcb"
cp "$asset/two-axis-results/source.kicad_pro" "$scratch/source.kicad_pro"
cp "$asset/two-axis-results/source.kicad_dru" "$scratch/source.kicad_dru"
/usr/bin/python3 "$asset/two-axis-controls.py"
/usr/bin/python3 "$asset/two-axis-geometry-controls.py"
taskset -c 20-25 nice -n 10 timeout 2400 /usr/bin/python3 "$asset/junction-two-axis.py" --source "$scratch/source.kicad_pcb" --pad 12cbe2ed-3861-4e0e-89f1-6c66f25e5228 --out "$scratch/native"
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 "$asset/verify-junction-two-axis.py" "$scratch/native" --source "$scratch/source.kicad_pcb"
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 "$asset/verify-junction-two-axis.py" "$asset/two-axis-results/native" --source "$scratch/source.kicad_pcb"
/usr/bin/python3 "$asset/summarize-two-axis.py" "$scratch/native"
/usr/bin/python3 "$asset/render-two-axis.py" "$asset/two-axis-results"
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Checks pass: typecheck, 65 layer-checked files with zero violations, 859 tests with zero failures. Frozen routing was not repeated for unchanged production code; its full reference remains 39/78 passing attempts, 13/26 cases valid three of three, 120 opens and 27 new thermal errors. These static native diagnostics do not establish a routing or speed improvement. Native transaction ownership/restoration across separately committed live refills is still unresolved.
