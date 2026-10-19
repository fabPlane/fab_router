# Completed baseline thermal target inventory

This audit reads the completed fresh baseline and the original frozen boards.
It does not route, refill, save a board, change a checker, or rerun a benchmark.
The source results SHA-256 and board/project/rule hashes are in `summary.json`.
Two independent audit invocations produced byte-identical summaries.

| Same host, 26 cases, 3 repeats per case | Historical baseline | Completed fresh baseline |
| --- | ---: | ---: |
| Passed runs | 39/78 | 39/78 |
| Cases passing all repeats | 13/26 | 13/26 |
| Native opens, total | 120 | 120 |
| New native errors, total | 27 | 27 |
| Runs with new native errors | 9 | 9 |

This is baseline triage, not a before/after fix measurement. Existing baseline
results are not appended again to the shared history log.

The fresh errors have nine distinct case/pad/zone identities. Full native
finding contents and multiplicities match across seeds 1, 2 and 3 for each
case. All findings report minimum two spokes and actual one:

| Case | Native zone layer | Pad targets | Input pad orientations |
| --- | --- | --- | --- |
| Aquarius J4 | B.Cu | C1.2, R20.1, U1.39/46/48/53 | 315 degrees except R20 at 0 |
| QR card J2 small | F.Cu | U1.7, U2.15 | 90 degrees |
| QR card J4 | F.Cu | U2.15 | 90 degrees |

All nine original pads have absent local gap/width overrides. All corresponding
zones store 508 micrometre gap and bridge width. These getters do **not** resolve
custom rules. Pad orientation and the stored spoke angle (90 degrees here) are
separate observations; this audit does not compute world-space spoke directions.
The miniature's manually selected axis-aligned front-layer guard therefore does
not establish coverage of the rotated back-layer targets.
All six Aquarius targets have rounded rectangle pads; their corner radii and
sizes are recorded too. The three QR card targets have rectangular pads.

UUID is used to match the native finding to the original pad and zone. Original
pad positions differ from report positions by up to 47 nm per coordinate on
five rotated targets. Both positions and deltas are retained; no cause, native
fidelity failure, or connection to thermal starvation is inferred from this
small discrepancy. An initial exact-position assertion exposed it and was
replaced with explicit recording rather than concealing it with a tolerance.

Reproduce from the engine repository root with native version 10.0.6 and an
existing completed baseline (use a new output directory):

```bash
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 120 /usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/corpus-targets/audit.py --results "$HOME/bench/repos/fab_pcb/benchmarks/autorouter/results/baseline-20261018/results.json" --cases "$HOME/bench/repos/fab_pcb/benchmarks/autorouter/cases" --out /tmp/native-thermal-targets
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Next useful minimisation target: Aquarius U1.39, a 315-degree pad with a B.Cu
zone finding. Preserve both original sidecars, pad/zone identity and native
refill behaviour. General spoke selection, effective rule resolution and a
production native transaction remain unresolved; the 27 errors are not fixed.
