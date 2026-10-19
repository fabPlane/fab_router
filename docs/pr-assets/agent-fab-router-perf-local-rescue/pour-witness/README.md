# Multiple filled-copper attachment witnesses

This is a disposable source experiment. Production pour recovery remains unsupported,
`localRecovery` remains default off, and the consumer pin is unchanged. No speed gain
or general native completion gain is claimed. The measured engine is `f1680db`;
checkout `e877602` adds earlier evidence only.

The previous vertex-average and first-vertex selectors each failed a different
fixture. Here the actual other pad/barrel anchor guides a set of witnesses: project
onto outline/hole edges and include their vertices, round to integer layout units,
then retain only points that touch the actual filled region at radius zero. Sort
by distance, x and y and take at most 32 witnesses after inspecting at most 256
boundary edges. Target-net identity and the pour's actual sheet remain mandatory;
pour-to-pour targets remain unsupported. The visibility graph can terminate at any
candidate within the original local region. Exact legalisation, full-width copper,
retained copper, target closure, terminal partitions and transaction rollback still
decide acceptance. Widths, clearances, vias, lattice and search limits are unchanged.

These limits bound witness counts, **not total geometry work or latency**. Filled-region
construction and containment can still inspect all hole/outline geometry, and resolver
work occurs before scheduler expansion charging. Repeated endpoint resolution is also
not cached. That integration gap, and the need for an actual native pour-attachment
gain, prevent adopting this prototype as production support.

`prepare-v1.py` also filters and charges ordinary point anchors. This changes original
zero-margin work and causes an L2 regression. `prepare.py` (v2) only applies those new
operations to pour witnesses. It retains the original ordinary point-anchor path.
Both generators change exactly four disposable route modules, never this checkout's
production source. `sources-*.json.gz` bind all source/spec bytes. Local experimental
commits are not pushed or used as consumer pins.

`measure.ts` runs nine one-open fixtures, three repeats per source: current,
nearest-only and multiple-witness. It checks exact geometry, wrong-net rejection,
filled contact for every witness, preserved pads/pours/keepouts, deterministic sessions
and byte-exact session rollback on every failed closure. The fully blocked and
disjoint-sheet controls stay open. Reversed endpoint identity and a foreign-net pad
are included. The nearest-only control fails when its contact is inside the track
keepout; multiple witnesses close it via a different contact. This is recovery-only
synthetic evidence, not a normal-stage or native board score.

`trace.ts` records real charged work on L2 with the same two-pass/600-second settings.
V1 skips original zero-margin work, lets net 7 close within its 100000-unit cap and
changes later routability. Total opens worsen 21 to 22. V2 reproduces all 16 original
recovery targets, charged work, trial outcomes, proposals and session bytes exactly.
`compare-trace.py` verifies this restoration. The initial negative result is retained.

The image renders measured retained copper from the v2 fixture runs. Green is filled
pour copper, red is a new retained route, gray is a track-only keepout, and the purple
cross is the nearest witness (not necessarily the selected contact). Layout units
are 10000/mm. Track strokes are illustrative, not a clearance proof.

Full frozen suite controls use the public setting enabled in every source, three
repeats per case on the same host and cores 12–19. Native comparisons preserve exact
inputs/settings/runtime/checker, structured error and warning-geometry multisets,
fidelity, actual sessions and all failed attempts. Known thermal errors are retained.
Larger supplied DSNs use one exploratory pair per input/source, not a repeated timing
study or native score. Prepared Dense6 is checked natively three times/source and is
a separate export. Heavy runs overlap on the assigned cores; timing is descriptive.
Fresh slow acceptance and a CPU profile are not claimed for this unadopted prototype.

## Reproduce

Run from this checkout with installed dependencies and the existing private native
runtime. Use new output directories; generators and drivers reject overwrites.
The native sweeps must run sequentially because the harness owns a shared run lock.

