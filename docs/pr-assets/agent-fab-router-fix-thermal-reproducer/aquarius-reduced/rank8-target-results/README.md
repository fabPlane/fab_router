Targeted geometry-derived native thermal diagnostic

U1.39 is selected explicitly from the native report. The diagnostic searches up to eight nearest foreign straight tracks, in distance order, with signed 0.2/0.4/0.6/0.8/1.0 stored-gap normal translations and endpoint links. It stops at the first accepted candidate. Stored gap is a search scale, not an effective rule resolver. Each repeat starts from the original full board.

Same board, sidecars, host hyper-ms-lin, cores 20–25, native version 10.0.6; three repeats each:

| U1.39 search | Errors before / selected | Opens before / selected | Accepted repeats | Proposals per repeat |
| --- | ---: | ---: | ---: | ---: |
| Nearest two tracks (previous evidence) | 6 / 6 | 15 / 15 | 0/3 | 20 |
| Up to eight tracks | 6 / 5 | 15 / 15 | 3/3 | 63 |

192 unique native checks (three baselines and 189 proposals). All repeats select rank 7, track `1f04f8a4-09df-4b67-892d-d548c2c4a777`, at scale −0.4: delta (0, +203200) nm. The removed error is U1.39 starved thermal; the other five errors remain. All 234 positive-net terminals, 74 groups and original connected terminal pairs survive. Every rejected transaction returns exact original bytes. Repairs for different targets are not composed.

Independent replay verifies all 192 native reports and partitions, ranked geometry, target coverage, hashes, proposal schedules and selected bytes. Replay of the compressed published evidence also passes. New target-selection metadata is checked against the native target inventory. Regression first: an invented selector was accepted; now it is rejected. Two valid controls pass; eight forged controls fail (missing target, duplicate repeat, truncated rejection, wrong rank, boolean track limit, unknown target, invalid target mode, boolean target).

Required checks: typecheck PASS; layer checks 65 files / zero violations; 859 tests / zero failures / 398454 assertions (243.72 s). No engine or adapter code changed. This is a static diagnostic, with no new routing benchmark or production repair. Frozen routing outcomes remain 39/78 passing runs, 13/26 valid cases, 120 opens, 27 thermal errors. An initial full-target eight-track run was stopped before completion and excluded; it remains private scratch evidence.

Reproduce from repository root:

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
results=$asset/rank8-target-results
mkdir -p /tmp/rank8-source
gzip -dc "$results/source.kicad_pcb.gz" > /tmp/rank8-source/source.kicad_pcb
cp "$results/source.kicad_pro" "$results/source.kicad_dru" /tmp/rank8-source/
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 3600 /usr/bin/python3 "$asset/generated-transaction.py" --all-targets --track-limit 8 --target-pad-uuid 40448888-06d6-474b-a038-09dfd03ed49c --source /tmp/rank8-source/source.kicad_pcb --out /tmp/rank8-native
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 "$asset/verify-generated-transaction.py" "$results" --source /tmp/rank8-source/source.kicad_pcb
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 "$asset/verify-generated-transaction.py" /tmp/rank8-native --source /tmp/rank8-source/source.kicad_pcb
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/generated-coverage-controls.py" --results "$asset/full-generated-results/compact-control" --source "$asset/repair-reduction-results/minimal.kicad_pcb" --out /tmp/rank8-controls
PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 "$asset/render-coverage.py" "$results" --source /tmp/rank8-source/source.kicad_pcb
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Targeted native proposal coverage](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/rank8-target-results/coverage.png?raw=true)
