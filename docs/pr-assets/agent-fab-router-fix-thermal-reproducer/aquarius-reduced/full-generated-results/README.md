The native transaction diagnostic now measures every failing pad independently on the full reference output. Pads come from native thermal reports; each trial ranks the nearest foreign straight track and tries endpoint-linked normal translations at signed 0.2, 0.4, 0.6, 0.8 and 1.0 stored zone gaps. Each target starts from the original board. The stored gap is a search scale, not an effective native clearance rule. No fixed target UUID, obstacle UUID or displacement selects the result.

Same full board, exact sidecars, host hyper-ms-lin, cores 20–25, native version 10.0.6, three repeats per target:

| Target | Errors before / selected | Opens before / selected | Accepted repeats | Proposals per repeat |
| --- | ---: | ---: | ---: | ---: |
| C1.2 | 6 / 6 | 15 / 15 | 0/3 | 10 |
| U1.53 | 6 / 6 | 15 / 15 | 0/3 | 10 |
| U1.39 | 6 / 6 | 15 / 15 | 0/3 | 10 |
| U1.46 | 6 / 6 | 15 / 15 | 0/3 | 10 |
| U1.48 | 6 / 6 | 15 / 15 | 0/3 | 10 |
| R20.1 | 6 / 5 | 15 / 15 | 3/3 | 6 |

Only R20 accepts a candidate: the sixth proposal, +0.6 stored gap. The full-board error count falls from six to five, preserving all 234 positive-net pad terminals, 74 connected groups and every original connected terminal pair. All rejected transactions return exact original bytes. The other five pads exhaust the bounded candidate set; this nearest-track heuristic is insufficient for those targets. Accepted changes are not composed. No minimum displacement, general thermal repair or native rule-resolution claim follows from this measurement.

The run completes 171 unique native checks: three baselines and 168 proposals (165 rejected, three accepted). The replay performs 186 report/partition audits because each target also rechecks its baseline. The independent verifier replays proposal geometry, target enumeration, full error records, terminal partitions, input hashes, selected bytes and complete attempt schedules. Unchanged compact evidence is accepted; removing a target row, duplicating a repeat or truncating an unsuccessful search is rejected after rebinding artifact hashes. The compact default and all-target modes still accept the known repair in all three repeats; prior published compact evidence also passes the updated verifier.

Required engine checks PASS: typecheck; layer checks 65 files / zero violations; 859 tests / zero failures / 398454 assertions (255.31 s). No production engine, adapter, frozen fixture, checker, rules or shared runtime changed. This is a static native measurement, not a routing benchmark: no routing history row or pin bump. The historical full routing reference remains 39/78 passing runs, 13/26 valid cases, 120 opens and 27 thermal errors.

The source and native board outputs are losslessly gzip-compressed. `manifest.json` binds the compressed files; proposal hashes bind uncompressed candidate bytes. Reproduce from repository root without the shared baseline directory:

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
results=$asset/full-generated-results
mkdir -p /tmp/full-generated-source
gzip -dc "$results/source.kicad_pcb.gz" > /tmp/full-generated-source/source.kicad_pcb
cp "$results/source.kicad_pro" "$results/source.kicad_dru" /tmp/full-generated-source/
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 "$asset/generated-transaction.py" --all-targets --source /tmp/full-generated-source/source.kicad_pcb --out /tmp/full-generated-native
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/verify-generated-transaction.py" "$results" --source /tmp/full-generated-source/source.kicad_pcb
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/verify-generated-transaction.py" /tmp/full-generated-native --source /tmp/full-generated-source/source.kicad_pcb
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 500 /usr/bin/python3 "$asset/generated-coverage-controls.py" --results "$results/compact-control" --source "$asset/repair-reduction-results/minimal.kicad_pcb" --out /tmp/generated-coverage-controls
PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 "$asset/render-coverage.py" "$results" --source /tmp/full-generated-source/source.kicad_pcb
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Independent full-board proposal coverage](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/full-generated-results/coverage.png?raw=true)
