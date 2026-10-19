# Geometry-derived candidate search: rejected nearest-three bound

This offline diagnostic ranks foreign-net straight tracks on the failing pad's copper layers by centre-to-segment distance. It generates endpoint-linked translations in both directions, either perpendicular to each track or along the closest pad-local axis. The translation step is one fifth of the minimum stored same-net zone thermal gap (508000 / 5 = 101600 nm). Stored gap is only a search scale; it does not resolve effective native constraints. No segment UUID, reduced-board segment index, or fixed 315-degree angle supplies candidate geometry.

The bound of three misses the earlier successful witness: an independent comparison of original and accepted native tracks identifies the moved track, then finds it at rank eight (1.438914 mm from the pad centre). This explains a candidate-coverage limitation; it does not establish that increasing the bound alone would repair the board.

Same full-board input and sidecars, same host and native checker version 10.0.6, three fresh native refills per variant:

| Direction source | Before errors / opens | Candidate errors / opens | Selected errors / opens |
| --- | --- | --- | --- |
| Track normal | 6 / 15 | 6, 6, 7, 6, 7, 6 / 15 throughout | 6 / 15 |
| Pad-local axis | 6 / 15 | 6, 6, 6, 7, 7, 6 / 15 throughout | 6 / 15 |

The retained `near-N-normal-SIGN` labels identify rank and signed direction in either strategy; `directions` in each summary specifies the actual direction source. Both searches keep the baseline in all three repeats. Neither removes the target thermal error. The selector requires a strict subset of native error records, no opens increase, and preservation of previously connected native pad terminal pairs. Independent verification checks every retained artifact hash, report, translation vector, repeated decision and terminal partition. Synthetic controls cover layer/net filtering, degenerate tracks, ranking, endpoint reversal, rotation and candidate count limits. This is a static candidate experiment, not routing; frozen-suite results and the 27 baseline thermal errors remain unresolved.

Reproduce from the repository root (fresh output paths required):

```bash
ASSETS=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
SOURCE=$HOME/bench/repos/fab_pcb/benchmarks/autorouter/results/baseline-20261018/runs/run-20261018T135444.397318Z-062/fab-router/final.kicad_pcb
for MODE in normal pad-axis; do
  taskset -c 20-25 nice -n 10 timeout 1800 /usr/bin/python3 "$ASSETS/geometry-doglegs.py" --source "$SOURCE" --pad 40448888-06d6-474b-a038-09dfd03ed49c --directions "$MODE" --out "/tmp/thermal-geometry-$MODE"
  python3 "$ASSETS/verify-geometry.py" "/tmp/thermal-geometry-$MODE"
  python3 "$ASSETS/geometry-chart.py" "/tmp/thermal-geometry-$MODE"
done
/usr/bin/python3 "$ASSETS/geometry-controls.py"
/usr/bin/python3 "$ASSETS/rank-audit.py" /tmp/thermal-rank-audit.json
bun run typecheck && bun run check:layers && bun run test
```

The rank audit uses the previously retained successful selection as a coverage witness, not to construct candidates. Source files and sidecars remain unchanged; native diagnostics are retained. No production engine or adapter change is proposed.

## Eight-track coverage experiment

The same geometry-derived pad-axis search now accepts an explicit `--limit` from one through eight (default remains three). Eight is a diagnostic coverage bound motivated by the independent rank audit, not a general locality or safety guarantee. Candidate construction still uses native pad axes and stored zone gap / 5, without selecting track UUIDs or indices in advance.

On the same full board, sidecars, host and native checker, three repeats per variant:

| Static search | Before errors / opens | Selected errors / opens | Target thermal removed |
| --- | --- | --- | --- |
| Nearest three, retained prior measurement | 6 / 15 | 6 / 15 | 0/3 |
| Nearest eight, 51 fresh native checks | 6 / 15 | 5 / 15 | 3/3 |

