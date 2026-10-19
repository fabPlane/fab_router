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