```bash
WITNESS_ROOT="$PWD"
WITNESS_ASSETS="$WITNESS_ROOT/docs/pr-assets/agent-fab-router-perf-local-rescue/pour-witness"
WITNESS_OUT="$HOME/bench/agents/codex-fabpcb-perf/scratch/witness-repro"
mkdir "$WITNESS_OUT"
python3 "$WITNESS_ASSETS/prepare-v1.py" "$WITNESS_ROOT" "$WITNESS_OUT/v1"
python3 "$WITNESS_ASSETS/prepare-v1.py" "$WITNESS_ROOT" "$WITNESS_OUT/nearest-v1" 1
python3 "$WITNESS_ASSETS/prepare.py" "$WITNESS_ROOT" "$WITNESS_OUT/v2"
python3 "$WITNESS_ASSETS/prepare.py" "$WITNESS_ROOT" "$WITNESS_OUT/nearest-v2" 1
taskset -c 12-19 nice -n 10 timeout 120 bun "$WITNESS_ASSETS/measure.ts" "$WITNESS_ROOT" "$WITNESS_OUT/v1" "$WITNESS_OUT/synthetic-v1.json" "$WITNESS_OUT/nearest-v1"
taskset -c 12-19 nice -n 10 timeout 120 bun "$WITNESS_ASSETS/measure.ts" "$WITNESS_ROOT" "$WITNESS_OUT/v2" "$WITNESS_OUT/synthetic-v2.json" "$WITNESS_OUT/nearest-v2"
taskset -c 12-19 nice -n 10 timeout 5000 python3 "$WITNESS_ASSETS/native.py" "$WITNESS_ROOT" "$WITNESS_OUT/v1" "$HOME/bench/wt/fp-perf" "$WITNESS_OUT/native-v1"
taskset -c 12-19 nice -n 10 timeout 2600 python3 "$WITNESS_ASSETS/native-one.py" "$WITNESS_OUT/v2" "$HOME/bench/wt/fp-perf" "$WITNESS_OUT/native-v2"
python3 "$WITNESS_ASSETS/compare-native.py" "$WITNESS_OUT/native-v1/before" "$WITNESS_OUT/native-v1/vertex" "$WITNESS_OUT/native-v1-comparison.json"
python3 "$WITNESS_ASSETS/compare-native.py" "$WITNESS_OUT/native-v1/before" "$WITNESS_OUT/native-v2" "$WITNESS_OUT/native-v2-comparison.json"
taskset -c 12-19 nice -n 10 timeout 4000 bun "$WITNESS_ASSETS/large.ts" "$WITNESS_ROOT" "$WITNESS_OUT/v1" "$WITNESS_OUT/large-v1.json" "$HOME/bench/boards/ladder/l2-cycle18.dsn" "$HOME/bench/boards/ladder/l3-cycle18.dsn" "$HOME/bench/boards/dense/dense6-bga324.dsn"
taskset -c 12-19 nice -n 10 timeout 4000 bun "$WITNESS_ASSETS/large.ts" "$WITNESS_ROOT" "$WITNESS_OUT/v2" "$WITNESS_OUT/large-v2.json" "$HOME/bench/boards/ladder/l2-cycle18.dsn" "$HOME/bench/boards/ladder/l3-cycle18.dsn" "$HOME/bench/boards/dense/dense6-bga324.dsn"
taskset -c 12-19 nice -n 10 timeout 400 bun "$WITNESS_ASSETS/trace.ts" "$WITNESS_OUT/trace.json" "$HOME/bench/boards/ladder/l2-cycle18.dsn" "$WITNESS_ROOT" "$WITNESS_OUT/v1" "$WITNESS_OUT/v2"
python3 "$WITNESS_ASSETS/compare-trace.py" "$WITNESS_OUT/trace.json" "$WITNESS_OUT/trace-comparison.json"
taskset -c 12-19 nice -n 10 timeout 4000 python3 "$WITNESS_ASSETS/dense-native.py" "$HOME/bench/wt/fp-perf/benchmarks/autorouter" "$WITNESS_ROOT" "$WITNESS_OUT/v2" "$HOME/bench/boards/dense/fab_pcb-case-dense6-bga324-j1" "$WITNESS_OUT/dense-native"
python3 "$WITNESS_ASSETS/compare-dense.py" "$WITNESS_OUT/dense-native" "$WITNESS_ROOT" "$WITNESS_OUT/v2" "$WITNESS_OUT/dense-comparison.json"
taskset -c 12-19 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
"$HOME/bench/agents/codex-fabpcb-perf/scratch/plot-venv/bin/python" "$WITNESS_ASSETS/plot.py" "$WITNESS_OUT/synthetic-v2.json" "$WITNESS_OUT/attachment.png"
```

`native.py` retains the historical directory label `vertex` for its v1 result; it
loads the supplied multiple-witness source, not the previous first-vertex probe.
The initial completed seven-fixture baseline/witness batch is retained separately;
the intermediate nine-fixture batches include fresh nearest-only controls. The final
nine-fixture batches use a physical second active sheet for the disjoint-sheet
control; earlier absent-layer diagnostics remain separate and are not legal-board
evidence. All other overlapping fixture sessions match. There are 366 completed
synthetic evaluations, including these diagnostic batches. An earlier
invalid fully-blocked fixture covered its pad and was rejected before measurement
completed; the corrected fixture keeps the pad clear. Reporting/copy setup failures
are retained in scratch and are not successful routing runs. Full raw native boards
and reports remain in cycle37 scratch; compact evidence and source manifests are here.
