
### Cycle 96: bounded full-board candidate generation and selection

Added a fixture-specific offline selector. It generates four endpoint-preserving
100 µm doglegs from two retained segments, runs a fresh native refill/DRC for
every candidate, rebuilds pad-terminal connectivity, and selects only a strict
error-multiset reduction with no new errors, additional opens or lost connected
terminal pairs. It leaves the supplied source untouched. Six selector controls
cover improvement, new errors, additional opens, terminal loss, no improvement
and duplicated surviving errors.

Same full board, native checker version 10.0.6, host and cores 20–25; three
fresh repeats for every row:

| Static candidate | Native errors before → after | Opens | Lost terminal pairs | Selected |
| --- | ---: | ---: | ---: | --- |
| Track 2, local −x | 6 → 6 | 15 | 0 | No |
| Track 2, local +x | 6 → 5 | 15 | 0 | Yes, 3/3 |
| Track 3, local −y | 6 → 7 | 15 | 0 | No |
| Track 3, local +y | 6 → 6 | 15 | 0 | No |

The opposite track-3 offset demonstrates rejection of a newly introduced error.
All 234 pad terminals retain their original connected pairs. This is static
fixture-specific selection, not an engine routing fix or frozen-suite gain.
Five full-board thermal errors and 15 opens remain; the historical full-suite
27 thermal errors remain unresolved. No new router benchmark ran.

Reproduce from the repository root with a fresh output directory:

```bash
asset=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
source=$HOME/bench/repos/fab_pcb/benchmarks/autorouter/results/baseline-20261018/runs/run-20261018T135444.397318Z-062/fab-router/final.kicad_pcb
PYTHONDONTWRITEBYTECODE=1 taskset -c 20-25 nice -n 10 timeout 1200 /usr/bin/python3 "$asset/select-dogleg.py" --source "$source" --out /tmp/aquarius-selection
/usr/bin/python3 "$asset/verify-selection.py" /tmp/aquarius-selection
/usr/bin/python3 "$asset/selection-chart.py" /tmp/aquarius-selection
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

![Native candidate selection](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/selection-results/comparison.png?raw=true)

Native process diagnostics are retained in each `native.log`; no output is suppressed.
The generated editor-state files are excluded. Source board license is retained
in the parent directory. Input, script and checked artifacts are bound by SHA-256.
