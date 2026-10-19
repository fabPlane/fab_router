The diagnostic searches the two nearest foreign straight tracks in distance order, trying signed 0.2/0.4/0.6/0.8/1.0 stored-gap normal translations with endpoint links. Targets come from native thermal reports. Every pad starts from the original full board. This extends the previous nearest-one search; it does not compose repairs or change production routing.

Same source, sidecars, host hyper-ms-lin, cores 20–25, native version 10.0.6, three repeats:

| Target | Native errors before / selected | Opens before / selected | Accepted repeats | Proposals per repeat |
| --- | ---: | ---: | ---: | ---: |
| C1.2 | 6 / 6 | 15 / 15 | 0/3 | 20 |
| U1.53 | 6 / 6 | 15 / 15 | 0/3 | 20 |
| U1.39 | 6 / 6 | 15 / 15 | 0/3 | 20 |
| U1.46 | 6 / 6 | 15 / 15 | 0/3 | 20 |
| U1.48 | 6 / 6 | 15 / 15 | 0/3 | 20 |
| R20.1 | 6 / 5 | 15 / 15 | 3/3 | 6 |

321 unique native checks completed. The second-nearest track provides no additional accepted repair. R20 retains its first-track +0.6-gap repair; five targets remain unresolved. All 234 positive-net terminals, 74 groups and original connected terminal pairs survive selected outputs. Every rejected transaction returns exact original bytes. This is a negative coverage result, not proof that broader candidates cannot help.

Independent replay PASS: 336 native report/partition audits. Diagnostic source commit: `18df482`. The verifier independently replays geometry, ranked proposal schedule, full error multisets, terminal partitions, target coverage, selected bytes and artifact hashes. A regression exposed boolean search limits being accepted as integers; explicit integer/range validation now rejects them. Unchanged evidence passes; missing targets, duplicate repeats, truncated searches, false track ranks and boolean limits fail even after manifest rebinding. Both previous full-board evidence and gzip-compressed compact evidence pass replay.

Required checks: typecheck PASS; layer checks 65 files / zero violations; 859 tests / zero failures / 398454 assertions (232.00 s). No engine, adapter, frozen suite, scoring or shared runtime changed. No router benchmark was run, so no routing history row or pin bump applies. Historical routing outcomes remain unresolved: 39/78 passing runs, 13/26 valid cases, 120 opens, 27 thermal errors.

Boards, native JSON reports and summary are losslessly gzip-compressed. Manifest hashes bind published bytes; proposal hashes bind original uncompressed candidates. Reproduce from repository root:

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
results=$asset/rank2-generated-results
mkdir -p /tmp/rank2-source
gzip -dc "$results/source.kicad_pcb.gz" > /tmp/rank2-source/source.kicad_pcb
cp "$results/source.kicad_pro" "$results/source.kicad_dru" /tmp/rank2-source/
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 "$asset/generated-transaction.py" --all-targets --track-limit 2 --source /tmp/rank2-source/source.kicad_pcb --out /tmp/rank2-native
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/verify-generated-transaction.py" "$results" --source /tmp/rank2-source/source.kicad_pcb
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/verify-generated-transaction.py" /tmp/rank2-native --source /tmp/rank2-source/source.kicad_pcb
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/generated-coverage-controls.py" --results "$asset/full-generated-results/compact-control" --source "$asset/repair-reduction-results/minimal.kicad_pcb" --out /tmp/rank2-controls
PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 "$asset/render-coverage.py" "$results" --source /tmp/rank2-source/source.kicad_pcb
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Two-track native proposal coverage](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/rank2-generated-results/coverage.png?raw=true)
