#!/usr/bin/env bash
set -euo pipefail
: "${CONTROL_SOURCE:?}" "${BENCHMARK_CHECKOUT:?}" "${PRIOR_NATIVE:?}" "${RUN_ROOT:?}"
assets=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
mkdir "$RUN_ROOT"
python3 "$assets/trace-trials.py" "$CONTROL_SOURCE" "$RUN_ROOT/source"
git -C "$RUN_ROOT/source" init -q -b agent/fab-router-perf-trial-diagnostic
git -C "$RUN_ROOT/source" add src spec package.json tsconfig.json census-provenance.json
git -C "$RUN_ROOT/source" -c user.name='Benchmark Agent' -c user.email='benchmark-agent@users.noreply.github.com' commit -qm 'Record diagnostic trial attribution snapshot'
taskset -c 12-19 nice -n 10 timeout 120 bun run --cwd "$RUN_ROOT/source" typecheck
(
 cd "$CONTROL_SOURCE"
 taskset -c 12-19 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
)
(
 cd "$BENCHMARK_CHECKOUT"
 taskset -c 12-19 nice -n 10 timeout 5400 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source "$RUN_ROOT/source" --out "$RUN_ROOT/native-complete"
)
python3 "$assets/compare-trial-native.py" "$PRIOR_NATIVE" "$RUN_ROOT/native-complete" "$RUN_ROOT/source" "$RUN_ROOT/trial-native.json"
taskset -c 12-19 nice -n 10 timeout 600 python3 "$assets/replay-trials.py" "$RUN_ROOT" "$PRIOR_NATIVE"
python3 "$assets/summarise-trials.py" "$RUN_ROOT" "$RUN_ROOT/trial-summary.json"
taskset -c 12-19 nice -n 10 timeout 120 bun "$assets/classify-trial-ends.ts" "$PRIOR_NATIVE" "$RUN_ROOT/trial-results.json" "$RUN_ROOT/trial-endpoints.json"
python3 "$assets/plot-trials.py" "$RUN_ROOT/trial-summary.json" "$RUN_ROOT/trial-endpoints.json" "$RUN_ROOT/trial-census.png"