The selected candidate is `near-8-normal-1` (the label retains the historical name; its actual direction source is pad-axis). All 234 positive-net pad terminals and 74 connected groups remain identical. Selection requires a strict native error multiset subset, no opens increase and preservation of all baseline connected terminal pairs. Five thermal errors and 15 opens remain. This demonstrates candidate coverage on one static routed board; it is not a production repair or a frozen routing-suite gain.

```bash
ASSETS=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
SOURCE=$HOME/bench/repos/fab_pcb/benchmarks/autorouter/results/baseline-20261018/runs/run-20261018T135444.397318Z-062/fab-router/final.kicad_pcb
taskset -c 20-25 nice -n 10 timeout 2400 /usr/bin/python3 "$ASSETS/geometry-doglegs.py" --source "$SOURCE" --pad 40448888-06d6-474b-a038-09dfd03ed49c --directions pad-axis --limit 8 --out /tmp/thermal-eight
python3 "$ASSETS/verify-geometry.py" /tmp/thermal-eight
python3 "$ASSETS/geometry-chart.py" /tmp/thermal-eight
/usr/bin/python3 "$ASSETS/geometry-controls.py"
bun run typecheck && bun run check:layers && bun run test
```

All 51 native reports, refilled boards, sidecars, logs, complete terminal partitions and artifact hashes are retained in `wide-results/`. Native rule-file trailing blank lines are retained as input provenance.

## R20 target coverage and target-claim regression

The same eight-track pad-axis search was applied to the previously untested R20.1 target on the same full board and sidecars, host and native checker. All 51 refills finished, but the runner rejected its exact repeat-consistency assertion: `near-3-normal--1` returns the same three additional clearance records in different list orders. The original failure and raw reports remain in `r20-results/native.log`. No selection was accepted and the runner's repeat assertion remains unchanged.

| R20.1 static diagnostic, three repeats per variant | Before | After |
| --- | ---: | ---: |
| Native errors, each | 6 | 6 or 9 across candidates |
| Native opens, each | 15 | 15 |
| Target thermal findings, each | 1 | 1 throughout |
| Positive-net pad terminals / groups | 234 / 74 | 234 / 74, exact partition throughout |

`audit-target-run.py` independently inventories all reports and hashes, rebuilds terminal partitions, and checks error multisets without accepting any selection. It records the exact-list inconsistency explicitly. This negative result shows the earlier U1.39 witness does not establish coverage of another target. No engine, adapter, frozen fixture, checker or scoring change is proposed.

A separate regression probe found that `verify-geometry.py` accepted an omitted target finding in an otherwise unmodified summary. The verifier now compares target findings against each raw native report, requires baseline target presence and checks target repeat consistency. Three repeats each of unchanged / omitted / duplicated / wrong-pad controls accept only unchanged evidence (before: all 12 accepted; after: 3 accepted, 9 rejected). This changes evidence verification, not native DRC rules. The previous 51-report successful witness still verifies unchanged.

```bash
ASSETS=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
SOURCE=$HOME/bench/repos/fab_pcb/benchmarks/autorouter/results/baseline-20261018/runs/run-20261018T135444.397318Z-062/fab-router/final.kicad_pcb
# All 51 checks finish; expected nonzero exit at strict repeat consistency.
taskset -c 20-25 nice -n 10 timeout 2400 /usr/bin/python3 "$ASSETS/geometry-doglegs.py" --source "$SOURCE" --pad d145de36-3889-4a3d-8c61-71242d4e107c --directions pad-axis --limit 8 --out /tmp/thermal-r20
/usr/bin/python3 "$ASSETS/audit-target-run.py" /tmp/thermal-r20 d145de36-3889-4a3d-8c61-71242d4e107c
python3 "$ASSETS/target-controls.py" "$ASSETS/wide-results"
python3 "$ASSETS/verify-geometry.py" "$ASSETS/wide-results"
bun run typecheck && bun run check:layers && bun run test
```

The exact-list failure is native scheduling dependent and may not reproduce on every invocation; no acceptance is inferred from count agreement. Retained reports document the observed failure. All required checks pass: typecheck, 65 layer checks, 859 tests, zero failures. These are static native checks, not a new router benchmark. Frozen thermal failures remain unresolved.
