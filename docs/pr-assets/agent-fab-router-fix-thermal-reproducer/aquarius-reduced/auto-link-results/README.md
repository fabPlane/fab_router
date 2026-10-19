# Metadata-driven offline thermal repair prototype

The previous experiment required a caller-supplied pad UUID. `auto-links.py`
intersects native error item UUIDs with the positive-net terminal inventory,
sorts the discovered pads, tries the existing straight then bent additive links,
and rediscovers targets after each accepted candidate. It stops on completion,
exhaustion or a positive candidate-check budget. Unsupported plane metadata is
recorded explicitly. Unexpected generator failures propagate. Every native
candidate retains the existing saved-design, exact-rule, strict error-subset,
terminal inventory, connected-pair and opens guards. Rejections preserve exact
current bytes. Outputs live in a new directory; source files remain unchanged.

This is a new diagnostic prototype with new control coverage, not a failing
production regression repaired. No engine or adapter integration changed.

Same static two-error board, native 10.0.6, host hyper-ms-lin, cores 20–25,
three repeats. Results compare input versus selected output; the earlier
hand-targeted experiment is a retained historical control, not a rerun.

| Measurement | Input, each repeat | Selected, each repeat |
|---|---:|---:|
| Native errors | 2 | 0 |
| Native opens | 15 | 15 |
| Lost connected terminal pairs | — | 0 |

Each repeat performs 76 proposals plus one baseline: 231 native checks total.
The first pad exhausts forty proposals; the second accepts bent proposal 35
(overall candidate 75), removing both thermal errors together. No metadata skip
or checker exception occurs. The automatically selected bytes match the earlier
hand-targeted result (SHA256
`e15b73db07a31b28d1a952c136d0b8d194cce3e590a33c06e7be6af7f74c6cfc`).
This search performs more native checks; no performance gain is claimed.
The frozen full-suite reference remains 39/78 passing runs, 13/26 valid cases,
120 opens and 27 new thermal errors. No router benchmark was run this cycle.
Static repair does not establish general safety or live undo ownership.

Reproduce from repository root (new output directories required):

```sh
A=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
R=$A/auto-link-results
mkdir -p /tmp/auto-link-source
gzip -dc "$R/source.kicad_pcb.gz" > /tmp/auto-link-source/source.kicad_pcb
cp "$R/source.kicad_pro" "$R/source.kicad_dru" /tmp/auto-link-source/
taskset -c 20-25 nice -n 10 timeout 60 /usr/bin/python3 -B "$A/auto-link-controls.py"
taskset -c 20-25 nice -n 10 timeout 2400 /usr/bin/python3 -B "$A/auto-links.py" --source /tmp/auto-link-source/source.kicad_pcb --out /tmp/auto-link-fresh --budget 128
mkdir /tmp/auto-link-retained
tar -xzf "$R/native.tar.gz" -C /tmp/auto-link-retained
taskset -c 20-25 nice -n 10 timeout 900 /usr/bin/python3 -B "$A/verify-auto-links.py" --source /tmp/auto-link-source/source.kicad_pcb --results /tmp/auto-link-retained
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 -B "$A/auto-replay-controls.py" --source /tmp/auto-link-source/source.kicad_pcb --results /tmp/auto-link-retained
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Ten control tests cover native target discovery, refresh, completion, budgets,
checker failure rollback, new errors, terminal inventory/pair preservation,
increased opens, unsupported metadata and unexpected generator failure.
The first preimplementation invocation fails because the new driver is absent.
Engine checks: typecheck, layers and 859 tests pass.
Retained replay checks saved artifacts; it does not rerun DRC or authenticate
external reports. Both generation and replay share proposal/search code.

![Static native results](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/auto-link-results/comparison.png?raw=true)

Limitations: search scales come from stored zone gaps, not an inferred effective
thermal rule. The unique overlapping plane layer requirement remains strict.
Missing pad-backed findings cannot become targets; ambiguous layers are recorded
as unsupported. The candidate budget excludes the initial baseline and each
native subprocess retains its 120-second timeout. The documented outer timeout
bounds the complete command. The example still has fifteen opens and cannot be
called a successful route.

The archive stores identical files as hard links to earlier archive entries. All
1165 extracted file hashes match raw checked evidence; `archive-sha256.json`
retains the complete list. Two altered-evidence controls reject an incorrect
baseline open count and a changed native rule sidecar at the intended checks.
