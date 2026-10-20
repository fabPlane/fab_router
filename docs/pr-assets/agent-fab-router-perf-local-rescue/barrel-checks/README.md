# Barrel endpoint recovery

The default-off post-pass now resolves pads and barrels as point endpoints on the
connection's own net. Barrel sheets come from the actual copper form and barrel
span, intersected with the net profile's permitted sheets. Pours remain unsupported.
The scheduler, visibility search and exact transaction gate share the same endpoint
resolver. No track width, clearance, via, grid, budget or default changes.

A synthetic pad-to-barrel regression closes 1→0 incomplete connections in three
repeats, preserving retained lower-sheet copper. Wrong-net ids are rejected; the nonoverlapping-sheet
control remains open. The old call sites fail both regression tests; supplying the
new resolver only satisfies their test imports, and does not change old routing.

Fresh native runs cover the full 26-case router slice, three repeats each, with
recovery off, extended recovery on, and previous recovery on. The last sweep is the
previous-revision control, so logical before/after order differs from execution
order. Full native results include the known thermal errors; this is not a claim
that all boards are DRC clean. `results.md` contains the completed measurements.

The prepared Dense6 native case and the supplied Dense6 DSN are different exports.
Their separate measurements must not be combined. Larger inputs use exactly two
normal passes, 600-second route budgets, no optimiser/fanout/necking, strict DRC and
recovery enabled in both revisions. Each input/mode has three repeats. Slow
acceptance uses unchanged original settings/expectations, enabling recovery; its
single evaluations are compared with retained earlier enabled evidence and may be
time limited. Failures and adverse differences are retained.

Heavy jobs overlap on cores 12–19 with nice 10 wrappers (nested runners may increase
niceness). Timings are observations on a shared host, not causal speedup evidence.
No new CPU profile was collected. Default enablement remains deferred; original
adverse timed progress is retained in `../strict-budget-checks/` and the earlier
slow results in `../public-checks/`.

`native-closure.png` renders the measured native output on the new connection's
layer. Tracks use native widths and coordinates; pad bounds supply visual context.
The extraction verifies checked output hashes, preservation of every old track
segment and equality of visible via geometry. The figure shows the first pair;
all three sessions match within each native mode. `closure.png` is the separate
synthetic engine fixture, with lattice units converted at 10,000 units/mm.

## Reproduce

Run from this engine checkout with dependencies installed. Choose an unused output
path. The previous control is a private local checkout; never push that branch.

```bash
BARREL_AFTER="$PWD"
BARREL_ASSETS="$BARREL_AFTER/docs/pr-assets/agent-fab-router-perf-local-rescue/barrel-checks"
BARREL_OUT="$HOME/bench/agents/codex-fabpcb-perf/scratch/barrel-repro"
FABPCB_CHECKOUT="$HOME/bench/wt/fp-perf"
mkdir "$BARREL_OUT"
git clone --shared "$BARREL_AFTER" "$BARREL_OUT/before"
git -C "$BARREL_OUT/before" switch -c agent/fab-router-perf-barrel-repro a284bef7806c3dd43e32c6ae98dcb4011cd370e7
ln -s "$BARREL_AFTER/node_modules" "$BARREL_OUT/before/node_modules"
taskset -c 12-19 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
taskset -c 12-19 nice -n 10 python3 "$BARREL_ASSETS/native.py" "$BARREL_AFTER" "$FABPCB_CHECKOUT" "$BARREL_OUT/native"
cd "$FABPCB_CHECKOUT"
taskset -c 12-19 nice -n 10 timeout 2400 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source "$BARREL_OUT/before/docs/pr-assets/agent-fab-router-perf-local-rescue/public-setting" --out "$BARREL_OUT/native-old-enabled"
taskset -c 12-19 nice -n 10 timeout 120 bun "$BARREL_ASSETS/measure.ts" "$BARREL_OUT/before" "$BARREL_AFTER" "$BARREL_OUT/fixture.json"
taskset -c 12-19 nice -n 10 timeout 7200 bun "$BARREL_ASSETS/large.ts" "$BARREL_OUT/before" "$BARREL_AFTER" "$BARREL_OUT/large.json" "$HOME/bench/boards/ladder/l2-cycle18.dsn" "$HOME/bench/boards/ladder/l3-cycle18.dsn" "$HOME/bench/boards/dense/dense6-bga324.dsn"
taskset -c 12-19 nice -n 10 timeout 3600 python3 "$BARREL_ASSETS/dense-native.py" "$FABPCB_CHECKOUT/benchmarks/autorouter" "$BARREL_OUT/before" "$BARREL_AFTER" "$HOME/bench/boards/dense/fab_pcb-case-dense6-bga324-j1" "$BARREL_OUT/dense-native"
taskset -c 12-19 nice -n 10 timeout 5400 bun "$BARREL_ASSETS/slow.ts" "$BARREL_OUT/slow.json"
python3 "$BARREL_ASSETS/extract-native.py" "$BARREL_OUT/dense-native" "$BARREL_OUT/native-connection.json"
"$HOME/bench/agents/codex-fabpcb-perf/scratch/plot-venv/bin/python" "$BARREL_ASSETS/plot-native.py" "$BARREL_OUT/native-connection.json" "$BARREL_OUT/native-closure.png"
"$HOME/bench/agents/codex-fabpcb-perf/scratch/plot-venv/bin/python" "$BARREL_ASSETS/plot.py" "$BARREL_OUT/fixture.json" "$BARREL_OUT/closure.png"
```

The native extractor requires the native checker environment; plotting requires
matplotlib. The prepared Dense6 input snapshot is also available in the companion
benchmark change under `benchmarks/boards/dense6-local-recovery/`.

Measured engine source is `f1680db`; current source/type fingerprints match that
commit, including runs started before the commit was created. The pristine fresh
previous-enabled checkout is `a284bef`. All its source/types match the earlier
consumer pin `5be94a0`. The smaller baseline snapshot used by synthetic/large/dense
runners has identical old tracked files and an unreferenced new resolver solely for
the old regression test imports; that resolver is not called by old routing.

Two timed slow cases had adverse progress relative to retained earlier evidence,
without changing acceptance outcomes. Fresh-process pairs retain their original
2-second and 180-second budgets and original expectations; they are not a new full
slow sweep and never replace the original adverse records. Reproduce each source
in a separate process:

```bash
for BARREL_CASE in routing-slow-issue555-bbd-mars64-timebudget routing-slow-issue555-cnh-maxpasses40; do
  taskset -c 12-19 nice -n 10 timeout 300 bun "$BARREL_ASSETS/repeat-timed.ts" "$BARREL_OUT/before" "$BARREL_CASE" "$BARREL_OUT/repeat-$BARREL_CASE-before.json"
  taskset -c 12-19 nice -n 10 timeout 300 bun "$BARREL_ASSETS/repeat-timed.ts" "$BARREL_AFTER" "$BARREL_CASE" "$BARREL_OUT/repeat-$BARREL_CASE-after.json"
done
```

Measured order for these follow-ups is previous/new for the 2-second case and
new/previous for the 180-second case. Normal routing code and the recovery timeout
skip guard are unchanged; the 180-second case also retains 16 existing exact
violations, so its baseline cannot admit a recovery proposal. These facts do not
establish a causal timing result. Default enablement remains deferred.
