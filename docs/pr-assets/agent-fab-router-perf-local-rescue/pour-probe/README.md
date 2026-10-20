# Pour endpoint experiment

This is a disposable source experiment, not production pour support. The public
setting remains default off. Production `src`, `spec`, `test`, widths, clearances,
search budgets and the native checker are unchanged.

A pour is a filled region, so its vertex average need not be a contact point.
`prepare.py` adds exactly one fallback to the endpoint resolver in two disposable
source trees: the rounded outline vertex average, or the first outline vertex.
Both require target-net identity and use the actual pour sheet. Existing exact
transaction, terminal preservation, region and rollback gates remain active.
The first vertex is a limited witness, not a nearest-point or complete attachment
search. Outline ordering can change its location; it supplies no off-lattice,
rip-up, smaller width/via or spacing relaxation.

`measure.ts` runs actual recovery on four one-open fixtures, three repeats per
source, checks wrong-net rejection, preserved pads/pours/keepouts, deterministic sessions,
exact geometry and unchanged copper on every failed closure. The vertex average
closes the solid fixture but fails the holed and concave fixtures. The first vertex
closes those three but fails when a track-only keepout covers the selected vertex.
The vertex average closes that keepout fixture, proving an alternative legal
attachment exists. Both failed selectors roll back exactly. Neither tested fixed-point selector
solves all four fixtures. These are engine-only fixtures, with file-origin pours, no
foreign-net obstacles and no native design-rule validation. The image renders
measured retained copper (red); a purple cross is the selected endpoint. Units are
10,000 layout units/mm. Track strokes are illustrative, not a clearance proof.

The native comparison is a separate full frozen 26×3 experiment, both sources
using recovery enabled. `compare-native.py` checks exact case/seed/settings/input,
runtime/checker identity, per-attempt finding and warning-geometry multisets,
fidelity, completion and actual session hashes. It preserves negative results.
Do not treat matching native output as evidence that a pour proposal was accepted.
Known thermal errors remain unresolved. See `results.md` for measurements.

No production fallback is adopted in this cycle. A bounded attachment search needs
filled-region witnesses near the other component, explicit per-sheet handling and
native larger-input evidence before it can replace the unsupported outcome. The
naive vertex average is rejected; a first-vertex witness alone is incomplete.

## Reproduce

From this checkout, with installed dependencies and the existing private benchmark
runtime (no setup, checker or frozen-input edits):

```bash
POUR_ROOT="$PWD"
POUR_ASSETS="$POUR_ROOT/docs/pr-assets/agent-fab-router-perf-local-rescue/pour-probe"
POUR_OUT="$HOME/bench/agents/codex-fabpcb-perf/scratch/pour-repro"
mkdir "$POUR_OUT"
python3 "$POUR_ASSETS/prepare.py" "$POUR_ROOT" "$POUR_OUT/probes"
taskset -c 12-19 nice -n 10 timeout 120 bun "$POUR_ASSETS/measure.ts" "$POUR_ROOT" "$POUR_OUT/probes" "$POUR_OUT/synthetic.json"
taskset -c 12-19 nice -n 10 timeout 5000 python3 "$POUR_ASSETS/native.py" "$POUR_ROOT" "$POUR_OUT/probes" "$HOME/bench/wt/fp-perf" "$POUR_OUT/native"
taskset -c 12-19 nice -n 10 timeout 4000 bun "$POUR_ASSETS/large.ts" "$POUR_ROOT" "$POUR_OUT/probes/vertex" "$POUR_OUT/large.json" "$HOME/bench/boards/ladder/l2-cycle18.dsn" "$HOME/bench/boards/ladder/l3-cycle18.dsn" "$HOME/bench/boards/dense/dense6-bga324.dsn"
taskset -c 12-19 nice -n 10 timeout 4000 python3 "$POUR_ASSETS/dense-native.py" "$HOME/bench/wt/fp-perf/benchmarks/autorouter" "$POUR_ROOT" "$POUR_OUT/probes/vertex" "$HOME/bench/boards/dense/fab_pcb-case-dense6-bga324-j1" "$POUR_OUT/dense-native"
python3 "$POUR_ASSETS/compare-dense.py" "$POUR_OUT/dense-native" "$POUR_ROOT" "$POUR_OUT/probes/vertex" "$POUR_OUT/dense-comparison.json"
python3 "$POUR_ASSETS/compare-native.py" "$POUR_OUT/native/before" "$POUR_OUT/native/vertex" "$POUR_OUT/native-comparison.json"
taskset -c 12-19 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
"$HOME/bench/agents/codex-fabpcb-perf/scratch/plot-venv/bin/python" "$POUR_ASSETS/plot.py" "$POUR_OUT/synthetic.json" "$POUR_OUT/attachment.png"
```

`native.py` creates a local, unpushed experiment commit in its disposable vertex
source and enables the real public setting through a thin wrapper. Its source hash
snapshot covers the full imported engine and types, including imports outside the
wrapper. No experimental commit is offered as a consumer pin. Sources are checked
unchanged after each sweep. Python timeouts and benchmark controls apply normally.
Fresh larger-input runs use one exploratory pair per supplied DSN (L2, L3, Dense6),
with fixed two-pass/600-second budgets, optimiser/fanout disabled and no necking.
These are engine-only observations, not native DRC scores or three-repeat evidence.
The prepared Dense6 native case is a separate export, three repeats per source
with the same two-pass/600-second settings. It must not be combined with the
supplied Dense6 DSN. Slow acceptance from earlier cycles remains historical; no
fresh slow run is claimed for this unadopted experiment. Heavy jobs overlap on
the assigned cores; timing differences are not attributed to this fallback.

Measured production code is `f1680db` (evidence-only checkout head `de42286`).
Both disposable source trees differ only in `src/route/recovery-endpoint.ts`;
`sources.json.gz` binds every copied source/type/rule file and the exact injected
text. The native snapshot additionally binds the thin opt-in wrapper. Compact
records here retain measured results; full raw native boards/reports remain in
the agent’s cycle36 scratch and are regenerated by the commands above.
