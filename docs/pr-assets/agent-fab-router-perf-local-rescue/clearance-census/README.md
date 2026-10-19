# Complete-board obstacle and convex comparison census

Diagnostic only. Three sequential complete routing replays of the previously published exported board input on cores 12–19. The scratch observer changes only `src/route/clear.ts`; production code, settings, routing decisions, rules, tests, and consumer pin remain unchanged. Source audit binds all 1,536 tracked implementation/spec/test files to the independent complete-board native profile.

`calls` counts every candidate entering `hitBlocks`, including candidates rejected before geometry. `blocked` counts true returns. `pairs` counts actual `closerConvex` entries under `hitBlocks`, after recursive pieces expansion, keyed by obstacle category, subject shape, obstacle shape, and touching/spacing predicate. It excludes boundary-containment geometry and comparisons outside `hitBlocks`. All route phases are aggregated. Counters do not measure sampled CPU time, allocation, or speed. Pour candidates with no convex comparison must not be assumed to be ordinary pours: early exits include origin/net/kind/empty geometry gates.

Each replay must match the independent native control's input, effective settings, session bytes, final statistics, and full report except elapsed time. Recovery logs must match the independent uninstrumented engine replay after removing only nested seconds. Counter dictionaries must match across all three actual replays. Nine corruption controls cover copper/stats/counters/repeat drift and source provenance. Recorded observer wall times include overhead and are not a before/after comparison. No native checker or scored benchmark was rerun; historical 27 thermal errors remain unresolved.

Next distinct hypothesis: exclude provably nonblocking pour candidates before lattice result reference creation/sorting, using a routing-specific query policy while preserving the general lattice API, live mutations, same-net/prior semantics and deterministic output. The census does not establish that this saves time; inspect branch reasons and measure a bounded prototype before any adoption. Track capsule comparisons are the largest exact-comparison pair. Avoid repeating rejected loop/callback/key variants.

Reproduce from this repository with production source at `6832466` (the diagnostic files can be retained from the evidence commit):

```sh
asset=docs/pr-assets/agent-fab-router-perf-local-rescue/clearance-census
work=$HOME/bench/agents/codex-fabpcb-perf/scratch/cycle64-reproduction
python3 "$asset/prepare.py" "$work/work"
for repeat in 1 2 3; do
  taskset -c 12-19 nice -n 10 timeout 300 bun "$asset/run.ts" "$work/work/source" "$work/work/input" "$work/replay$repeat"
done
python3 "$asset/package.py" "$work" "$work/records.json.gz" > "$work/summary.json"
# Published archive can be independently checked without routing:
python3 "$asset/verify.py" /tmp/clearance-census-summary.json
python3 "$asset/controls.py"
python3 "$asset/report.py" "$asset"
rsvg-convert "$asset/census.svg" -o /tmp/clearance-census.png
 taskset -c 12-19 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

The archive includes raw records/session bytes, full observer, source hashes, supervisor logs, summaries, and full required checks. Existing board input, independent reference, driver, and licenses remain under sibling `native-profile` / `point-components` evidence. No engine improvement or default/pin adoption is proposed by this census.
