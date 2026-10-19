This diagnostic moves a shared track junction coherently, changing all coincident same-net, same-layer straight-track endpoints together. It targets U1.53, where the previous endpoint-preserving local interval search had no eligible proposals. Two nearest tracks, ten signed offsets based on stored zone gap, three repeats on hyper-ms-lin with native version 10.0.6 and the same composed input board. Pads, vias, arcs and interior contacts remain fixed, so native terminal validation remains mandatory.

**No repair was accepted. This is a negative diagnostic result, with no production engine or adapter changes.**

| Static diagnostic on the same composed board | Before | Junction search |
| --- | ---: | ---: |
| Selected native errors | 4 | 4 |
| Selected opens | 15 | 15 |
| Proposals checked per repeat | 0 eligible interior detours | 20 |
| Proposals removing U1.53 thermal per repeat | 0 | 3 |
| Accepted searches (three repeats) | 0/3 | 0/3 |

The three target-removing proposals introduce, respectively, a clearance violation; clearance plus mask bridge; and a short plus mask bridge. At scale −0.6, measured clearance is 0.0637 mm against the unchanged 0.1270 mm requirement. Complete blockers are retained in `analysis.json`. Strict native error-subset, terminal inventory/connectivity, open count and checked design/rule identity guards reject the proposals and restore the exact original bytes. This is evidence about this bounded candidate set, not proof that a safe repair cannot exist.

The selector requires at least two adjoining tracks and chooses the nearest eligible shared endpoint. Geometry controls exercise a three-way junction, reversed segment direction, foreign-net and opposite-layer exclusion, unchanged metadata and remote endpoints, input immutability, and invalid/collapsed proposals. A preliminary run selected an isolated endpoint at rank 1 and is excluded from these measurements. The corrected shared-only run is retained below. The initial control run failed because the new generator did not yet exist; it is experimental coverage, not a regression for a previously shipped engine defect. Independent replay regenerates candidate schedules and bytes and checks retained native designs, sidecars, complete reports, terminal partitions, selection and repeat stability.

![Measured coherent junction results](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/junction-results/comparison.png?raw=true)

Reproduce from the repository root:

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
scratch=$(mktemp -d /tmp/junction-search.XXXXXX)
gzip -dc "$asset/junction-results/source.kicad_pcb.gz" > "$scratch/source.kicad_pcb"
cp "$asset/junction-results/source.kicad_pro" "$scratch/source.kicad_pro"
cp "$asset/junction-results/source.kicad_dru" "$scratch/source.kicad_dru"
/usr/bin/python3 "$asset/junction-controls.py"
taskset -c 20-25 nice -n 10 timeout 2400 /usr/bin/python3 "$asset/junction-proposals.py" --source "$scratch/source.kicad_pcb" --pad 12cbe2ed-3861-4e0e-89f1-6c66f25e5228 --out "$scratch/native"
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 "$asset/verify-junction.py" "$scratch/native" --source "$scratch/source.kicad_pcb"
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 "$asset/verify-junction.py" "$asset/junction-results/native" --source "$scratch/source.kicad_pcb"
/usr/bin/python3 "$asset/summarize-junction.py" "$scratch/native"
bun run typecheck && bun run check:layers && bun run test
```

The engine source remains unchanged. The full frozen routing reference remains 39/78 passing runs, 13/26 cases valid in all three repeats, 120 opens and 27 new thermal errors. This cycle ran static native diagnostics rather than a routing benchmark; no routing score or speed improvement is claimed.
