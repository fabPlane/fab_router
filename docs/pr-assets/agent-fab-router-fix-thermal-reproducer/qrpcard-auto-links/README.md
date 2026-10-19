# Automatic offline repair on two complete routed boards

This extends the bounded metadata-driven thermal search to two untouched
complete outputs from the latest frozen engine run, rather than starting from
the previously repaired board. Inputs are the native-refilled qrpcard j2-small
and j4 outputs. Their SHA256 values match the benchmark checker records in
each `provenance.json`. Source and rule sidecars remain unchanged.

No production code changed. These are static native diagnostics, outside the
benchmark command. Selected boards are not substituted into benchmark results.
Live adapter refill/undo ownership remains unresolved.

Same host, cores 20–25, native 10.0.6, identical input and rules for each of
three independent searches per board:

| Static native measurement, each repeat | Input | Selected |
|---|---:|---:|
| j2-small errors | 2 | 0 |
| j2-small opens | 0 | 0 |
| j4 errors | 1 | 0 |
| j4 opens | 0 | 0 |
| Lost connected terminal pairs, either board | — | 0 |

The search discovers pad UUIDs from native thermal findings, tries additive
straight and bent links, and accepts only a strict subset of the original
errors with unchanged terminal inventory, no lost connected pairs and no
increased opens. Native saved-design and exact-rule guards remain enabled.
The replay also checks that every original design node survives unchanged and
only new same-net segments are appended. Fewer errors alone do not authorize
acceptance: several proposals remove both j2-small thermals but introduce a
track-width error and are rejected.

Each j2-small search checks 30 proposals and selects two straight links;
each j4 search checks 15 proposals and selects a one-segment straight link.
Including the six baselines gives 141 fresh native checks. Full schedules,
rejected proposals, native reports, connected partitions and selected boards
are retained. The three selected designs for each board are byte-identical.
All accepted segments are 0.254 mm wide. The j2-small accepted proposals are
14 and 29 (zero-based), attached to native pads U2.15 and U1.7; j4 accepts
proposal 14 at U2.15. No unsupported metadata or checker exception occurs.

The unchanged full-engine reference remains 39/78 passing attempts, 13/26
valid cases, 120 opens and 27 new thermal errors. Those historical figures
were measured in cycle 133 and are not rerun or revised here. There is no
router completion, speed or general safety claim from these static repairs.

Reproduce from the repository root; every output directory must be new:

```sh
A=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/qrpcard-auto-links
for case in j2-small j4; do
  mkdir -p "/tmp/thermal-$case/source" "/tmp/thermal-$case/retained"
  gzip -dc "$R/$case/source.kicad_pcb.gz" > "/tmp/thermal-$case/source/source.kicad_pcb"
  cp "$R/$case/source.kicad_pro" "$R/$case/source.kicad_dru" "/tmp/thermal-$case/source/"
  taskset -c 20-25 nice -n 10 timeout 2400 /usr/bin/python3 -B "$A/auto-links.py" \
    --source "/tmp/thermal-$case/source/source.kicad_pcb" \
    --out "/tmp/thermal-$case/fresh" --budget 128
  tar -xzf "$R/$case/native.tar.gz" -C "/tmp/thermal-$case/retained"
  taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 -B "$A/verify-auto-links.py" \
    --source "/tmp/thermal-$case/source/source.kicad_pcb" \
    --results "/tmp/thermal-$case/retained"
  python3 "$R/summarize.py" "/tmp/thermal-$case/retained" "/tmp/thermal-$case/comparison.json"
  cmp "$R/$case/comparison.json" "/tmp/thermal-$case/comparison.json"
done
taskset -c 20-25 nice -n 10 timeout 60 /usr/bin/python3 -B "$A/auto-link-controls.py"
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
python3 "$R/chart.py"
rsvg-convert -w 1600 "$R/comparison.svg" -o "$R/comparison.png"
```

`publish.py` packages raw evidence, verifies provenance and all archive file
hashes after extraction. `code-sha256.json` identifies the diagnostic code.
Replay verifies saved evidence; it neither reruns DRC nor authenticates reports.
The generator and replay share search code. Native subprocesses have a
120-second timeout, and the outer search has a 2400-second timeout.
Engine typecheck and layer checks pass; all 859 tests pass with zero failures.
The existing thirteen offline search controls also pass.

![Measured static repair counts](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/qrpcard-auto-links/comparison.png?raw=true)
