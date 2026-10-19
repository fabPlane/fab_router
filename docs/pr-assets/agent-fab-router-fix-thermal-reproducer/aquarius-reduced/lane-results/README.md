This offline experiment replaces the two straight tracks beside U1.53 with a connected route expressed in the pad's local axes. It retains both remote endpoints, width, layer, net and every other design item. Four lanes sit 1, 1.5, 2 or 2.5 stored zone gaps beyond the remote endpoint's narrow-axis coordinate; each has two return depths (zero or one gap). The stored gap is a search scale, not an effective clearance rule. This tests a different topology from moving the existing shared junction. It is a bounded diagnostic, not an engine or adapter change.

Same composed board, exact rule sidecars, same host/cores 20–25, native version 10.0.6, three repeats:

| Static native measurement | Original input | Selected after lane search |
| --- | ---: | ---: |
| Native errors per repeat | 4 | 4 |
| Opens per repeat | 15 | 15 |
| Target thermal present | 3/3 | 3/3 |
| Accepted repairs | — | 0/3 |

All eight candidates per repeat retain the target. Each introduces shorts, track crossings and a mask bridge; seven introduce clearance findings. Candidate error totals are 11–18, opens remain 15, and no previously connected terminal pair is lost. The strict error-multiset subset guard rejects every candidate and returns the exact original bytes. No checked-design or rule-sidecar mismatch occurs. This rules out these eight routes only; it does not prove that all endpoint-preserving routes fail.

The 27 native checks comprise three baselines and 24 proposals. Independent raw and compressed replay verifies the full schedule, exact candidate bytes, unchanged design items and remote endpoints, connected nonzero segments, metadata, saved design identity, exact rule sidecars, native findings, terminal partitions, acceptance, selected bytes and repeat stability. Geometry controls were written first (initially failing because the new module did not exist); they cover determinism, metadata, input immutability, degenerate rejection and rotation round trips. These are controls for a new experiment, not evidence of a shipped regression fix.

![Measured lane results](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/lane-results/comparison.png?raw=true)

Reproduce from the repository root:

```sh
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
scratch=$(mktemp -d /tmp/thermal-lanes.XXXXXX)
gzip -dc "$asset/lane-results/source.kicad_pcb.gz" > "$scratch/source.kicad_pcb"
cp "$asset/lane-results/source.kicad_pro" "$scratch/source.kicad_pro"
cp "$asset/lane-results/source.kicad_dru" "$scratch/source.kicad_dru"
PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 "$asset/lane-controls.py"
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 "$asset/lane-proposals.py" --source "$scratch/source.kicad_pcb" --out "$scratch/native"
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/verify-lane.py" "$scratch/native" --source "$scratch/source.kicad_pcb"
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 "$asset/verify-lane.py" "$asset/lane-results/native" --source "$scratch/source.kicad_pcb"
PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 "$asset/summarize-lane.py" "$scratch/native" > "$scratch/analysis.json"
/usr/bin/python3 "$asset/render-lane.py" "$asset/lane-results"
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Frozen routing was not repeated for unchanged production code. Its full reference remains 39/78 passing attempts, 13/26 cases valid three of three, 120 opens and 27 new thermal errors. No routing or performance gain is claimed. Four composed-board thermal errors and live native transaction ownership remain unresolved. Native sidecar bytes, including trailing blank lines, are retained exactly.

Required checks pass: typecheck, 65 layer-checked files with zero violations, 859 tests with zero failures (398454 assertions; 248.73 seconds).
